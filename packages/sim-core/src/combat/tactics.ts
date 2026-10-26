// Who to fight, moment to moment, in a team fight. Every pull is a weight, not a
// rule: grudges, believed matchups, worry for teammates, what was said before the
// bell (and how much the fighter cares about who said it), glory, fear and plain
// opportunity all compete. Behaviours like "hold back, then unleash" are what it
// looks like when those weights shift over a fight.

import type { FighterId, SimState } from '../types';
import { unit } from '../util/math';
import { bond, getFighter, peekRel } from '../world';
import { perceivedEdge } from './records';
import { grudge } from './talk';
import type { Combatant, EngageMode } from './types';

export interface TacticsContext {
  state: SimState;
  frame: number;
  me: Combatant;
  allies: Combatant[];
  opponents: Combatant[];
  /** Damage dealt so far this fight: damage[attacker][defender]. */
  damage: Record<FighterId, Record<FighterId, number>>;
}

/**
 * How an exchange is going right now, -1..1 for `a` against `b`, and how much
 * there is to go on (0..1).
 */
export function liveExchange(damage: TacticsContext['damage'], a: FighterId, b: FighterId): { edge: number; weight: number } {
  const ab = damage[a]?.[b] ?? 0;
  const ba = damage[b]?.[a] ?? 0;
  const total = ab + ba;
  return { edge: total > 0 ? (ab - ba) / total : 0, weight: Math.min(1, total / 80) };
}

export interface TacticsChoice {
  target: FighterId;
  mode: EngageMode;
  /** The biggest single reason, for the play-by-play. */
  why: string;
  /** Opponent bearing down on a struggling teammate, if that's what this is about. */
  protecting?: FighterId;
}

export interface TacticsPolicy {
  readonly id: string;
  choose(ctx: TacticsContext): TacticsChoice | null;
}

function dist(a: Combatant, b: Combatant): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

export class RuleTactics implements TacticsPolicy {
  readonly id = 'rules.tactics';

  choose(ctx: TacticsContext): TacticsChoice | null {
    const { state, me, allies, opponents } = ctx;
    const live = opponents.filter((o) => !o.out);
    if (live.length === 0) return null;
    const t = getFighter(state, me.id).temperament;
    const avgHp = live.reduce((s, o) => s + o.maxHp, 0) / live.length;

    let best: (TacticsChoice & { u: number }) | null = null;
    const offer = (c: TacticsChoice, u: number) => {
      if (!best || u > best.u) best = { ...c, u };
    };

    for (const x of live) {
      const reasons: [string, number][] = [];
      reasons.push(['grudge', grudge(state, me.id, x.id) * (0.4 + 0.6 * unit(t.aggression))]);
      // What I believed coming in, corrected by how it's actually going.
      const live = liveExchange(ctx.damage, me.id, x.id);
      const edge = (1 - live.weight) * perceivedEdge(state, me.id, x.id) + live.weight * live.edge;
      reasons.push(['matchup', 0.5 * edge * (0.5 + unit(t.pragmatism))]);

      // Worry: a teammate I care about is going down under this opponent.
      let protect = 0;
      let protecting: FighterId | undefined;
      for (const a of allies) {
        if (a.id === me.id || a.out) continue;
        const onThem = x.target === a.id ? 1 : 0.2;
        const hurt = 1 - a.hp / a.maxHp;
        // The far-sighted see where it's heading before it gets there — from the record
        // at first, then from what they're watching.
        const watch = liveExchange(ctx.damage, a.id, x.id);
        const expected = x.target === a.id ? perceivedEdge(state, a.id, x.id, me.id) : 0;
        const losing = Math.max(0, -((1 - watch.weight) * expected + watch.weight * watch.edge));
        const foresight = 0.5 * unit(t.pragmatism) + 0.3 * unit(t.curiosity);
        const p = Math.max(0, bond(state, me.id, a.id)) * (hurt * hurt * 2.5 + losing * foresight * 1.5) * onThem * (0.6 + 0.6 * unit(t.loyalty));
        if (p > protect) {
          protect = p;
          protecting = a.id;
        }
      }
      reasons.push(['protect', protect]);

      reasons.push(['finish', (1 - x.hp / x.maxHp) * (0.3 + 0.5 * unit(t.pragmatism))]);
      reasons.push(['glory', 0.3 * unit(t.ego) * (x.maxHp / avgHp - 0.8)]);
      // Self-defence: someone is on me.
      reasons.push(['defend', x.target === me.id && dist(x, me) < 160 ? 0.4 : 0]);
      reasons.push(['fear', -0.6 * (peekRel(state, me.id, x.id).fear + Math.max(0, -edge) * (1 - unit(t.courage)) * 0.5)]);
      reasons.push(['distance', -dist(me, x) / 1000]);
      reasons.push(['commitment', me.target === x.id ? 0.1 + 0.15 * unit(t.discipline) : 0]);

      // What I was told still matters — as long as it still makes sense. "Leave him to
      // me" means less when the one who said it is going down; pragmatists notice first.
      let focus = 0;
      let avoid = 0;
      const realism = 0.4 + 0.6 * unit(t.pragmatism);
      for (const inf of me.influences) {
        if (inf.target !== x.id) continue;
        if (inf.kind === 'focus') {
          const mine = inf.from === me.id ? 0 : Math.max(0, -live.edge) * live.weight;
          focus += inf.weight * (1 - mine * realism);
        }
        if (inf.kind === 'avoid') {
          const claimant = allies.find((a) => a.id === inf.from);
          let credibility = 0;
          if (claimant && !claimant.out) {
            const theirs = liveExchange(ctx.damage, claimant.id, x.id);
            credibility = Math.max(0, Math.min(1, claimant.hp / claimant.maxHp + 0.5 * theirs.edge * theirs.weight));
          }
          avoid += inf.weight * (1 - realism + realism * credibility);
        }
      }
      reasons.push(['told to', 0.8 * focus]);

      const raw = reasons.reduce((s, [, v]) => s + v, 0);
      const top = [...reasons].sort((a, b) => b[1] - a[1])[0]!;
      const why = top[0] === 'protect' && protecting ? `protect:${protecting}` : top[0];
      const extra = protecting && protect > 0.2 ? { protecting } : {};

      // Engaging someone a teammate asked me to leave alone costs me, as much as I heed them.
      offer({ target: x.id, mode: 'engage', why: avoid > 0.3 && raw - avoid > 0 ? `${why} (despite being asked)` : why, ...extra }, raw - avoid);

      // Or: stay close to them, keep my strength, and be ready — wanting them, but holding back.
      if (avoid > 0.1) {
        const patience = 0.2 + 0.4 * unit(t.pragmatism) + 0.4 * unit(t.discipline);
        offer({ target: x.id, mode: 'hover', why: 'waiting', ...extra }, raw * Math.min(1, avoid) * patience - 0.1);
      }
    }
    if (!best) return null;
    const { u: _u, ...choice } = best as TacticsChoice & { u: number };
    return choice;
  }
}
