// Who catches whose eye, and what people want most right now.
//
// Attraction is directional and personal: looks matter more to some than others,
// everyone has their own type, and character (nerve, warmth, winning) counts too.
// Needs follow Maslow: the body first, then safety, then belonging and intimacy,
// then esteem. A higher need only drives behaviour once the ones below it are met.

import { unit } from '../util/math';
import type { Fighter, FighterId, SimState } from '../types';
import { getFighter, peekRel } from '../world';
import { compatibility } from '../temperament';

export function canBeAttracted(a: Fighter, b: Fighter): boolean {
  if (a.temperament.romance < -0.5) return false;
  if (!a.def.attractedTo || !b.def.gender) return true;
  return a.def.attractedTo.includes(b.def.gender);
}

/** How much `a`'s eye is caught by `b`'s looks alone, 0..1. */
export function physicalAppeal(a: Fighter, b: Fighter): number {
  const p = a.def.prefers;
  const l = b.def.looks;
  if (!p || !l) return 0;
  let type = 0;
  let checks = 0;
  const match = (wanted: string[] | undefined, has: string) => {
    if (!wanted) return;
    checks++;
    if (wanted.includes(has)) type++;
  };
  match(p.hair, l.hair);
  match(p.hairColor, l.hairColor);
  match(p.style, l.style);
  if (p.build) {
    checks++;
    const m = b.def.body.massKg;
    if (m >= p.build[0] && m <= p.build[1]) type++;
  }
  const myType = checks ? type / checks : 0.5;
  return p.looks * (0.65 * l.attractiveness + 0.35 * myType);
}

/** Wins in the public record, 0..1 — status, for those who care. */
export function standing(state: SimState, id: FighterId): number {
  let wins = 0;
  let fights = 0;
  for (const r of state.fightRecords) {
    const side = r.sides[0].includes(id) ? 0 : r.sides[1].includes(id) ? 1 : null;
    if (side === null) continue;
    fights++;
    if (r.winningSide === side) wins++;
  }
  return fights ? (wins + 1) / (fights + 2) : 0.4;
}

/**
 * How far `from` could fall for `to` (the ceiling attraction grows toward), 0..1.
 * Without looks and preferences (older scenarios), falls back to temperament fit.
 */
export function appeal(state: SimState, from: FighterId, to: FighterId): number {
  const a = getFighter(state, from);
  const b = getFighter(state, to);
  if (!canBeAttracted(a, b)) return 0;
  const p = a.def.prefers;
  if (!p) return Math.max(0, 0.2 + 0.2 * compatibility(a.temperament, b.temperament));
  const tb = b.temperament;
  const character =
    p.confidence * 0.5 * (unit(tb.ego) + unit(tb.courage)) * 0.35 +
    p.kindness * 0.5 * (unit(tb.loyalty) + unit(tb.sociability)) * 0.35 +
    p.status * standing(state, to) * 0.35 +
    // Time they spend with me shows up in familiarity.
    p.attention * peekRel(state, from, to).familiarity * 0.35;
  return Math.max(0, Math.min(1, physicalAppeal(a, b) + character));
}

/** How satisfied the body is: food and rest. */
export function bodySettled(f: Fighter): number {
  return Math.min(f.state.needs.fullness, f.state.needs.energy) > 0.3 ? 1 : Math.min(f.state.needs.fullness, f.state.needs.energy) / 0.3;
}

/** Desire right now: unmet intimacy, scaled by how romantic they are, once the body's fed and rested. */
export function desire(f: Fighter): number {
  return (1 - f.state.needs.intimacy) * (0.4 + 0.8 * unit(f.temperament.romance)) * bodySettled(f);
}

/**
 * Hunger for recognition: unmet esteem, scaled by ego — and it only takes the
 * wheel once belonging and intimacy are reasonably met.
 */
export function ambition(f: Fighter): number {
  const belonging = Math.min(1, 0.4 + 0.6 * Math.min(f.state.needs.social, f.state.needs.intimacy));
  return (1 - f.state.needs.esteem) * (0.3 + 0.9 * unit(f.temperament.ego)) * bodySettled(f) * belonging;
}
