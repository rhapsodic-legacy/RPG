// The arena loop. Deterministic: same fighters, same state, same result.

import type { FighterId, SimState } from '../types';
import { clamp, clamp01, unit } from '../util/math';
import { getFighter, nameOf } from '../world';
import { geometricContact, guardCovers, maxHp, radius, walkSpeed, type WhiffReason } from './body';
import { learn, learnThreat } from './knowledge';
import { MOVES } from './moves';
import { RuleCombatPolicy, startingFeelings, type CombatDecision, type CombatPolicy, type CombatView } from './policy';
import { FPS, type MoveId, type Combatant, type CombatStats, type ContactQuality, type FightEvent, type FightResult } from './types';

export interface FightOptions {
  policy?: CombatPolicy;
  /** Default 90 seconds. */
  maxFrames?: number;
  /** Fighters learn from this fight (default true). */
  learn?: boolean;
}

const ARENA_HALF_WIDTH = 450;
const START_GAP = 300;
const KNOCKDOWN_FRAMES = 45;
const STANCE_FRAMES = 6;
const DAMAGE_MULT: Record<ContactQuality, number> = { clean: 1, glancing: 0.35, blocked: 0.08, whiff: 0 };

function emptyStats(): CombatStats {
  return {
    attempts: {},
    byMove: {},
    outcomes: { clean: 0, glancing: 0, blocked: 0, whiff: 0 },
    damageDealt: 0,
    damageTaken: 0,
    blocks: 0,
    knockdowns: 0,
    framesCrouched: 0,
    taunts: 0,
  };
}

/** Reaction delay in frames: sharp fighters see it coming; distracted ones don't. */
export function reactionDelay(focus: number, fear: number): number {
  return 8 + Math.round((1 - clamp01(focus)) * 14) + (fear > 0.6 ? 3 : 0);
}

/** Frames between decisions: 3 when sharp, up to 9 when badly distracted. */
export function thinkInterval(focus: number): number {
  return 3 + Math.round((1 - clamp01(focus)) * 6);
}

/**
 * Run a 1v1 fight between two fighters from the house. The arena reads (and,
 * through learning, updates) their persistent state; it doesn't touch relationships
 * or memories yet — that's the next step of closing the loop.
 */
