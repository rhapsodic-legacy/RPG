// Body geometry: where a fighter can be hit, given their build and stance.

import type { Body } from '../types';
import { clamp } from '../util/math';
import type { ContactQuality, MoveDef, Region, Stance } from './types';

/** A crouch lowers the whole body to this fraction of standing height. */
export const CROUCH_HEIGHT = 0.68;
/** The last part of a strike's reach only grazes. */
const TIP_FRACTION = 0.15;
/** Above this ratio of defender to attacker mass, a throw fails. */
export const MAX_THROW_MASS_RATIO = 1.35;

export function topOf(body: Body, stance: Stance): number {
  return stance === 'crouched' ? body.heightCm * CROUCH_HEIGHT : body.heightCm;
}

/** Vertical extents of each hittable region, in cm from the floor. */
export function regions(body: Body, stance: Stance): Record<Region, [number, number]> {
  const h = body.heightCm;
  if (stance === 'crouched') {
    return { legs: [0, 0.3 * h], torso: [0.3 * h, 0.55 * h], head: [0.55 * h, CROUCH_HEIGHT * h] };
  }
  return { legs: [0, 0.47 * h], torso: [0.47 * h, 0.82 * h], head: [0.82 * h, h] };
}

/** Half-width of the body; heavier builds are wider. */
export function radius(body: Body): number {
  return body.heightCm * 0.1 * (0.8 + (0.2 * body.massKg) / 75);
}

/** Walking speed, cm per frame. Heavy fighters are slower. */
export function walkSpeed(body: Body): number {
  return 4.5 * clamp(1.25 - (body.massKg - 60) / 160, 0.6, 1.3);
}

export function maxHp(body: Body): number {
  return 220 + (body.massKg - 75) * 1.0;
}

/** The vertical band a move travels through, given the attacker's build and stance. */
export function strikeBand(attacker: Body, stance: Stance, move: MoveDef): [number, number] {
  // Kicks along the floor stay low however you stand; everything else scales with your height now.
  const top = move.yHi <= 0.3 ? attacker.heightCm : topOf(attacker, stance);
  return [move.yLo * top, move.yHi * top];
}

export type WhiffReason = 'short' | 'over' | 'under' | 'too_heavy' | 'braced';

export interface Contact {
  quality: Exclude<ContactQuality, 'blocked'>;
  region?: Region;
  whiff?: WhiffReason;
}

/**
 * Pure geometry: does this strike connect, and how well? (Guards are handled
 * separately.) `distance` is between body centres.
 */
export function geometricContact(
  attacker: Body,
  attackerStance: Stance,
  defender: Body,
  defenderStance: Stance,
  move: MoveDef,
  distance: number,
): Contact {
  const reach = move.reach * attacker.heightCm + radius(defender);
  if (distance > reach) return { quality: 'whiff', whiff: 'short' };
  if (move.grab && defender.massKg > attacker.massKg * MAX_THROW_MASS_RATIO) return { quality: 'whiff', whiff: 'too_heavy' };
  // A low, braced crouch has no centre of gravity to lift.
  if (move.grab && defenderStance === 'crouched') return { quality: 'whiff', whiff: 'braced' };

  const [lo, hi] = strikeBand(attacker, attackerStance, move);
  const zones = regions(defender, defenderStance);
  let best: Region | undefined;
  let bestOverlap = 0;
  let totalOverlap = 0;
  for (const region of ['head', 'torso', 'legs'] as Region[]) {
    const [rlo, rhi] = zones[region];
    const overlap = Math.max(0, Math.min(hi, rhi) - Math.max(lo, rlo));
    totalOverlap += overlap;
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = region;
    }
  }
  if (totalOverlap <= 0 || !best) {
    return { quality: 'whiff', whiff: lo >= topOf(defender, defenderStance) ? 'over' : 'under' };
  }

  const coverage = totalOverlap / (hi - lo);
  const atTip = distance > reach * (1 - TIP_FRACTION);
  if (move.grab) return { quality: 'clean', region: 'torso' };
  return { quality: coverage >= 0.5 && !atTip ? 'clean' : 'glancing', region: best };
}

/** Does a guard in this stance cover a strike landing on this region? */
export function guardCovers(stance: Stance, region: Region, move: MoveDef): boolean {
  if (move.grab) return false;
  if (stance === 'upright') return region !== 'legs';
  return !move.overhead;
}
