// Combat minds. Like the home-side providers, this is a seam: the rule-based
// policy below decides from personality, feelings, knowledge and what it can see.

import type { Temperament } from '../temperament';
import type { Fighter } from '../types';
import { clamp01, unit } from '../util/math';
import { radius } from './body';
import { expectedValue, threatOf } from './knowledge';
import { MOVE_IDS, MOVES } from './moves';
import type { Combatant, MoveId, Stance } from './types';

export interface CombatView {
  frame: number;
  me: Combatant;
  meFighter: Fighter;
  opponent: Combatant;
  opponentFighter: Fighter;
  distance: number;
}

export type CombatDecision =
  | { kind: 'attack'; move: MoveId }
  | { kind: 'advance' | 'retreat' | 'guard' | 'idle' | 'taunt'; frames: number }
  | { kind: 'stance'; to: Stance };

export type CombatReaction = { kind: 'block' } | { kind: 'backstep' } | { kind: 'counter'; move: MoveId } | { kind: 'none' };

export interface CombatPolicy {
  readonly id: string;
  /** Called whenever the fighter is free to act. */
  decide(view: CombatView): CombatDecision;
  /** Called once per opponent attack, after the fighter's reaction delay. */
  react(view: CombatView, incoming: MoveId): CombatReaction;
}

/** Which stance this fighter gravitates to, before any learning. */
export function preferredStance(t: Temperament): Stance {
  const crouch = 0.6 * unit(t.discipline) + 0.6 * (1 - unit(t.courage)) - 0.5 * unit(t.aggression) - 0.3 * unit(t.ego);
  return crouch > 0.55 ? 'crouched' : 'upright';
}

export function openingFrames(view: CombatView): number {
  const a = view.opponent.action;
  if (a.kind === 'stagger' || a.kind === 'down') return Math.max(0, a.endFrame - view.frame);
  if (a.kind !== 'attack' || !a.move) return 0;
  const m = MOVES[a.move];
  const recoveryStart = a.startFrame + m.startup + m.active;
  return view.frame >= recoveryStart ? a.endFrame - view.frame : 0;
}

export function reachOf(view: CombatView, move: MoveId): number {
  return MOVES[move].reach * view.meFighter.def.body.heightCm + radius(view.opponentFighter.def.body);
}

export function inReach(view: CombatView, move: MoveId): boolean {
  return view.distance <= reachOf(view, move);
}

export class RuleCombatPolicy implements CombatPolicy {
  readonly id = 'rules.combat';

