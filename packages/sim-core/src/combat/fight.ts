// The arena loop, for any number of fighters per side. Deterministic: same
// fighters, same state, same result.

import type { FighterId, SimState } from '../types';
import { clamp, clamp01, unit } from '../util/math';
import { bond, getFighter, nameOf } from '../world';
import { geometricContact, guardCovers, maxHp, radius, walkSpeed, type WhiffReason } from './body';
import { learn, learnThreat } from './knowledge';
import { MOVES } from './moves';
import { RuleCombatPolicy, startingFeelings, type CombatDecision, type CombatPolicy, type CombatView } from './policy';
import { RuleTactics, type TacticsPolicy } from './tactics';
import { absorb, RuleCombatVoice, type CombatVoice } from './talk';
import {
  FPS,
  type Combatant,
  type CombatStats,
  type ContactQuality,
  type FightEvent,
  type FightResult,
  type MoveId,
  type Rescue,
  type SpeechAct,
} from './types';

export interface FightOptions {
  policy?: CombatPolicy;
  tactics?: TacticsPolicy;
  voice?: CombatVoice;
  /** Who leads each side. */
  leaders?: [FighterId | null, FighterId | null];
  /** Default 90 seconds (1v1) or 150 seconds (teams). */
  maxFrames?: number;
  /** Fighters learn from this fight (default true). */
  learn?: boolean;
}

const ARENA_HALF_WIDTH = 450;
const ARENA_HALF_DEPTH = 220;
const START_GAP = 300;
const LANE_SPACING = 120;
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

/**
 * Frames between decisions — everyone's own rhythm. The hot-blooded act on
 * instinct; the disciplined wait a beat. (Distraction shows up in slower
 * reactions and missed openings, not in rhythm.)
 */
export function thinkInterval(discipline = 0, aggression = 0): number {
  return 3 + Math.round(2 * unit(discipline) - unit(aggression));
}

function dist(a: Combatant, b: Combatant): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/** 1v1 convenience wrapper. */
export function runFight(state: SimState, aId: FighterId, bId: FighterId, opts: FightOptions = {}): FightResult {
  return runTeamFight(state, [[aId], [bId]], opts);
}

/**
 * Run a fight between two sides of fighters. The arena reads (and, through
 * learning, updates) their persistent state; consequences for life at home are
 * applied by the simulation from the returned result.
 */
