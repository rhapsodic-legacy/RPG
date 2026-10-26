// Read/write helpers over SimState shared by every subsystem.

import type {
  EntityId,
  Fighter,
  FighterId,
  RelLabel,
  Relationship,
  RelDelta,
  Room,
  RoomKind,
  SimState,
} from './types';
import { clamp01, clampSigned } from './util/math';
import { appeal } from './home/attraction';
import { isSleepTimeFor } from './home/routine';
import type { Tick } from './time';

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function fighterIds(state: SimState): FighterId[] {
  return Object.keys(state.fighters).sort();
}

export function fighterList(state: SimState): Fighter[] {
  return fighterIds(state).map((id) => state.fighters[id]!);
}

export function getFighter(state: SimState, id: FighterId): Fighter {
  const f = state.fighters[id] ?? state.outsiders[id];
  if (!f) throw new Error(`Unknown fighter: ${id}`);
  return f;
}

export function nameOf(state: SimState, id: EntityId): string {
  if (id === 'coach') return 'Coach';
  const f = state.fighters[id] ?? state.outsiders[id];
  if (f) return f.def.name;
  const room = state.layout.rooms.find((r) => r.id === id);
  return room ? room.name : id;
}

export function roomsOfKind(state: SimState, kind: RoomKind): Room[] {
  return state.layout.rooms.filter((r) => r.kind === kind);
}

export function roomKind(state: SimState, roomId: string): RoomKind | undefined {
  return state.layout.rooms.find((r) => r.id === roomId)?.kind;
}

// ---------------------------------------------------------------- relationships

export function emptyRelationship(): Relationship {
  return {
    affection: 0,
    respect: 0,
    trust: 0,
    attraction: 0,
    resentment: 0,
    fear: 0,
    familiarity: 0,
    labels: [],
  };
}

/** Get-or-create the directed relationship from → to. */
export function rel(state: SimState, from: FighterId, to: EntityId): Relationship {
  const f = getFighter(state, from);
  let r = f.relationships[to];
  if (!r) {
    r = emptyRelationship();
    f.relationships[to] = r;
  }
  return r;
}

/** Read-only peek that does not create an entry. */
export function peekRel(state: SimState, from: FighterId, to: EntityId): Relationship {
  return (state.fighters[from] ?? state.outsiders[from])?.relationships[to] ?? emptyRelationship();
}

const SIGNED_AXES = new Set(['affection', 'respect', 'trust']);

export function applyRelDelta(state: SimState, from: FighterId, delta: RelDelta, scale = 1): void {
  if (delta.toward === from) return;
  const r = rel(state, from, delta.toward);
  for (const [axis, value] of Object.entries(delta)) {
    if (axis === 'toward' || typeof value !== 'number') continue;
    const key = axis as keyof Omit<Relationship, 'labels'>;
    // Soft saturation: the closer to the bound, the smaller the step.
    const d = value * scale;
    const current = r[key];
    const signed = SIGNED_AXES.has(axis);
    const room = d > 0 ? 1 - current : signed ? 1 + current : current;
    const next = current + d * Math.max(0, Math.min(1, room));
    r[key] = signed ? clampSigned(next) : clamp01(next);
  }
}

export function hasLabel(state: SimState, from: FighterId, to: EntityId, label: RelLabel): boolean {
  return peekRel(state, from, to).labels.includes(label);
}

export function setLabel(state: SimState, from: FighterId, to: EntityId, label: RelLabel, on: boolean): void {
  const r = rel(state, from, to);
  const has = r.labels.includes(label);
  if (on && !has) r.labels = [...r.labels, label].sort();
  if (!on && has) r.labels = r.labels.filter((l) => l !== label);
}

export function partnerOf(state: SimState, id: FighterId): FighterId | null {
  const f = getFighter(state, id);
  for (const other of Object.keys(f.relationships).sort()) {
    if (f.relationships[other]!.labels.includes('dating')) return other;
  }
  return null;
}

/** How strongly `from` is romantically attached to `to` (crush, partner, lingering ex). */
export function attachment(state: SimState, from: FighterId, to: FighterId): number {
  const r = peekRel(state, from, to);
  let a = r.attraction;
  if (r.labels.includes('dating')) a += 0.3;
  else if (r.labels.includes('ex')) a += 0.15;
  return clamp01(a);
}

/** Strongest positive bond: affection or attraction. */
export function bond(state: SimState, from: FighterId, to: FighterId): number {
  const r = peekRel(state, from, to);
  return Math.max(r.affection, attachment(state, from, to));
}

/** How far `a` could fall for `b`. Scenario overrides win; otherwise looks, type and character. */
export function chemistry(state: SimState, a: FighterId, b: FighterId): number {
  const override = state.chemistry[pairKey(a, b)];
  if (override !== undefined) return override;
  return appeal(state, a, b);
}

// ---------------------------------------------------------------- status

export function isInjured(f: Fighter, tick: Tick): boolean {
  return f.state.injuredUntil !== null && tick < f.state.injuredUntil;
}

export function isShaken(f: Fighter, tick: Tick): boolean {
  return f.state.shakenUntil !== null && tick < f.state.shakenUntil;
}

export function isAsleep(f: Fighter, tick: Tick): boolean {
  return f.state.activity === 'sleep' && isSleepTimeFor(f, tick);
}

/** Awake fighters currently in a room, sorted by id. */
export function occupants(state: SimState, roomId: string): Fighter[] {
  return fighterList(state).filter((f) => f.state.location === roomId && !isAsleep(f, state.tick));
}

/** A cooldown stamp may be in the future (e.g. a truce), which blocks until then. */
export function cooldownReady(state: SimState, key: string, ticks: number): boolean {
  const last = state.cooldowns[key];
  return last === undefined || (state.tick >= last && state.tick - last >= ticks);
}

export function touchCooldown(state: SimState, key: string): void {
  state.cooldowns[key] = state.tick;
}
