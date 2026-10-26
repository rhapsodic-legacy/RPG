// Core data model. Everything in SimState is plain JSON-serialisable data so that
// state can be snapshotted (PvP), hashed (determinism checks) and handed to
// external minds (LLMs) as context.

import type { EmotionVector } from './emotion';
import type { Temperament } from './temperament';
import type { Tick } from './time';

export type FighterId = string;
export type RoomId = string;

/** The player-as-manager. Fighters have relationships with the coach too. */
export const COACH_ID = 'coach';

/** Anything a memory can be about: a fighter, the coach, a room, a song, a food… */
export type EntityId = string;

// ---------------------------------------------------------------- house

export type RoomKind = 'bedroom' | 'kitchen' | 'gym' | 'common' | 'infirmary';

export interface Room {
  id: RoomId;
  kind: RoomKind;
  name: string;
}

export interface HouseLayout {
  rooms: Room[];
}

// ---------------------------------------------------------------- fighters

export interface Body {
  heightCm: number;
  massKg: number;
}

export interface FighterDef {
  id: FighterId;
  name: string;
  body: Body;
  temperament: Temperament;
  skills: { cooking: number };
  bedroomId: RoomId;
}

/** Need satisfaction, 0 = desperate, 1 = fully satisfied. */
export interface Needs {
  fullness: number;
  energy: number;
  social: number;
  comfort: number;
}

export type Activity = 'sleep' | 'eat' | 'cook' | 'train' | 'socialize' | 'relax' | 'recover' | 'visit';

export type RelLabel =
  | 'friend'
  | 'close_friend'
  | 'rival'
  | 'enemy'
  | 'crush'
  | 'dating'
  | 'ex';

/** Directed: Bob's view of Jin is not Jin's view of Bob. */
export interface Relationship {
  affection: number; // -1..1
  respect: number; // -1..1
  trust: number; // -1..1
  attraction: number; // 0..1
  resentment: number; // 0..1
  fear: number; // 0..1  fear or discomfort ("awkward around")
  familiarity: number; // 0..1
  labels: RelLabel[];
}

export type RelAxis = Exclude<keyof Relationship, 'labels'>;
export type RelDelta = { toward: EntityId } & Partial<Record<RelAxis, number>>;

export type MemorySource = 'witnessed' | 'told' | 'inferred';

export interface Memory {
  id: string;
  eventId: string;
  source: MemorySource;
  toldBy?: FighterId;
  confidence: number;
  emotions: EmotionVector;
  valence: number;
  importance: number;
  entities: EntityId[];
  tags: string[];
  createdAt: Tick;
  lastRecalled: Tick;
  core: boolean;
  /** Natural-language rendering, used by UI, retrieval-for-chat and LLM prompts. */
  gloss: string;
}

export type BeliefPredicate =
  | 'betrayed_me'
  | 'prefers'
  | 'is_hostile_to_me'
  | 'is_kind_to_me'
  | 'is_bad_cook'
  | 'favours';

export interface Belief {
  subject: EntityId;
  predicate: BeliefPredicate;
  object?: EntityId;
  confidence: number;
  evidence: string[]; // memory ids
  formedAt: Tick;
  updatedAt: Tick;
}

export type ThreadKind = 'feud' | 'heartbreak' | 'caught_in_middle' | 'guilt';

/** An unresolved, emotionally charged situation. Threads make fighters preoccupied. */
export interface Thread {
  key: string;
  kind: ThreadKind;
  about: EntityId[];
  weight: number;
  openedAt: Tick;
}

/**
 * A goal pushed onto a fighter from outside the rules — today from tests or the
 * player, tomorrow from an LLM "deliberation" mind.
 */
export interface Intent {
  type: 'seek' | 'avoid';
  target: FighterId;
  untilTick: Tick;
  reason?: string;
}

export interface FighterState {
  location: RoomId;
  activity: Activity;
  needs: Needs;
  mood: EmotionVector;
  injuredUntil: Tick | null;
  shakenUntil: Tick | null;
  lastMeal: string | null;
  lastVisit: Record<FighterId, number>; // day of last visit
  lastSeen: Record<FighterId, Tick>;
  focus: number;
  intents: Intent[];
  importanceSinceReflection: number;
}

export interface Fighter {
  def: FighterDef;
  /** Live temperament; drifts slowly from core memories. */
  temperament: Temperament;
  state: FighterState;
  relationships: Record<EntityId, Relationship>;
  memories: Memory[];
  /** Gossip-worthy events this fighter knows about, even ones too minor to remember. */
  known: string[];
  beliefs: Belief[];
  threads: Thread[];
}

// ---------------------------------------------------------------- events

export type EventType =
  | 'chat'
  | 'flirt'
  | 'romance_start'
  | 'affection_display'
  | 'breakup'
  | 'gossip'
  | 'argument'
  | 'brawl'
  | 'comfort'
  | 'apology'
  | 'meal'
  | 'sparring'
  | 'injury'
  | 'recovery'
  | 'visit'
  | 'coach_spoke'
  | 'reflection';

export interface UtteranceIntent {
  kind: 'encourage' | 'praise' | 'criticize' | 'command' | 'reassure' | 'question';
  target: EntityId | null;
}

/**
 * The meaning of something said. Produced by an UtteranceInterpreter — rules
 * today, an LLM later. The raw text is always kept alongside.
 */
export interface UtteranceInterpretation {
  mentions: FighterId[];
  addressee: FighterId | null;
  intents: UtteranceIntent[];
  sentiment: number; // -1..1
  confidence: number; // 0..1
  interpreter: string; // which provider produced this, for debugging/replay
}

export interface WorldEvent {
  id: string;
  tick: Tick;
  type: EventType;
  actors: FighterId[];
  targets: FighterId[];
  location: RoomId;
  intensity: number;
  public: boolean;
  /** Who perceived it first-hand. Fixed at emission time. */
  witnesses: FighterId[];
  gloss: string;
  meal?: { cook: FighterId | null; quality: number };
  gossip?: { aboutEventId: string };
  apology?: { accepted: boolean };
  injury?: { days: number; cause: string };
  utterance?: {
    text: string;
    focus: FighterId | null;
    misaddressed: boolean;
    interpretation: UtteranceInterpretation;
  };
  reflection?: { subject: EntityId; predicate: BeliefPredicate; object?: EntityId; owner: FighterId };
}

export interface KitchenConfig {
  /** Cooks in priority order; the first available one cooks. */
  cooks: FighterId[];
}

export interface SimState {
  version: 1;
  tick: Tick;
  layout: HouseLayout;
  fighters: Record<FighterId, Fighter>;
  kitchens: Record<RoomId, KitchenConfig>;
  /** Romantic chemistry per unordered pair ("a|b"); attraction grows toward it. */
  chemistry: Record<string, number>;
  events: WorldEvent[];
  nextEventId: number;
  nextMemoryId: number;
  cooldowns: Record<string, Tick>;
}
