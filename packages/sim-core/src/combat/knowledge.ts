// Procedural memory: fighters learn what works, at a rate set by their personality.
// Curious, disciplined fighters adapt quickly; big egos keep throwing the punch
// that doesn't land.

import type { Temperament } from '../temperament';
import { clamp, unit } from '../util/math';
import type { CombatKnowledge, ContactQuality, MoveId, Stance } from './types';

/** What a fighter assumes about a move they've never tried against this kind of opponent. */
export const PRIOR_EXPECTATION = 0.6;

export const OUTCOME_VALUE: Record<ContactQuality, number> = {
  clean: 1,
  glancing: 0.4,
  blocked: 0.15,
  whiff: 0,
};

export function emptyKnowledge(): CombatKnowledge {
  return { moves: {}, threats: {} };
}

/** How dangerous I've found a move to be when it's thrown at me. */
export function threatOf(k: CombatKnowledge, move: MoveId): number {
  return k.threats[move] ?? 0.3;
}

/** Defenders learn too: being hit cleanly by a move makes you respect it. */
export function learnThreat(k: CombatKnowledge, t: Temperament, move: MoveId, quality: ContactQuality): void {
  const outcome = quality === 'clean' ? 1 : quality === 'glancing' ? 0.4 : 0;
  const current = threatOf(k, move);
  k.threats[move] = current + (outcome - current) * learningRate(t);
}

function key(move: MoveId, stance: Stance): string {
  return `${move}|${stance}`;
}

export function expectedValue(k: CombatKnowledge, move: MoveId, opponentStance: Stance): number {
  return k.moves[key(move, opponentStance)]?.expected ?? PRIOR_EXPECTATION;
}

export function learningRate(t: Temperament): number {
  return clamp(0.12 + 0.3 * unit(t.curiosity) + 0.1 * unit(t.discipline) - 0.25 * unit(t.ego), 0.03, 0.5);
}

export function learn(k: CombatKnowledge, t: Temperament, move: MoveId, opponentStance: Stance, quality: ContactQuality): void {
  const id = key(move, opponentStance);
  const entry = k.moves[id] ?? { expected: PRIOR_EXPECTATION, n: 0 };
  const rate = learningRate(t);
  entry.expected += (OUTCOME_VALUE[quality] - entry.expected) * rate;
  entry.n += 1;
  k.moves[id] = entry;
}