export function runTeamFight(state: SimState, sides: [FighterId[], FighterId[]], opts: FightOptions = {}): FightResult {
  const policy = opts.policy ?? new RuleCombatPolicy();
  const tactics = opts.tactics ?? new RuleTactics();
  const voice = opts.voice ?? new RuleCombatVoice();
  const leaders = opts.leaders ?? [null, null];
  const teams = sides[0].length > 1 || sides[1].length > 1;
  const maxFrames = opts.maxFrames ?? (teams ? 150 : 90) * FPS;
  const events: FightEvent[] = [];
  const n = (id: string) => nameOf(state, id);

  const ids = [...sides[0], ...sides[1]];
  const fighter = new Map(ids.map((id) => [id, getFighter(state, id)]));
  const F = (id: FighterId) => fighter.get(id)!;

  const combatants: Combatant[] = [];
  for (const side of [0, 1] as const) {
    const team = sides[side];
    team.forEach((id, k) => {
      const f = F(id);
      const feelings = startingFeelings(f, sides[1 - side]!);
      const hp = maxHp(f.def.body);
      combatants.push({
        id,
        side,
        out: false,
        target: null,
        mode: 'engage',
        influences: [],
        x: side === 0 ? -START_GAP / 2 : START_GAP / 2,
        z: (k - (team.length - 1) / 2) * LANE_SPACING,
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
        // Feeling each other out: the eager go first, the careful watch a moment.
        nextThink: Math.round(10 * (1 - unit(f.temperament.aggression)) + 10 * unit(f.temperament.discipline)),
        reactedTo: -1,
        stats: emptyStats(),
      });
    });
  }
  const byId = new Map(combatants.map((c) => [c.id, c]));
  const C = (id: FighterId) => byId.get(id)!;

  // Before the bell: who says what, and who takes it to heart.
  const speech: SpeechAct[] = teams ? voice.pregame({ state, sides, leaders }) : [];
  absorb(state, speech, leaders, combatants);
  for (const act of speech) {
    if (act.text) events.push({ frame: 0, type: 'speech', attacker: act.speaker, text: `${n(act.speaker)}: "${act.text}"` });
  }

  const damage: Record<FighterId, Record<FighterId, number>> = {};
  const kos: FightResult['kos'] = [];
  const rescues: Rescue[] = [];

  const opponentsOf = (c: Combatant) => combatants.filter((o) => o.side !== c.side);
  const alliesOf = (c: Combatant) => combatants.filter((o) => o.side === c.side);

  const view = (c: Combatant, frame: number): CombatView | null => {
    if (!c.target) return null;
    const o = C(c.target);
    // A preoccupied fighter misjudges range: they think the opponent is closer than they are.
    const misjudge = 1 - 0.2 * (1 - clamp01(F(c.id).state.focus));
    return { frame, me: c, meFighter: F(c.id), opponent: o, opponentFighter: F(o.id), distance: dist(c, o) * misjudge, mode: c.mode };
  };

  const free = (c: Combatant, frame: number) =>
    frame >= c.action.endFrame || c.action.kind === 'idle' || c.action.kind === 'advance' || c.action.kind === 'retreat' || c.action.kind === 'guard';

  const start = (c: Combatant, d: CombatDecision, frame: number) => {
    switch (d.kind) {
      case 'attack': {
        const m = MOVES[d.move];
        c.stamina -= m.stamina;
        c.stats.attempts[d.move] = (c.stats.attempts[d.move] ?? 0) + 1;
        c.action = { kind: 'attack', move: d.move, startFrame: frame, endFrame: frame + m.startup + m.active + m.recovery, ...(c.target ? { target: c.target } : {}) };
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
  let winningSide: 0 | 1 | null = null;
  let method: FightResult['method'] = 'decision';

  for (; frame < maxFrames; frame++) {
    const live = combatants.filter((c) => !c.out);

    // Finish actions.
    for (const c of live) {
      if (frame < c.action.endFrame) continue;
      if (c.action.kind === 'stance' && c.action.toStance) {
        c.stance = c.action.toStance;
        events.push({ frame, type: 'stance', attacker: c.id, text: `${n(c.id)} drops into a ${c.stance} stance.` });
      }
      if (c.action.kind === 'down') c.balance = 100;
      c.action = { kind: 'idle', startFrame: frame, endFrame: frame };
    }

    // Reactions to attacks seen coming.
    for (const c of live) {
      for (const o of opponentsOf(c)) {
        if (o.out || o.action.kind !== 'attack' || o.action.resolved || o.action.target !== c.id) continue;
        if (c.reactedTo === o.action.startFrame || frame - o.action.startFrame < c.reactionDelay || !free(c, frame)) continue;
        c.reactedTo = o.action.startFrame;
        const v: CombatView = { frame, me: c, meFighter: F(c.id), opponent: o, opponentFighter: F(o.id), distance: dist(c, o), mode: 'engage' };
        const r = policy.react(v, o.action.move!);
        const until = o.action.startFrame + MOVES[o.action.move!].startup + MOVES[o.action.move!].active;
        if (r.kind === 'block') c.action = { kind: 'guard', startFrame: frame, endFrame: until + 1 };
        else if (r.kind === 'backstep') c.action = { kind: 'retreat', startFrame: frame, endFrame: until + 1 };
        else if (r.kind === 'counter') {
          c.target = o.id;
          start(c, { kind: 'attack', move: r.move }, frame);
        }
      }
    }

    // Decisions: first whom (and how), then what.
    for (const c of live) {
      if (!free(c, frame) || frame < c.nextThink) continue;
      if (c.action.kind !== 'idle' && frame < c.action.endFrame) continue;
      const choice = tactics.choose({ state, frame, me: c, allies: alliesOf(c), opponents: opponentsOf(c), damage });
      if (!choice) continue;
      if (choice.target !== c.target || choice.mode !== c.mode) {
        if (teams && c.target !== null) {
          const verb = choice.mode === 'hover' ? 'hangs back near' : 'goes after';
          events.push({ frame, type: 'switch', attacker: c.id, defender: choice.target, text: `${n(c.id)} ${verb} ${n(choice.target)} (${choice.why.replace(/^protect:(\w+)/, (_, a: string) => `to protect ${n(a)}`)}).` });
        }
        if (choice.protecting && choice.mode === 'engage' && C(choice.target).target === choice.protecting) {
          rescues.push({ frame, by: c.id, of: choice.protecting, from: choice.target });
          events.push({ frame, type: 'rescue', attacker: c.id, defender: choice.target, text: `${n(c.id)}: "Hang on, ${n(choice.protecting)}!"` });
        }
        c.target = choice.target;
        c.mode = choice.mode;
      }
      const v = view(c, frame);
      if (!v) continue;
      start(c, policy.decide(v), frame);
      // A preoccupied mind decides more slowly.
      const ft = F(c.id).temperament;
      c.nextThink = frame + thinkInterval(ft.discipline, ft.aggression);
    }

    // Movement in the arena plane.
    for (const c of live) {
      if (!c.target || (c.action.kind !== 'advance' && c.action.kind !== 'retreat')) continue;
      const o = C(c.target);
      const d = dist(c, o) || 1;
      const speed = walkSpeed(F(c.id).def.body) * (c.stance === 'crouched' ? 0.5 : 1);
      const sign = c.action.kind === 'advance' ? 1 : -1;
      c.x = clamp(c.x + (sign * speed * (o.x - c.x)) / d, -ARENA_HALF_WIDTH, ARENA_HALF_WIDTH);
      c.z = clamp(c.z + (sign * speed * (o.z - c.z)) / d, -ARENA_HALF_DEPTH, ARENA_HALF_DEPTH);
    }
    // Bodies don't overlap.
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const a = live[i]!;
        const b = live[j]!;
        const minGap = radius(F(a.id).def.body) + radius(F(b.id).def.body);
        const d = dist(a, b);
        if (d >= minGap) continue;
        const push = (minGap - d) / 2;
        const ux = d > 0 ? (b.x - a.x) / d : a.side === 0 ? 1 : -1;
        const uz = d > 0 ? (b.z - a.z) / d : 0;
        a.x -= ux * push;
        a.z -= uz * push;
        b.x += ux * push;
        b.z += uz * push;
      }
    }

    // Strikes: resolve against the state at the start of this step so trades are fair.
    const contacts: { c: Combatant; o: Combatant; move: MoveId; quality: ContactQuality; region?: string; whiff?: WhiffReason }[] = [];
    for (const c of live) {
      if (c.action.kind !== 'attack' || c.action.resolved || !c.action.target) continue;
      const m = MOVES[c.action.move!];
      const activeStart = c.action.startFrame + m.startup;
      const activeEnd = activeStart + m.active;
      if (frame < activeStart || frame >= activeEnd) continue;
      const o = C(c.action.target);
      if (o.out) {
        c.action.resolved = true;
        continue;
      }
      const geo = geometricContact(F(c.id).def.body, c.stance, F(o.id).def.body, o.stance, m, dist(c, o));
      if (geo.quality === 'whiff') {
        if (frame === activeEnd - 1) contacts.push({ c, o, move: m.id, quality: 'whiff', ...(geo.whiff ? { whiff: geo.whiff } : {}) });
        continue;
      }
      const guarding = o.action.kind === 'guard' && frame < o.action.endFrame;
      const blocked = guarding && geo.region !== undefined && guardCovers(o.stance, geo.region, m);
      contacts.push({ c, o, move: m.id, quality: blocked ? 'blocked' : geo.quality, ...(geo.region ? { region: geo.region } : {}) });
    }

    for (const contact of contacts) {
      const { c, o } = contact;
      const me = F(c.id);
      const them = F(o.id);
      // Trades: both strikes were already in flight, even if this attacker just got hit.
      const m = MOVES[contact.move];
      if (c.action.kind === 'attack') c.action.resolved = true;
      const q = contact.quality;
      c.stats.outcomes[q]++;
      const byMove = (c.stats.byMove[m.id] ??= { clean: 0, glancing: 0, blocked: 0, whiff: 0 });
      byMove[q]++;
      if (opts.learn !== false) {
        learn(me.combat, me.temperament, m.id, o.stance, q);
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
      const dmg = m.damage * DAMAGE_MULT[q] * strength * (contact.region === 'head' ? 1.2 : 1);
      o.hp = Math.max(0, o.hp - dmg);
      c.stats.damageDealt += dmg;
      o.stats.damageTaken += dmg;
      (damage[c.id] ??= {})[o.id] = (damage[c.id]?.[o.id] ?? 0) + dmg;
      const d = dist(c, o) || 1;
      const ux = (o.x - c.x) / d;
      const uz = (o.z - c.z) / d;
      const massRatio = me.def.body.massKg / them.def.body.massKg;
      const push = q === 'blocked' ? 0.3 : q === 'clean' ? 1 : 0.4;
      o.x = clamp(o.x + ux * m.knockback * push * massRatio, -ARENA_HALF_WIDTH, ARENA_HALF_WIDTH);
      o.z = clamp(o.z + uz * m.knockback * push * massRatio, -ARENA_HALF_DEPTH, ARENA_HALF_DEPTH);
      if (q === 'blocked') {
        o.stats.blocks++;
        o.action = { kind: 'guard', startFrame: frame, endFrame: frame + m.blockstun };
      } else {
        o.balance -= m.balanceDamage * (q === 'clean' ? 1 : 0.4) * massRatio;
        // Heavier hitters rock you for longer.
        const stun = Math.round((q === 'clean' ? m.hitstun : m.hitstun / 2) * (0.7 + 0.3 * massRatio));
        o.action = { kind: 'stagger', startFrame: frame, endFrame: frame + stun };
        // How getting hit feels depends on who you are.
        const ot = them.temperament;
        const hurt = dmg / 20;
        o.fear = clamp01(o.fear + hurt * (1 - unit(ot.courage)));
        o.rage = clamp01(o.rage + hurt * (0.5 * unit(ot.aggression) + 0.5 * unit(ot.volatility)));
        c.fear = clamp01(c.fear - hurt * 0.3);
        // Watching someone you care about take a beating.
        for (const ally of alliesOf(o)) {
          if (ally === o || ally.out) continue;
          const care = Math.max(0, bond(state, ally.id, o.id));
          ally.rage = clamp01(ally.rage + (dmg / 40) * care * (0.5 + unit(F(ally.id).temperament.loyalty)));
        }
      }
      events.push({
        frame,
        type: 'contact',
        attacker: c.id,
        defender: o.id,
        move: m.id,
        quality: q,
        damage: dmg,
        ...(contact.region ? { region: contact.region as 'head' | 'torso' | 'legs' } : {}),
        text: `${n(c.id)}'s ${m.name} ${q === 'blocked' ? 'is blocked by' : q === 'glancing' ? 'glances off' : 'lands on'} ${n(o.id)}${contact.region && q !== 'blocked' ? ` (${contact.region})` : ''}.`,
      });

      if (o.hp <= 0 && !o.out) {
        o.out = true;
        o.action = { kind: 'down', startFrame: frame, endFrame: Number.MAX_SAFE_INTEGER };
        kos.push({ of: o.id, by: c.id, frame });
        events.push({ frame, type: 'ko', attacker: c.id, defender: o.id, text: `${n(o.id)} is knocked out by ${n(c.id)}!` });
        for (const x of combatants) if (x.target === o.id) x.target = null;
      } else if (o.balance <= 0) {
        o.stats.knockdowns++;
        o.action = { kind: 'down', startFrame: frame, endFrame: frame + KNOCKDOWN_FRAMES };
        events.push({ frame, type: 'knockdown', attacker: c.id, defender: o.id, text: `${n(o.id)} goes down!` });
      }
    }

    // Stamina and footing recover when not exerting; crouch time is tracked for stats.
    for (const c of combatants) {
      if (c.out) continue;
      if (c.stance === 'crouched') c.stats.framesCrouched++;
      c.impatience = Math.min(1, c.impatience + (0.5 + unit(F(c.id).temperament.aggression)) / (10 * FPS));
      const resting = c.action.kind === 'idle' || c.action.kind === 'guard' || c.action.kind === 'taunt';
      c.stamina = Math.min(100, c.stamina + (resting ? 0.6 : 0.25));
      if (c.action.kind !== 'stagger' && c.action.kind !== 'down') c.balance = Math.min(100, c.balance + 0.4);
    }

    const standing = [0, 1].map((s) => combatants.some((c) => c.side === s && !c.out));
    if (!standing[0] || !standing[1]) {
      winningSide = standing[0] ? 0 : standing[1] ? 1 : null;
      method = 'ko';
      frame++;
      break;
    }
  }

  if (method !== 'ko') {
    const score = [0, 1].map((s) =>
      combatants.filter((c) => c.side === s).reduce((sum, c) => sum + c.hp / c.maxHp, 0) / sides[s]!.length,
    );
    winningSide = score[0]! > score[1]! ? 0 : score[1]! > score[0]! ? 1 : null;
    method = winningSide === null ? 'draw' : 'decision';
    events.push({ frame, type: 'time', text: winningSide === null ? 'Time! A draw.' : `Time! ${sides[winningSide].map(n).join(', ')} win on points.` });
  } else if (winningSide !== null) {
    events.push({ frame, type: 'time', text: `${sides[winningSide].map(n).join(', ')} win${sides[winningSide].length === 1 ? 's' : ''}!` });
  }

  return {
    winner: winningSide === null ? null : sides[winningSide][0]!,
    winningSide,
    sides,
    method,
    frames: frame,
    events,
    kos,
    rescues,
    speech,
    damage,
    stats: Object.fromEntries(combatants.map((c) => [c.id, c.stats])),
    finalHp: Object.fromEntries(combatants.map((c) => [c.id, c.hp])),
  };
}
