// What fighters know about matchups: their own history with an opponent, and how
// that opponent has fared against fighters built like them. All fights are public.

import type { Body, FighterId, FightRecord, SimState } from '../types';
import { clampSigned, unit } from '../util/math';
import { getFighter } from '../world';
import { preferredStance } from './policy';

function exchange(r: FightRecord, a: FighterId, b: FighterId): number | null {
  const ab = r.damage[a]?.[b] ?? 0;
  const ba = r.damage[b]?.[a] ?? 0;
  if (ab + ba === 0) return null;
  return (ab - ba) / (ab + ba);
}

/** How alike two builds are, 0..1 (weight and height). */
export function buildSimilarity(a: Body, b: Body): number {
  return Math.max(0, 1 - Math.abs(a.massKg - b.massKg) / 35 - Math.abs(a.heightCm - b.heightCm) / 60);
}

/** Times `opponent` has beaten `me` in direct exchanges, and times I've had the better of it. */
export function headToHead(state: SimState, me: FighterId, opponent: FighterId): { won: number; lost: number } {
  let won = 0;
  let lost = 0;
  for (const r of state.fightRecords) {
    const x = exchange(r, me, opponent);
    if (x === null) continue;
    if (x > 0.1) won++;
    else if (x < -0.1) lost++;
  }
  return { won, lost };
}

/**
 * How `me` rates their chances against `opponent`, -1..1, from what they know:
 * their own exchanges with them, and how the opponent has done against people
 * built like them. Ego inflates it; timidity deflates it.
 */
export function perceivedEdge(state: SimState, me: FighterId, opponent: FighterId, judge: FighterId = me): number {
  const myBody = getFighter(state, me).def.body;
  let own = 0;
  let ownN = 0;
  let similar = 0;
  let similarW = 0;
  for (const r of state.fightRecords) {
    const direct = exchange(r, me, opponent);
    if (direct !== null) {
      own += direct;
      ownN++;
    }
    for (const other of Object.keys(r.damage)) {
      if (other === me || other === opponent) continue;
      const x = exchange(r, other, opponent);
      const body = r.bodies[other];
      if (x === null || !body) continue;
      const w = buildSimilarity(myBody, body);
      similar += x * w;
      similarW += w;
    }
  }
  let edge = 0;
  if (ownN && similarW) edge = 0.6 * (own / ownN) + 0.4 * (similar / similarW);
  else if (ownN) edge = own / ownN;
  else if (similarW) edge = similar / similarW;
  else {
    // Nothing to go on but the eye test: size matters.
    const theirs = getFighter(state, opponent).def.body.massKg;
    edge = (1.6 * (myBody.massKg - theirs)) / (myBody.massKg + theirs);
  }
  const t = getFighter(state, judge).temperament;
  // Judging yourself: ego and nerve colour it. Judging others: less so.
  const bias = judge === me ? 0.2 * (unit(t.ego) - 0.5) + 0.1 * (unit(t.courage) - 0.5) : 0;
  return clampSigned(edge + bias);
}

export function recordFight(
  state: SimState,
  id: string,
  sides: [FighterId[], FighterId[]],
  winningSide: 0 | 1 | null,
  damage: Record<FighterId, Record<FighterId, number>>,
): FightRecord {
  const bodies: Record<FighterId, Body> = {};
  for (const fid of [...sides[0], ...sides[1]]) bodies[fid] = { ...getFighter(state, fid).def.body };
  const record: FightRecord = { id, tick: state.tick, sides, winningSide, damage, bodies };
  state.fightRecords.push(record);
  return record;
}

/** Speed rank used when someone talks about "their fastest guy". */
export function speedOf(state: SimState, id: FighterId): number {
  const f = getFighter(state, id);
  return 1 / f.def.body.massKg + (preferredStance(f.temperament) === 'upright' ? 0.002 : 0);
}
