// Core data model. Everything in SimState is plain JSON-serialisable data so that
// state can be snapshotted (PvP), hashed (determinism checks) and handed to
// external minds (LLMs) as context.

import type { CombatKnowledge } from './combat/types';
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
  /** 0..1, how pleasant the room is (bedrooms: how well you sleep). Default 0.5. */
  comfort?: number;
  /** Pastimes the room offers (a TV, a billiards table, shelves of books…). */
  amenities?: Pastime[];
}

export type Pastime = 'tv' | 'reading' | 'billiards' | 'music' | 'gaming' | 'golf';

/** Pastimes you can take anywhere there's a seat. */
export const PORTABLE_PASTIMES: readonly Pastime[] = ['reading', 'music'];

/** A fighter's own rhythm: when they come alive, and what they like doing. */
export interface Routine {
  /** -1 early bird … 0 … +1 night owl. */
  chronotype: number;
  /** How much they enjoy each pastime, 0..1. */
  pastimes: Partial<Record<Pastime, number>>;
}

export interface HouseLayout {
  rooms: Room[];
}

// ---------------------------------------------------------------- fighters

export interface Body {
  heightCm: number;
  massKg: number;
}

export type Gender = 'woman' | 'man' | 'nonbinary';
export type Hair = 'curly' | 'wavy' | 'straight' | 'short' | 'shaved';
export type HairColor = 'black' | 'brown' | 'blonde' | 'red' | 'grey';
export type Style = 'flashy' | 'plain' | 'rugged' | 'elegant' | 'sporty';

/** How someone looks. */
export interface Looks {
  /** General striking-ness, 0..1. */
  attractiveness: number;
  hair: Hair;
  hairColor: HairColor;
  style: Style;
}

/** What someone is drawn to. Weights 0..1. */
export interface Preferences {
  /** How much looks matter at all. */
  looks: number;
  hair?: Hair[];
  hairColor?: HairColor[];
  style?: Style[];
  /** Builds they like, by mass range in kg. */
  build?: [number, number];
  /** Drawn to swagger and nerve. */
  confidence: number;
  /** Drawn to winners. */
  status: number;
  /** Drawn to warmth and loyalty. */
  kindness: number;
  /** Drawn to people who spend time with them — and cool on those who don't. */
  attention: number;
}

export interface FighterDef {
  id: FighterId;
  name: string;
  body: Body;
  temperament: Temperament;
  skills: { cooking: number };
  bedroomId: RoomId;
  /** If absent, derived from temperament. */
  routine?: Routine;
  gender?: Gender;
  /** Genders this person can be attracted to. */
  attractedTo?: Gender[];
  looks?: Looks;
  prefers?: Preferences;
}

/** Need satisfaction, 0 = desperate, 1 = fully satisfied. */
export interface Needs {
  fullness: number;
  energy: number;
  social: number;
  comfort: number;
  /** Enjoyment: topped up by pastimes and good company. */
  fun: number;
  /** Romantic and sexual fulfilment: desire builds like hunger, faster for the romantic. */
  intimacy: number;
  /** Recognition: wins, praise, admiration. The hungrier the ego, the faster it empties. */
  esteem: number;
}

export type Activity = 'sleep' | 'eat' | 'cook' | 'train' | 'socialize' | 'relax' | 'recover' | 'visit' | 'talk' | 'pastime';

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
  /**
   * For grievances: the fighter has since voiced it (confronted the person). The
   * resentment stays; the urge to have it out does not.
   */
  addressed?: boolean;
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

/** A private journal entry, readable by the player. */
export interface DiaryEntry {
  tick: Tick;
  text: string;
  /** Conversations this entry is about, for replaying them. */
  refs?: string[];
}

export type ConversationKind = 'chat' | 'flirt' | 'comfort' | 'gossip';

export interface Turn {
  tick: Tick;
  speaker: FighterId;
  text: string;
  /** This line shared news or feelings (as opposed to small talk). */
  shared?: boolean;
}

/** A conversation is something two people are doing together, for as long as both want to. */
export interface Conversation {
  id: string;
  participants: [FighterId, FighterId];
  kind: ConversationKind;
  location: RoomId;
  startedAt: Tick;
  endedAt?: Tick;
  endedBy?: FighterId;
  /** The other person said "not now" and it never got going. */
  declined?: boolean;
  turns: Turn[];
}