  decide(view: CombatView): CombatDecision {
    const { me, opponent, meFighter } = view;
    const t = meFighter.temperament;
    const hpRatio = me.hp / me.maxHp;
    const oppHpRatio = opponent.hp / opponent.maxHp;
    const oppBusy = opponent.action.kind === 'attack' || opponent.action.kind === 'stagger' || opponent.action.kind === 'down';
    // An opening: the opponent is stuck finishing a strike (or reeling) for this many frames.
    const opening = openingFrames(view);

    const options: { d: CombatDecision; u: number }[] = [];

    // Stance: settle into the stance that suits you.
    const want = preferredStance(t);
    if (want !== me.stance) options.push({ d: { kind: 'stance', to: want }, u: 0.9 });

    // What the opponent can hit me with from here, and how much that has hurt before.
    let danger = 0;
    if (opening === 0) {
      for (const move of MOVE_IDS) {
        const m = MOVES[move];
        if (!m.from.includes(opponent.stance) || m.grab) continue;
        const reach = m.reach * view.opponentFighter.def.body.heightCm + radius(meFighter.def.body);
        if (view.distance <= reach) danger = Math.max(danger, threatOf(meFighter.combat, move));
      }
    }
    // Value every move by expected damage per second, as this fighter judges it.
    let wanted: { move: MoveId; u: number } | null = null;
    let bestReachable = -Infinity;
    for (const move of MOVE_IDS) {
      const m = MOVES[move];
      if (me.stamina < m.stamina || !m.from.includes(me.stance)) continue;
      const ev = expectedValue(meFighter.combat, move, opponent.stance);
      const dps = m.damage / (m.startup + m.active + m.recovery);
      const reward = ev * dps * 2.5 * (0.6 + 0.8 * unit(t.aggression) + 0.5 * me.rage);
      const exposure = ((m.startup + m.recovery) / 30) * (oppBusy ? 0.3 : 1);
      const risk = exposure * (0.15 + 0.35 * unit(t.discipline)) * (0.5 + me.fear) * (1 + 1.5 * danger);
      const flair = m.damage >= 12 ? 0.15 * unit(t.ego) : 0;
      // Punishing a whiff: the disciplined see it and take it.
      // ...but only once they've noticed it.
      const noticed = opening - (me.reactionDelay - 8);
      const punish = noticed > m.startup ? 0.3 + 0.5 * unit(t.discipline) + 0.2 * unit(t.aggression) : 0;
      // Curiosity: try what you haven't tried much against this kind of opponent.
      const tries = meFighter.combat.moves[`${move}|${opponent.stance}`]?.n ?? 0;
      const explore = (0.35 * unit(t.curiosity)) / (1 + tries);
      // Impatience: the longer nothing lands, the more the aggressive want to make something happen.
      const urge = me.impatience * (0.3 + 0.7 * unit(t.aggression));
      const u = reward - risk + flair + punish + explore + urge;
      if (!wanted || u > wanted.u) wanted = { move, u };
      if (!inReach(view, move)) continue;
      // Everyone knows the length of their own limbs: the very tip only grazes.
      const tip = view.distance > reachOf(view, move) * 0.85 && !m.grab ? 0.2 + 0.3 * unit(t.discipline) : 0;
      bestReachable = Math.max(bestReachable, u - tip);
      options.push({ d: { kind: 'attack', move }, u: u - tip });
    }

    // Close in for the move you actually want.
    const pressure = 0.2 + 0.5 * unit(t.aggression) + 0.4 * me.rage - 0.5 * me.fear + me.impatience;
    if (wanted && (!inReach(view, wanted.move) || view.distance > reachOf(view, wanted.move) * 0.85)) {
      options.push({ d: { kind: 'advance', frames: 6 }, u: pressure + 0.5 * wanted.u - Math.max(0, bestReachable) * 0.5 });
    }

    const flee = 0.6 * me.fear + 0.4 * (1 - hpRatio) * (1 - unit(t.courage)) + (me.stamina < 15 ? 0.4 : 0) - 0.3 * unit(t.courage);
    options.push({ d: { kind: 'retreat', frames: 8 }, u: flee });

    if (danger > 0) {
      options.push({
        d: { kind: 'guard', frames: 10 },
        u: 0.05 + 0.3 * unit(t.discipline) + 0.4 * me.fear - 0.4 * unit(t.aggression) + danger * (0.3 + 0.4 * unit(t.discipline)),
      });
    }

    if (hpRatio - oppHpRatio > 0.25 && view.distance > 140) {
      options.push({ d: { kind: 'taunt', frames: 20 }, u: 0.7 * unit(t.ego) + 0.3 * unit(t.volatility) - 0.2 });
    }

    options.push({ d: { kind: 'idle', frames: 4 }, u: 0.1 + (me.stamina < 30 ? 0.3 : 0) });

    let best = options[0]!;
    for (const o of options) if (o.u > best.u) best = o;
    return best.d;
  }

  react(view: CombatView, incoming: MoveId): CombatReaction {
    const { me, meFighter } = view;
    const t = meFighter.temperament;
    const m = MOVES[incoming];
    const threat = threatOf(meFighter.combat, incoming);
    const block = 0.3 + 0.4 * unit(t.discipline) + 0.3 * me.fear + threat * (0.4 + 0.4 * unit(t.discipline)) - (m.grab ? 1 : 0);
    const backstep = 0.2 + 0.6 * me.fear + 0.3 * (1 - unit(t.courage)) + (m.grab ? 0.5 : 0);
    let counter: { move: MoveId; u: number } | null = null;
    for (const move of ['jab', 'cross'] as MoveId[]) {
      if (!inReach(view, move) || me.stamina < MOVES[move].stamina || !MOVES[move].from.includes(me.stance)) continue;
      if (MOVES[move].startup >= m.startup) continue;
      const ev = expectedValue(meFighter.combat, move, view.opponent.stance);
      const u = (0.2 + 0.6 * unit(t.aggression) + 0.5 * me.rage - 0.3 * unit(t.discipline)) * (ev / 0.6);
      if (!counter || u > counter.u) counter = { move, u };
    }
    const options: [CombatReaction, number][] = [
      [{ kind: 'block' }, block],
      [{ kind: 'backstep' }, backstep],
      [{ kind: 'none' }, 0.25],
    ];
    if (counter) options.push([{ kind: 'counter', move: counter.move }, counter.u]);
    let best = options[0]!;
    for (const o of options) if (o[1] > best[1]) best = o;
    return best[0];
  }
}

/** Starting feelings for a fight, from life at home and history with the opponent. */
export function startingFeelings(me: Fighter, opponentId: string): { rage: number; fear: number } {
  const r = me.relationships[opponentId];
  return {
    rage: clamp01(me.state.mood.anger * 0.5 + (r?.resentment ?? 0) * 0.5),
    fear: clamp01(me.state.mood.fear * 0.5 + (r?.fear ?? 0) * 0.5),
  };
}