export function runFight(state: SimState, aId: FighterId, bId: FighterId, opts: FightOptions = {}): FightResult {
  const policy = opts.policy ?? new RuleCombatPolicy();
  const maxFrames = opts.maxFrames ?? 90 * FPS;
  const fighters = [getFighter(state, aId), getFighter(state, bId)] as const;
  const events: FightEvent[] = [];
  const n = (id: string) => nameOf(state, id);

  const combatants: Combatant[] = fighters.map((f, i) => {
    const other = fighters[1 - i]!;
    const feelings = startingFeelings(f, other.def.id);
    const hp = maxHp(f.def.body);
    return {
      id: f.def.id,
      side: i as 0 | 1,
      x: i === 0 ? -START_GAP / 2 : START_GAP / 2,
      z: 0,
      stance: 'upright',
      action: { kind: 'idle', startFrame: 0, endFrame: 0 },
      hp,
      maxHp: hp,
      stamina: 100,
      balance: 100,
      rage: feelings.rage,
      fear: feelings.fear,
      impatience: 0,
      reactionDelay: reactionDelay(f.state.focus, feelings.fear),
      nextThink: 0,
      reactedTo: -1,
      stats: emptyStats(),
    };
  });

  const view = (i: number, frame: number): CombatView => {
    const me = combatants[i]!;
    const opponent = combatants[1 - i]!;
    return {
      frame,
      me,
      meFighter: fighters[i]!,
      opponent,
      opponentFighter: fighters[1 - i]!,
      distance: Math.abs(me.x - opponent.x),
    };
  };

  const free = (c: Combatant, frame: number) =>
    frame >= c.action.endFrame || c.action.kind === 'idle' || c.action.kind === 'advance' || c.action.kind === 'retreat' || c.action.kind === 'guard';

  const start = (c: Combatant, d: CombatDecision, frame: number) => {
    switch (d.kind) {
      case 'attack': {
        const m = MOVES[d.move];
        c.stamina -= m.stamina;
        c.stats.attempts[d.move] = (c.stats.attempts[d.move] ?? 0) + 1;
        c.action = { kind: 'attack', move: d.move, startFrame: frame, endFrame: frame + m.startup + m.active + m.recovery };
        break;
      }
      case 'stance':
        c.action = { kind: 'stance', toStance: d.to, startFrame: frame, endFrame: frame + STANCE_FRAMES };
        break;
      case 'taunt':
        c.stats.taunts++;
        events.push({ frame, type: 'taunt', attacker: c.id, text: `${n(c.id)} taunts the crowd.` });
        c.action = { kind: 'taunt', startFrame: frame, endFrame: frame + d.frames };
        break;
      default:
        c.action = { kind: d.kind, startFrame: frame, endFrame: frame + d.frames };
    }
  };

  let frame = 0;
  let winner: FighterId | null = null;
  let method: FightResult['method'] = 'decision';

  for (; frame < maxFrames; frame++) {
    // Finish actions.
    for (const c of combatants) {
      if (frame < c.action.endFrame) continue;
      if (c.action.kind === 'stance' && c.action.toStance) {
        c.stance = c.action.toStance;
        events.push({ frame, type: 'stance', attacker: c.id, text: `${n(c.id)} drops into a ${c.stance} stance.` });
      }
      if (c.action.kind === 'down') c.balance = 60;
      c.action = { kind: 'idle', startFrame: frame, endFrame: frame };
    }

    // Reactions to attacks seen coming.
    combatants.forEach((c, i) => {
      const o = combatants[1 - i]!;
      if (o.action.kind !== 'attack' || o.action.resolved || c.reactedTo === o.action.startFrame) return;
      if (frame - o.action.startFrame < c.reactionDelay || !free(c, frame)) return;
      c.reactedTo = o.action.startFrame;
      const r = policy.react(view(i, frame), o.action.move!);
      const until = o.action.startFrame + MOVES[o.action.move!].startup + MOVES[o.action.move!].active;
      if (r.kind === 'block') c.action = { kind: 'guard', startFrame: frame, endFrame: until + 1 };
      else if (r.kind === 'backstep') c.action = { kind: 'retreat', startFrame: frame, endFrame: until + 1 };
      else if (r.kind === 'counter') start(c, { kind: 'attack', move: r.move }, frame);
    });

    // Decisions.
    combatants.forEach((c, i) => {
      if (!free(c, frame) || frame < c.nextThink) return;
      if (c.action.kind !== 'idle' && frame < c.action.endFrame) return;
      start(c, policy.decide(view(i, frame)), frame);
      // A preoccupied mind decides more slowly.
      c.nextThink = frame + thinkInterval(fighters[i]!.state.focus);
    });

    // Movement.
    combatants.forEach((c, i) => {
      const o = combatants[1 - i]!;
      const toward = Math.sign(o.x - c.x) || (c.side === 0 ? 1 : -1);
      const speed = walkSpeed(fighters[i]!.def.body) * (c.stance === 'crouched' ? 0.5 : 1);
      if (c.action.kind === 'advance') c.x += toward * speed;
      if (c.action.kind === 'retreat') c.x -= toward * speed;
      c.x = clamp(c.x, -ARENA_HALF_WIDTH, ARENA_HALF_WIDTH);
    });
    // Bodies don't overlap.
    {
      const [a, b] = combatants as [Combatant, Combatant];
      const minGap = radius(fighters[0].def.body) + radius(fighters[1].def.body);
      const gap = b.x - a.x;
      if (Math.abs(gap) < minGap) {
        const push = (minGap - Math.abs(gap)) / 2;
        const dir = gap >= 0 ? 1 : -1;
        a.x -= dir * push;
        b.x += dir * push;
      }
    }

    // Strikes: resolve against the state at the start of this step so trades are fair.
    const contacts: { i: number; move: MoveId; quality: ContactQuality; region?: string; whiff?: WhiffReason }[] = [];
    combatants.forEach((c, i) => {
      if (c.action.kind !== 'attack' || c.action.resolved) return;
      const m = MOVES[c.action.move!];
      const activeStart = c.action.startFrame + m.startup;
      const activeEnd = activeStart + m.active;
      if (frame < activeStart || frame >= activeEnd) return;
      const o = combatants[1 - i]!;
      const geo = geometricContact(fighters[i]!.def.body, c.stance, fighters[1 - i]!.def.body, o.stance, m, Math.abs(c.x - o.x));
      if (geo.quality === 'whiff') {
        if (frame === activeEnd - 1) contacts.push({ i, move: m.id, quality: 'whiff', ...(geo.whiff ? { whiff: geo.whiff } : {}) });
        return;
      }
      const guarding = o.action.kind === 'guard' && frame < o.action.endFrame;
      const blocked = guarding && geo.region !== undefined && guardCovers(o.stance, geo.region, m);
      contacts.push({ i, move: m.id, quality: blocked ? 'blocked' : geo.quality, ...(geo.region ? { region: geo.region } : {}) });
    });

    for (const contact of contacts) {
      const c = combatants[contact.i]!;
      const o = combatants[1 - contact.i]!;
      const me = fighters[contact.i]!;
      // Trades: both strikes were already in flight, even if this attacker just got hit.
      const m = MOVES[contact.move];
      if (c.action.kind === 'attack') c.action.resolved = true;
      const q = contact.quality;
      c.stats.outcomes[q]++;
      const byMove = (c.stats.byMove[m.id] ??= { clean: 0, glancing: 0, blocked: 0, whiff: 0 });
      byMove[q]++;
      if (opts.learn !== false) {
        learn(me.combat, me.temperament, m.id, o.stance, q);
        const them = fighters[1 - contact.i]!;
        learnThreat(them.combat, them.temperament, m.id, q);
      }
      if (q !== 'whiff') {
        c.impatience = 0;
        o.impatience = 0;
      }
      if (q === 'whiff') {
        if (contact.whiff && contact.whiff !== 'short') {
          const how =
            contact.whiff === 'over' ? `sails over ${n(o.id)}'s ${o.stance === 'crouched' ? 'crouch' : 'head'}`
            : contact.whiff === 'under' ? `passes under ${n(o.id)}`
            : contact.whiff === 'braced' ? `can't get a grip on ${n(o.id)}'s low crouch`
            : `can't budge ${n(o.id)}`;
          events.push({ frame, type: 'contact', attacker: c.id, defender: o.id, move: m.id, quality: q, text: `${n(c.id)}'s ${m.name} ${how}.` });
        }
        continue;
      }

      const strength = 0.75 + (0.25 * me.def.body.massKg) / 75;
      const damage = m.damage * DAMAGE_MULT[q] * strength * (contact.region === 'head' ? 1.2 : 1);
      o.hp = Math.max(0, o.hp - damage);
      c.stats.damageDealt += damage;
      o.stats.damageTaken += damage;
      const dir = Math.sign(o.x - c.x) || 1;
      const massRatio = me.def.body.massKg / fighters[1 - contact.i]!.def.body.massKg;
      if (q === 'blocked') {
        o.stats.blocks++;
        o.x += dir * m.knockback * 0.3 * massRatio;
        o.action = { kind: 'guard', startFrame: frame, endFrame: frame + m.blockstun };
      } else {
        o.x += dir * m.knockback * (q === 'clean' ? 1 : 0.4) * massRatio;
        o.balance -= m.balanceDamage * (q === 'clean' ? 1 : 0.4) * massRatio;
        o.action = { kind: 'stagger', startFrame: frame, endFrame: frame + (q === 'clean' ? m.hitstun : Math.round(m.hitstun / 2)) };
        // How getting hit feels depends on who you are.
        const ot = fighters[1 - contact.i]!.temperament;
        const hurt = damage / 20;
        o.fear = clamp01(o.fear + hurt * (1 - unit(ot.courage)));
        o.rage = clamp01(o.rage + hurt * (0.5 * unit(ot.aggression) + 0.5 * unit(ot.volatility)));
        c.fear = clamp01(c.fear - hurt * 0.3);
      }
      o.x = clamp(o.x, -ARENA_HALF_WIDTH, ARENA_HALF_WIDTH);
      events.push({
        frame,
        type: 'contact',
        attacker: c.id,
        defender: o.id,
        move: m.id,
        quality: q,
        damage,
        ...(contact.region ? { region: contact.region as 'head' | 'torso' | 'legs' } : {}),
        text: `${n(c.id)}'s ${m.name} ${q === 'blocked' ? 'is blocked by' : q === 'glancing' ? 'glances off' : 'lands on'} ${n(o.id)}${contact.region && q !== 'blocked' ? ` (${contact.region})` : ''}.`,
      });

      if (o.balance <= 0 && o.hp > 0) {
        o.stats.knockdowns++;
        o.action = { kind: 'down', startFrame: frame, endFrame: frame + KNOCKDOWN_FRAMES };
        events.push({ frame, type: 'knockdown', attacker: c.id, defender: o.id, text: `${n(o.id)} goes down!` });
      }
    }

    // Stamina recovers when not exerting; crouch time is tracked for stats.
    for (const c of combatants) {
      if (c.stance === 'crouched') c.stats.framesCrouched++;
      c.impatience = Math.min(1, c.impatience + (0.5 + unit(fighters[c.side]!.temperament.aggression)) / (10 * FPS));
      const resting = c.action.kind === 'idle' || c.action.kind === 'guard' || c.action.kind === 'taunt';
      c.stamina = Math.min(100, c.stamina + (resting ? 0.6 : 0.25));
      // Footing comes back while you're not being rocked.
      if (c.action.kind !== 'stagger' && c.action.kind !== 'down') c.balance = Math.min(100, c.balance + 0.4);
    }

    const ko = combatants.find((c) => c.hp <= 0);
    if (ko) {
      const other = combatants.find((c) => c !== ko)!;
      winner = other.id;
      method = 'ko';
      events.push({ frame, type: 'ko', attacker: other.id, defender: ko.id, text: `${n(ko.id)} is knocked out! ${n(other.id)} wins.` });
      frame++;
      break;
    }
  }

  if (!winner) {
    const [a, b] = combatants as [Combatant, Combatant];
    const ra = a.hp / a.maxHp;
    const rb = b.hp / b.maxHp;
    winner = ra > rb ? a.id : rb > ra ? b.id : null;
    method = winner ? 'decision' : 'draw';
    events.push({ frame, type: 'time', text: winner ? `Time! ${n(winner)} wins on points.` : 'Time! A draw.' });
  }

  return {
    winner,
    method,
    frames: frame,
    events,
    stats: Object.fromEntries(combatants.map((c) => [c.id, c.stats])),
    finalHp: Object.fromEntries(combatants.map((c) => [c.id, c.hp])),
  };
}