export type SuggestionKind = 'build_room' | 'second_kitchen' | 'separate_schedules' | 'change_cook' | 'talk_to';

export interface Suggestion {
  kind: SuggestionKind;
  about: EntityId[];
  text: string;
}

/** A message from a fighter to the manager. */
export interface Message {
  id: string;
  tick: Tick;
  from: FighterId;
  topic: string;
  about: EntityId[];
  subject: string;
  body: string;
  suggestions: Suggestion[];
}

export interface FighterState {
  location: RoomId;
  activity: Activity;
  /** What they're doing for fun, when activity is 'pastime'. */
  pastime: Pastime | null;
  /** The conversation they're in, if any. */
  conversation: string | null;
  /** How much they want what they're doing right now — what talking has to beat. */
  engrossed: number;
  /** Things already told to each person (memory ids), so there's only so much to say. */
  told: Record<FighterId, string[]>;
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
  /** Topics already raised with the manager, so the same letter isn't sent twice. */
  raisedTopics: string[];
}

export interface Fighter {
  def: FighterDef;
  /** Live temperament. Only changes through explicit causes (none yet). */
  temperament: Temperament;
  state: FighterState;
  relationships: Record<EntityId, Relationship>;
  memories: Memory[];
  /** Gossip-worthy events this fighter knows about, even ones too minor to remember. */
  known: string[];
  beliefs: Belief[];
  threads: Thread[];
  diary: DiaryEntry[];
  /** What this fighter has learned in the arena about their own moves. */
  combat: CombatKnowledge;
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
  | 'reflection'
  | 'speech'
  | 'match_result'
  | 'knockout'
  | 'rescue'
  | 'shared_pastime'
  | 'show_off'
  | 'first_impression'
  | 'refused_fight';

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
  /** How the target of a confrontation responded. */
  confrontation?: { response: 'walked_away' | 'argued_back' | 'fought_back' | 'struck_first' };
  apology?: { accepted: boolean };
  /** Something said before or during a fight (trash talk, a leader's address, a claim). */
  speech?: { kind: SpeechKind; text: string; about?: FighterId; to?: FighterId };
  match?: { sides: [FighterId[], FighterId[]]; winningSide: 0 | 1 | null; method: string; fightId: string };
  rescue?: { from: FighterId };
  /** For romance_start: whether the one asked said yes. */
  romance?: { accepted: boolean };
  /** Part of a conversation: its opening, a stretch of it, or a brush-off. */
  conversation?: { id: string; part: 'opening' | 'continuing' | 'brushed_off' };
  injury?: { days: number; cause: string };
  utterance?: {
    text: string;
    focus: FighterId | null;
    misaddressed: boolean;
    interpretation: UtteranceInterpretation;
  };
  reflection?: { subject: EntityId; predicate: BeliefPredicate; object?: EntityId; owner: FighterId };
}

export type SpeechKind = 'assign' | 'claim' | 'priority' | 'pep' | 'nonsense' | 'taunt' | 'bark';

/** A public record of a fight: who was there, who won, and who hurt whom. */
export interface FightRecord {
  id: string;
  tick: Tick;
  sides: [FighterId[], FighterId[]];
  winningSide: 0 | 1 | null;
  /** damage[attacker][defender] */
  damage: Record<FighterId, Record<FighterId, number>>;
  /** Builds at the time, so the record stays meaningful if fighters change or leave. */
  bodies: Record<FighterId, Body>;
}

export interface ScheduledFight {
  id: string;
  tick: Tick;
  sides: [FighterId[], FighterId[]];
  /** Who leads each side, if anyone. Set by the player (home side) or the rival manager. */
  leaders: [FighterId | null, FighterId | null];
  label?: string;
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
  /** Fighters from other houses (rivals). They remember and feel, but don't live here. */
  outsiders: Record<FighterId, Fighter>;
  fightRecords: FightRecord[];
  upcoming: ScheduledFight[];
  kitchens: Record<RoomId, KitchenConfig>;
  /** Romantic chemistry per unordered pair ("a|b"); attraction grows toward it. */
  chemistry: Record<string, number>;
  events: WorldEvent[];
  inbox: Message[];
  /** Conversations in progress. */
  conversations: Conversation[];
  /** Finished conversations from the last few days, kept so they can be replayed. */
  dialogue: Conversation[];
  nextConversationId: number;
  nextEventId: number;
  nextMemoryId: number;
  cooldowns: Record<string, Tick>;
}
