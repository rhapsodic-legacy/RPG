// Open threads, preoccupation, focus and fight readiness.

import type { FighterId, SimState, Thread } from '../types';
import { clamp01 } from '../util/math';
import { bond, fighterIds, getFighter, isInjured, isShaken, nameOf, peekRel } from '../world';

/** Below this focus a fighter shows as Distracted. */
export const DISTRACTED_FOCUS = 0.6;
const MIN_THREAD_WEIGHT = 0.2;

/** Recompute a fighter's open threads from their relationships and memories. */
export function computeThreads(state: SimState, id: FighterId): Thread[] {
  const f = getFighter(state, id);
  const found: Omit<Thread, 'openedAt'>[] = [];
  const others = fighterIds(state).filter((o) => o !== id);

  for (const o of others) {
    const r = peekRel(state, id, o);
    if (r.resentment >= 0.45) found.push({ key: `feud:${o}`, kind: 'feud', about: [o], weight: r.resentment });
    if (r.labels.includes('ex') && r.attraction >= 0.35) {
      found.push({ key: `heartbreak:${o}`, kind: 'heartbreak', about: [o], weight: r.attraction * 0.8 });
    }
  }

  // Caught in the middle: two people I'm bonded to are hostile to each other.
  for (let i = 0; i < others.length; i++) {
    for (let j = i + 1; j < others.length; j++) {
      const x = others[i]!;
      const y = others[j]!;
      const bx = bond(state, id, x);
      const by = bond(state, id, y);
      if (bx < 0.35 || by < 0.35) continue;
      const hostility = Math.max(peekRel(state, x, y).resentment, peekRel(state, y, x).resentment);
      if (hostility < 0.35) continue;
      found.push({
        key: `caught:${x}|${y}`,
        kind: 'caught_in_middle',
        about: [x, y],
        weight: Math.min(bx, by) * hostility * 1.6,
      });
    }
  }

  // Guilt: memories that left me ashamed about someone, until an apology settles them.
  const guilt = new Map<FighterId, number>();
  for (const m of f.memories) {
    if (m.emotions.shame < 0.15) continue;
    for (const tag of m.tags) {
      if (!tag.startsWith('guilt:')) continue;
      const e = tag.slice('guilt:'.length);
      // An accepted apology settles earlier guilt.
      const settled = state.cooldowns[`apology_ok:${id}>${e}`];
      if (settled !== undefined && m.createdAt <= settled) continue;
      guilt.set(e, (guilt.get(e) ?? 0) + m.emotions.shame * 1.5);
    }
  }
  for (const [o, w] of [...guilt.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    found.push({ key: `guilt:${o}`, kind: 'guilt', about: [o], weight: clamp01(w) });
  }

  const previous = new Map(f.threads.map((t) => [t.key, t]));
  return found
    .filter((t) => t.weight >= MIN_THREAD_WEIGHT)
    .map((t) => ({ ...t, weight: clamp01(t.weight), openedAt: previous.get(t.key)?.openedAt ?? state.tick }))
    .sort((a, b) => b.weight - a.weight || (a.key < b.key ? -1 : 1));
}

export function composure(state: SimState, id: FighterId): number {
  const t = getFighter(state, id).temperament;
  return clamp01(0.5 + 0.3 * t.discipline - 0.3 * t.volatility);
}

export function preoccupation(state: SimState, id: FighterId): number {
  const f = getFighter(state, id);
  let load = 0;
  for (const t of f.threads) load += t.weight;
  return clamp01(load * (1 - composure(state, id)) * 0.7);
}

export function computeFocus(state: SimState, id: FighterId): number {
  const f = getFighter(state, id);
  return clamp01(1 - preoccupation(state, id) - 0.3 * (1 - f.state.needs.energy));
}

export type ReadinessStatus = 'available' | 'injured' | 'shaken' | 'distracted';

export interface Readiness {
  fighter: FighterId;
  status: ReadinessStatus;
  focus: number;
  reasons: string[];
}

/** Pre-fight state: what the home week hands to the arena. */
export function readiness(state: SimState, id: FighterId): Readiness {
  const f = getFighter(state, id);
  const focus = f.state.focus;
  const reasons = f.threads.map((t) => describeThread(state, t));
  let status: ReadinessStatus = 'available';
  if (isInjured(f, state.tick)) status = 'injured';
  else if (isShaken(f, state.tick)) status = 'shaken';
  else if (focus < DISTRACTED_FOCUS) status = 'distracted';
  return { fighter: id, status, focus, reasons };
}

export function describeThread(state: SimState, t: Thread): string {
  const n = (id: string) => nameOf(state, id);
  const w = `(${t.weight.toFixed(2)})`;
  switch (t.kind) {
    case 'feud':
      return `feuding with ${n(t.about[0]!)} ${w}`;
    case 'heartbreak':
      return `not over ${n(t.about[0]!)} ${w}`;
    case 'caught_in_middle':
      return `caught between ${n(t.about[0]!)} and ${n(t.about[1]!)} ${w}`;
    case 'guilt':
      return `feels guilty about ${n(t.about[0]!)} ${w}`;
  }
}

