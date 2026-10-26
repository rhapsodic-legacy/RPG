// Home-sim time. One tick is a 30-minute slot.

export type Tick = number;

export const SLOTS_PER_DAY = 48;
export const TICKS_PER_DAY = SLOTS_PER_DAY;
export const TICKS_PER_WEEK = TICKS_PER_DAY * 7;

/** Slot at which nightly consolidation (reflection, beliefs, threads) runs: 02:00. */
export const NIGHTLY_SLOT = 4;

/** Lights out 22:00 → wake 07:00. */
export const SLEEP_START_SLOT = 44;
export const WAKE_SLOT = 14;

export type MealName = 'breakfast' | 'lunch' | 'dinner';

const MEAL_SLOTS: Record<number, MealName> = {
  15: 'breakfast',
  16: 'breakfast',
  25: 'lunch',
  26: 'lunch',
  37: 'dinner',
  38: 'dinner',
};

export function dayOf(tick: Tick): number {
  return Math.floor(tick / TICKS_PER_DAY);
}

export function slotOf(tick: Tick): number {
  return tick % TICKS_PER_DAY;
}

export function isSleepTime(tick: Tick): boolean {
  const slot = slotOf(tick);
  return slot >= SLEEP_START_SLOT || slot < WAKE_SLOT;
}

export function mealAt(tick: Tick): MealName | null {
  return MEAL_SLOTS[slotOf(tick)] ?? null;
}

/** Unique key for a single meal sitting, e.g. "3:dinner". */
export function mealKey(tick: Tick): string | null {
  const meal = mealAt(tick);
  return meal ? `${dayOf(tick)}:${meal}` : null;
}

export function formatTime(tick: Tick): string {
  const slot = slotOf(tick);
  const hh = String(Math.floor(slot / 2)).padStart(2, '0');
  const mm = slot % 2 === 0 ? '00' : '30';
  return `Day ${dayOf(tick) + 1} ${hh}:${mm}`;
}
