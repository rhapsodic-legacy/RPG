import type { FighterDef, FighterId, Intent, RoomId, ScheduledFight, UtteranceInterpretation } from '../types';
import type { Tick } from '../time';

/**
 * Everything that enters the simulation from outside: the player, tests, future
 * combat results, and future external minds (LLMs). Inputs are journaled with
 * their tick so any run can be replayed exactly.
 */
export type Input =
  | { kind: 'injure'; fighter: FighterId; days: number; cause: string }
  | {
      kind: 'coach_utterance';
      text: string;
      /** Everyone awake in this room hears it… */
      location?: RoomId;
      /** …or exactly these fighters. */
      audience?: FighterId[];
      /** Who the coach is facing (in a fight: who is fighting). */
      focus?: FighterId | null;
      /**
       * Pre-computed meaning, e.g. from an LLM running outside the sim. If
       * omitted, the in-sim interpreter is used and its result is written back
       * into the journal so replays never need to re-interpret.
       */
      interpretation?: UtteranceInterpretation;
    }
  | { kind: 'intent'; fighter: FighterId; intent: Intent }
  | { kind: 'schedule_fight'; fight: ScheduledFight }
  /** The player (or rival manager) picks who leads a side. */
  | { kind: 'set_leader'; fightId: string; side: 0 | 1; leader: FighterId | null }
  | { kind: 'set_cooks'; kitchen: RoomId; cooks: FighterId[] }
  /** A new fighter joins the house. */
  | { kind: 'recruit'; fighter: FighterDef }
  /** Who sleeps where (rooms can be shared). */
  | { kind: 'assign_bedroom'; fighter: FighterId; room: RoomId };

export interface JournalEntry {
  tick: Tick;
  input: Input;
}
