import type { MoveDef, MoveId } from './types';

/**
 * The shared move list. Every fighter has a punch; what differs is where it
 * lands — a straight punch travels at the attacker's shoulder height, so it can
 * sail over someone who fights crouched. Crouching limits you to short punches,
 * uppercuts and sweeps.
 */
export const MOVES: Record<MoveId, MoveDef> = {
  jab: {
    id: 'jab', name: 'jab', from: ['upright', 'crouched'],
    startup: 4, active: 2, recovery: 8,
    reach: 0.42, yLo: 0.78, yHi: 0.88,
    damage: 4, stamina: 3, hitstun: 10, blockstun: 6, knockback: 8, balanceDamage: 2,
  },
  cross: {
    id: 'cross', name: 'straight right', from: ['upright'],
    startup: 7, active: 3, recovery: 14,
    reach: 0.46, yLo: 0.76, yHi: 0.86,
    damage: 9, stamina: 6, hitstun: 16, blockstun: 9, knockback: 18, balanceDamage: 5,
  },
  hook: {
    id: 'hook', name: 'hook', from: ['upright'],
    startup: 9, active: 3, recovery: 16,
    reach: 0.36, yLo: 0.7, yHi: 0.9,
    damage: 12, stamina: 8, hitstun: 18, blockstun: 10, knockback: 14, balanceDamage: 8,
  },
  uppercut: {
    id: 'uppercut', name: 'uppercut', from: ['upright', 'crouched'],
    startup: 10, active: 3, recovery: 20,
    reach: 0.3, yLo: 0.35, yHi: 0.78,
    damage: 13, stamina: 9, hitstun: 22, blockstun: 10, knockback: 20, balanceDamage: 12,
  },
  body_blow: {
    id: 'body_blow', name: 'body blow', from: ['upright', 'crouched'],
    startup: 8, active: 3, recovery: 14,
    reach: 0.38, yLo: 0.5, yHi: 0.64,
    damage: 8, stamina: 6, hitstun: 16, blockstun: 8, knockback: 10, balanceDamage: 4,
  },
  low_kick: {
    id: 'low_kick', name: 'low kick', from: ['upright', 'crouched'],
    startup: 9, active: 3, recovery: 16,
    reach: 0.55, yLo: 0.08, yHi: 0.28,
    damage: 7, stamina: 6, hitstun: 14, blockstun: 8, knockback: 6, balanceDamage: 14,
  },
  roundhouse: {
    id: 'roundhouse', name: 'roundhouse kick', from: ['upright'],
    startup: 14, active: 4, recovery: 22,
    reach: 0.6, yLo: 0.68, yHi: 0.9,
    damage: 14, stamina: 12, hitstun: 24, blockstun: 12, knockback: 30, balanceDamage: 14,
  },
  overhead: {
    id: 'overhead', name: 'hammer fist', from: ['upright'],
    startup: 16, active: 3, recovery: 20,
    reach: 0.38, yLo: 0.45, yHi: 0.98,
    damage: 12, stamina: 9, hitstun: 20, blockstun: 10, knockback: 10, balanceDamage: 10,
    overhead: true,
  },
  throw: {
    id: 'throw', name: 'throw', from: ['upright'],
    startup: 8, active: 2, recovery: 26,
    reach: 0.28, yLo: 0.3, yHi: 0.9,
    damage: 14, stamina: 12, hitstun: 30, blockstun: 0, knockback: 60, balanceDamage: 30,
    grab: true,
  },
};

export const MOVE_IDS = Object.keys(MOVES) as MoveId[];
