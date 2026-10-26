// Combat data model. The arena is 2.5D: x is left–right, z is depth (used once
// fights go 3v3), y is height. Distances are in centimetres; time is in frames
// at 30 frames per second.

import type { FighterId } from '../types';

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
}

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
  type: 'contact' | 'knockdown' | 'ko' | 'taunt' | 'stance' | 'time';
  attacker?: FighterId;
  defender?: FighterId;
  move?: MoveId;
  quality?: ContactQuality;
  region?: Region;
  damage?: number;
  text: string;
}

export interface FightResult {
  winner: FighterId | null;
  method: 'ko' | 'decision' | 'draw';
  frames: number;
  events: FightEvent[];
  stats: Record<FighterId, CombatStats>;
  finalHp: Record<FighterId, number>;
}

/** What a fighter has learned about their own moves, kept across fights. */
export interface CombatKnowledge {
  /** Keyed by `${move}|${opponentStance}`: expected outcome value 0..1, and sample count. */
  moves: Record<string, { expected: number; n: number }>;
  /** How much each opponent move has hurt me when it came: 0..1. */
  threats: Partial<Record<MoveId, number>>;
}
