/**
 * Cognition seams.
 *
 * Every place where a fighter *thinks* — how an event feels, what to do next,
 * whom to talk to, what conclusions to draw, what a sentence means — goes
 * through one of these interfaces. Today each has a rule-based implementation.
 * As models and hardware allow, any of them can be swapped for a richer mind
 * (e.g. an LLM) without touching the rest of the simulation.
 *
 * DETERMINISM CONTRACT
 * --------------------
 * Providers called inside `Simulation.step` must be pure functions of their
 * inputs. A non-deterministic mind (LLM, remote service, human) must not be
 * called from inside the step. Instead it runs outside the simulation and acts
 * through journaled `Input`s:
 *
 *   - `coach_utterance` carries the raw text *and* an optional pre-computed
 *     `interpretation` (e.g. from an LLM). If present, the sim uses it verbatim.
 *   - `intent` lets an external mind push goals onto a fighter
 *     ("seek Martha", "avoid Jin").
 *
 * Because inputs are journaled with their tick, every run — including ones with
 * LLM-driven minds — replays bit-for-bit from `scenario + journal`.
 */

import type { EmotionVector } from '../emotion';
import type { Topic } from '../sim/conversation';
import type {
  Activity,
  Belief,
  Conversation,
  Pastime,
  EntityId,
  FighterId,
  Memory,
  Message,
  MemorySource,
  RelDelta,
  RoomId,
  SimState,
  UtteranceInterpretation,
  WorldEvent,
} from '../types';

// ---------------------------------------------------------------- appraisal

export interface AppraisalContext {
  state: SimState;
  perceiver: FighterId;
  event: WorldEvent;
  source: MemorySource;
  /** 0..1; < 1 for things heard second-hand. */
  confidence: number;
  teller?: FighterId;
}

export interface Appraisal {
  emotions: EmotionVector;
  /** 0..1 — how much this matters to the perceiver. */
  importance: number;
  /** Relationship changes caused by this appraisal (already scaled). */
  deltas: RelDelta[];
  tags: string[];
  /** Needs this experience fed (admiration feeds esteem; romance feeds intimacy). */
  needs?: Partial<Record<'esteem' | 'intimacy' | 'social', number>>;
}

/** Turns an objective event into a subjective experience. */
export interface Appraiser {
  readonly id: string;
  appraise(ctx: AppraisalContext): Appraisal;
}

// ---------------------------------------------------------------- planning

export interface ActivityChoice {
  activity: Activity;
  location: RoomId;
  pastime?: Pastime;
  /** How much the fighter wanted this, as they weighed it. */
  utility?: number;
  /** Human-readable explanation for "why?" tooling. */
  reason: string;
  visitTarget?: FighterId;
}

export interface ActivityContext {
  state: SimState;
  fighter: FighterId;
  /** Where each other fighter is expected to be this slot. */
  expected: Record<FighterId, RoomId>;
}

/** Decides what a fighter does with this half-hour at home. */
export interface ActivityPolicy {
  readonly id: string;
  choose(ctx: ActivityContext): ActivityChoice;
}

// ---------------------------------------------------------------- social

export type InteractionKind =
  | 'chat'
  | 'flirt'
  | 'ask_out'
  | 'affection_display'
  | 'gossip'
  | 'comfort'
  | 'apologize'
  | 'confront'
  | 'show_off';

export interface InteractionChoice {
  kind: InteractionKind;
  target: FighterId;
  utility: number;
  /** For gossip: the event being passed on. */
  aboutEventId?: string;
}

export type ConfrontationResponse = 'walked_away' | 'argued_back' | 'fought_back';

/** Decides whether and how a fighter engages someone in the same room, and how they respond. */
export interface InteractionPolicy {
  readonly id: string;
  choose(state: SimState, actor: FighterId, present: FighterId[]): InteractionChoice | null;
  /** Does the confronter go straight to violence? */
  strikesFirst(state: SimState, initiator: FighterId, target: FighterId): boolean;
  respondToConfrontation(state: SimState, target: FighterId, initiator: FighterId): ConfrontationResponse;
  acceptsApology(state: SimState, target: FighterId, actor: FighterId): boolean;
  /** Says yes to being asked out? */
  acceptsAdvance(state: SimState, target: FighterId, actor: FighterId): boolean;
}

// ---------------------------------------------------------------- reflection

export type BeliefCandidate = Omit<Belief, 'formedAt' | 'updatedAt'>;

/** Nightly consolidation: patterns in memories become beliefs (which may be wrong). */
export interface Reflector {
  readonly id: string;
  reflect(state: SimState, fighter: FighterId): BeliefCandidate[];
}

// ---------------------------------------------------------------- language

export interface UtteranceContext {
  state: SimState;
  speaker: EntityId;
  /** Who can hear it. */
  audience: FighterId[];
  /** Who the speaker is facing / who is fighting right now, if anyone. */
  focus: FighterId | null;
}

/** Turns raw text into structured meaning. The raw text is always kept too. */
export interface UtteranceInterpreter {
  readonly id: string;
  interpret(text: string, ctx: UtteranceContext): UtteranceInterpretation;
}

// ---------------------------------------------------------------- memory

export interface RetrievalCue {
  entities?: EntityId[];
  tags?: string[];
  /** Free text, for scorers that understand language (e.g. embeddings). */
  text?: string;
}

/**
 * Relevance of a memory to a cue, 0..1. Rule-based today (entity/tag overlap);
 * an embedding-similarity scorer can drop in for chat.
 */
export interface RelevanceScorer {
  readonly id: string;
  score(memory: Memory, cue: RetrievalCue): number;
}

/** Renders events as natural language (UI, memories, LLM context). */
export interface Narrator {
  readonly id: string;
  describe(event: Omit<WorldEvent, 'gloss'>, state: SimState): string;
}

// ---------------------------------------------------------------- voice

export interface DiaryDraft {
  text: string;
  /** Conversations the entry mentions, so the player can replay them. */
  refs?: string[];
}

/** Writes a fighter's nightly journal entry, from what happened and how they feel. */
export interface Diarist {
  readonly id: string;
  write(state: SimState, fighter: FighterId, since: number): DiaryDraft | null;
}

export interface LineContext {
  state: SimState;
  conversation: Conversation;
  speaker: FighterId;
  listener: FighterId;
  moment: 'open' | 'share' | 'reply' | 'small_talk' | 'small_reply' | 'close' | 'brush_off';
  topic?: Topic;
  pastime?: Pastime | null;
}

/** Writes what people actually say in conversation. A prime spot for an LLM. */
export interface Conversationalist {
  readonly id: string;
  line(ctx: LineContext): string;
}

export type MessageDraft = Omit<Message, 'id' | 'tick' | 'from'>;

/** Decides whether a fighter writes to the manager, and what they say. */
export interface Correspondent {
  readonly id: string;
  compose(state: SimState, fighter: FighterId): MessageDraft[];
}

export interface CognitionProviders {
  appraiser: Appraiser;
  activity: ActivityPolicy;
  interaction: InteractionPolicy;
  reflector: Reflector;
  utterance: UtteranceInterpreter;
  relevance: RelevanceScorer;
  narrator: Narrator;
  diarist: Diarist;
  correspondent: Correspondent;
  conversationalist: Conversationalist;
}
