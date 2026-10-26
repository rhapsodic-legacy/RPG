// Combat data model. The arena is 2.5D: x is left–right, z is depth (used once
// fights go 3v3), y is height. Distances are in centimetres; time is in frames
// at 30 frames per second.

import type { FighterId, SpeechKind } from '../types';

export const FPS = 30;

export type Stance = 'upright' | 'crouched';

export type MoveId =
  | 'jab'
  | 'cross'
  | 'hook'
  | 'uppercut'
  | 'body_blow'
  | 'low_kick'
  | 'roundhouse'
  | 'overhead'
  | 'throw';

export interface MoveDef {
  id: MoveId;
  name: string;
  startup: number;
  active: number;
  recovery: number;
  /** Horizontal reach as a fraction of the attacker's height. */
  reach: number;
  /** Vertical band the strike travels through, as fractions of the attacker's current height. */
  yLo: number;
  yHi: number;
  damage: number;
  stamina: number;
  hitstun: number;
  blockstun: number;
  knockback: number;
  balanceDamage: number;
  /** Comes down from above: beats a crouching guard. */
  overhead?: boolean;
  /** A grab: can't be blocked, but needs the strength to move the opponent. */
  grab?: boolean;
  /** Stances this move can be thrown from. */
  from: Stance[];
}

/**
 * How a strike connected. Decided by geometry and guard, never by dice.
 *  clean    — solid contact
 *  glancing — partial contact (edge of the body, tip of the reach)
 *  blocked  — met a guard that covers where it landed
 *  whiff    — missed entirely (out of reach, over a crouch, too heavy to throw)
 */
export type ContactQuality = 'clean' | 'glancing' | 'blocked' | 'whiff';

export type Region = 'head' | 'torso' | 'legs';

export type ActionKind = 'idle' | 'advance' | 'retreat' | 'guard' | 'attack' | 'stance' | 'stagger' | 'down' | 'taunt';

export interface Action {
  kind: ActionKind;
  startFrame: number;
  endFrame: number;
  move?: MoveId;
  /** For attacks: whether the strike has already connected or missed. */
  resolved?: boolean;
  /** For stance changes: the stance being moved to. */
  toStance?: Stance;
  /** For attacks: who it's aimed at. */
  target?: FighterId;
}

/**
 * A soft pull on a fighter's choices, from something someone said (or their own
 * resolve). Weights are how much the fighter takes it to heart.
 */
export interface Influence {
  from: FighterId;
  kind: 'focus' | 'avoid' | 'morale';
  target?: FighterId;
  weight: number;
}

/** engage: fight this opponent. hover: stay near them, conserve, wait. */
export type EngageMode = 'engage' | 'hover';

export interface CombatStats {
  attempts: Partial<Record<MoveId, number>>;
  byMove: Partial<Record<MoveId, Record<ContactQuality, number>>>;
  outcomes: Record<ContactQuality, number>;
  damageDealt: number;
  damageTaken: number;
  blocks: number;
  knockdowns: number;
  framesCrouched: number;
  taunts: number;
}

export interface Combatant {
  id: FighterId;
  side: 0 | 1;
  /** Knocked out: no longer in the fight. */
  out: boolean;
  target: FighterId | null;
  mode: EngageMode;
  influences: Influence[];
  x: number;
  z: number;
  stance: Stance;
  action: Action;
  hp: number;
  maxHp: number;
  stamina: number;
  balance: number;
  /** In-fight feelings, seeded from the fighter's home state. */
  rage: number;
  fear: number;
  /** Grows while nothing lands; resets on any contact. */
  impatience: number;
  /** Frames between seeing an attack start and being able to respond. */
  reactionDelay: number;
  nextThink: number;
  /** Attacks (by start frame) already reacted to. */
  reactedTo: number;
  stats: CombatStats;
}

export interface FightEvent {
  frame: number;
  type: 'contact' | 'knockdown' | 'ko' | 'taunt' | 'stance' | 'time' | 'speech' | 'switch' | 'rescue';
  attacker?: FighterId;
  defender?: FighterId;
  move?: MoveId;
  quality?: ContactQuality;
  region?: Region;
  damage?: number;
  text: string;
}

export interface SpeechAct {
  frame: number;
  speaker: FighterId;
  audience: FighterId[];
  kind: SpeechKind;
  text: string;
  /** Who it's about (the claimed or prioritised opponent, the taunt's target...). */
  about?: FighterId;
  /** For assignments: who is being told. */
  to?: FighterId;
}

export interface Rescue {
  frame: number;
  by: FighterId;
  of: FighterId;
  from: FighterId;
}

/** One fighter's pose at one sampled frame, for replay and rendering. */
export interface TraceSample {
  x: number;
  z: number;
  stance: Stance;
  action: ActionKind;
  move?: MoveId;
  /** Frames into the current action. */
  t: number;
  hp: number;
  target: FighterId | null;
  mode: EngageMode;
  out: boolean;
}

export interface FightTrace {
  /** Frames between samples. */
  every: number;
  frames: Record<FighterId, TraceSample>[];
}

export interface FightResult {
  /** 1v1: the winner. Teams: the first fighter of the winning side. */
  winner: FighterId | null;
  winningSide: 0 | 1 | null;
  sides: [FighterId[], FighterId[]];
  kos: { of: FighterId; by: FighterId; frame: number }[];
  rescues: Rescue[];
  speech: SpeechAct[];
  /** damage[attacker][defender] */
  damage: Record<FighterId, Record<FighterId, number>>;
  method: 'ko' | 'decision' | 'draw';
  frames: number;
  events: FightEvent[];
  stats: Record<FighterId, CombatStats>;
  finalHp: Record<FighterId, number>;
  /** Present when the fight was run with `trace`. */
  trace?: FightTrace;
}

/** What a fighter has learned about their own moves, kept across fights. */
export interface CombatKnowledge {
  /** Keyed by `${move}|${opponentStance}`: expected outcome value 0..1, and sample count. */
  moves: Record<string, { expected: number; n: number }>;
  /** How much each opponent move has hurt me when it came: 0..1. */
  threats: Partial<Record<MoveId, number>>;
}
