import type { Scenario } from '../sim/scenario';
import { makeTemperament } from '../temperament';
import type { FighterDef } from '../types';

/** A gym full of contrasting builds and temperaments for arena testing. */
export const SPARRING_FIGHTERS: FighterDef[] = [
  {
    id: 'brick',
    name: 'Brick',
    body: { heightCm: 196, massKg: 122 },
    temperament: makeTemperament({ aggression: 0.7, courage: 0.7, discipline: -0.3, ego: 0.8, volatility: 0.4, curiosity: -0.4 }),
    skills: { cooking: 0.3 },
    bedroomId: 'bed_brick',
  },
  {
    id: 'shell',
    name: 'Shell',
    body: { heightCm: 172, massKg: 72 },
    temperament: makeTemperament({ aggression: -0.3, courage: -0.2, discipline: 0.8, ego: -0.3, volatility: -0.5, curiosity: 0.5, pragmatism: 0.6 }),
    skills: { cooking: 0.6 },
    bedroomId: 'bed_shell',
  },
  {
    id: 'wren',
    name: 'Wren',
    body: { heightCm: 154, massKg: 51 },
    temperament: makeTemperament({ aggression: 0.3, courage: 0.4, discipline: 0.4, ego: 0, volatility: 0, curiosity: 0.9 }),
    skills: { cooking: 0.5 },
    bedroomId: 'bed_wren',
  },
  {
    id: 'duke',
    name: 'Duke',
    body: { heightCm: 186, massKg: 88 },
    temperament: makeTemperament({ aggression: 0.5, courage: 0.6, discipline: 0.1, ego: 0.9, volatility: 0.2, curiosity: -0.6 }),
    skills: { cooking: 0.2 },
    bedroomId: 'bed_duke',
  },
];

export function sparringGym(): Scenario {
  return {
    name: 'sparring gym',
    layout: {
      rooms: [
        ...SPARRING_FIGHTERS.map((f) => ({ id: f.bedroomId, kind: 'bedroom' as const, name: `${f.name}'s room` })),
        { id: 'kitchen', kind: 'kitchen', name: 'kitchen' },
        { id: 'gym', kind: 'gym', name: 'gym' },
      ],
    },
    fighters: SPARRING_FIGHTERS,
    kitchens: { kitchen: { cooks: ['shell'] } },
  };
}
