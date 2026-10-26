import { cosine, valence } from '../emotion';
import type { RelevanceScorer, RetrievalCue } from '../cognition/providers';
import type { Fighter, Memory } from '../types';
import { powi } from '../util/math';
import type { Tick } from '../time';

/** Importance at or above which a memory becomes "core" (defining, never forgotten). */
export const CORE_IMPORTANCE = 0.7;
/** Memories below this importance are not stored (relationship effects still apply). */
export const MIN_STORED_IMPORTANCE = 0.08;
export const MEMORY_CAPACITY = 300;

/** Retrieval recency weighting (what comes to mind first), not forgetting: ~0.79 per day. */
export const RECENCY_DECAY = 0.995;

export const RETRIEVAL_WEIGHTS = {
  recency: 1,
  importance: 1.5,
  relevance: 1.5,
  mood: 0.5,
};

export interface ScoredMemory {
  memory: Memory;
  score: number;
  recency: number;
  relevance: number;
  moodCongruence: number;
}

export function recencyOf(memory: Memory, now: Tick): number {
  return powi(RECENCY_DECAY, now - memory.lastRecalled);
}

/**
 * Smallville-style retrieval: recency + importance + relevance, plus
 * mood-congruent recall (sad fighters remember sad things).
 */
export function retrieve(
  fighter: Fighter,
  cue: RetrievalCue,
  scorer: RelevanceScorer,
  now: Tick,
  k: number,
  opts: { touch?: boolean } = {},
): ScoredMemory[] {
  const scored = fighter.memories.map((memory) => {
    const recency = recencyOf(memory, now);
    const relevance = scorer.score(memory, cue);
    const moodCongruence = Math.max(0, cosine(fighter.state.mood, memory.emotions));
    const score =
      RETRIEVAL_WEIGHTS.recency * recency +
      RETRIEVAL_WEIGHTS.importance * memory.importance +
      RETRIEVAL_WEIGHTS.relevance * relevance +
      RETRIEVAL_WEIGHTS.mood * moodCongruence;
    return { memory, score, recency, relevance, moodCongruence };
  });
  scored.sort((a, b) => b.score - a.score || (a.memory.id < b.memory.id ? -1 : 1));
  const top = scored.slice(0, k);
  // Recalling a memory refreshes it: rumination keeps wounds fresh.
  if (opts.touch) for (const s of top) s.memory.lastRecalled = now;
  return top;
}

/** Default relevance: overlap between cue entities/tags and the memory's. */
export const overlapRelevance: RelevanceScorer = {
  id: 'rules.overlap',
  score(memory, cue) {
    const wanted = [...(cue.entities ?? []), ...(cue.tags ?? [])];
    if (wanted.length === 0) return 0;
    let hits = 0;
    for (const w of wanted) {
      if (memory.entities.includes(w) || memory.tags.includes(w)) hits++;
    }
    return hits / wanted.length;
  },
};

/** Event types worth passing on as gossip. */
export const GOSSIP_WORTHY: ReadonlySet<string> = new Set(['romance_start', 'breakup', 'brawl', 'argument']);

export function knowsEvent(fighter: Fighter, eventId: string): boolean {
  return fighter.known.includes(eventId) || fighter.memories.some((m) => m.eventId === eventId);
}

export function memoryValence(m: Memory): number {
  return valence(m.emotions);
}

/** Forget the least salient non-core memories once over capacity. */
export function pruneMemories(fighter: Fighter, now: Tick): void {
  if (fighter.memories.length <= MEMORY_CAPACITY) return;
  const keep = [...fighter.memories]
    .map((m) => ({ m, salience: m.core ? Infinity : m.importance + recencyOf(m, now) }))
    .sort((a, b) => b.salience - a.salience || (a.m.id < b.m.id ? -1 : 1))
    .slice(0, MEMORY_CAPACITY)
    .map((x) => x.m.id);
  const keepSet = new Set(keep);
  fighter.memories = fighter.memories.filter((m) => keepSet.has(m.id));
}
