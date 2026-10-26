// Everyone's own rhythm: when they sleep, when they like to train, what they do for fun.

import type { Temperament } from '../temperament';
import { SLEEP_START_SLOT, slotOf, TICKS_PER_DAY, WAKE_SLOT, type Tick } from '../time';
import type { Fighter, Pastime, Routine } from '../types';
import { clamp01, clampSigned, unit } from '../util/math';

/** A routine for fighters who weren't given one, read off their temperament. */
export function deriveRoutine(t: Temperament): Routine {
  return {
    // Disciplined people get up early; restless, volatile ones stay up late.
    chronotype: clampSigned(0.6 * t.volatility - 0.6 * t.discipline + 0.2 * t.sociability),
    pastimes: {
      tv: clamp01(0.3 + 0.4 * (1 - unit(t.discipline)) - 0.2 * unit(t.curiosity)),
      reading: clamp01(0.2 + 0.6 * unit(t.curiosity) - 0.3 * unit(t.sociability)),
      billiards: clamp01(0.1 + 0.3 * unit(t.sociability) + 0.3 * unit(t.ego)),
      music: clamp01(0.2 + 0.3 * unit(t.volatility) + 0.1 * unit(t.romance)),
      gaming: clamp01(0.1 + 0.3 * unit(t.aggression) + 0.2 * (1 - unit(t.discipline))),
      golf: clamp01(0.1 + 0.2 * unit(t.discipline) + 0.2 * unit(t.ego)),
    },
  };
}

export function routineOf(f: Fighter): Routine {
  return f.def.routine ?? deriveRoutine(f.temperament);
}

export function enjoys(f: Fighter, p: Pastime): number {
  return routineOf(f).pastimes[p] ?? 0;
}

/** Bedtime and wake-up, shifted by up to 1.5 hours either way by chronotype. */
export function sleepWindow(f: Fighter): { start: number; wake: number } {
  const shift = Math.round(3 * routineOf(f).chronotype);
  return { start: SLEEP_START_SLOT + shift, wake: WAKE_SLOT + shift };
}

export function isSleepTimeFor(f: Fighter, tick: Tick): boolean {
  const slot = slotOf(tick);
  const { start, wake } = sleepWindow(f);
  const s = ((start % TICKS_PER_DAY) + TICKS_PER_DAY) % TICKS_PER_DAY;
  return s > wake ? slot >= s || slot < wake : slot >= s && slot < wake;
}

/** How good this hour feels for hard work, -0.25..0.25: early birds peak in the morning, owls at night. */
export function peakHours(f: Fighter, tick: Tick): number {
  const hour = slotOf(tick) / 2;
  const c = routineOf(f).chronotype;
  if (hour >= 6 && hour < 12) return -0.25 * c;
  if (hour >= 17 && hour < 23) return 0.25 * c;
  return 0;
}
