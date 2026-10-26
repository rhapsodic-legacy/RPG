import type { Scenario } from '../sim/scenario';
import { makeTemperament } from '../temperament';
import type { FighterDef, FightRecord, HouseLayout } from '../types';

/**
 * Before the love triangle: Bob, Jin and Martha are a team. Bob's long-time rival
 * Sting (from another house) has beaten him every time they've met. Sting has
 * struggled against light, disciplined fighters — fighters like Jin. A 3v3 is
 * scheduled for day 3, with Bob leading. Sting fights low and patient — the big
 * overhand swings Bob loves sail over him, and Bob is too proud to change.
 */
export const RIVAL_NIGHT_FIGHT_ID = 'night-of-rivals';

const house: FighterDef[] = [
  {
    id: 'bob',
    name: 'Bob',
    body: { heightCm: 188, massKg: 102 },
    temperament: makeTemperament({ aggression: 0.5, courage: 0.5, discipline: 0.1, ego: 0.7, loyalty: 0.5, volatility: 0.5, sociability: 0.2, curiosity: -0.2, romance: 0.3, pragmatism: -0.1 }),
    skills: { cooking: 0.85 },
    bedroomId: 'bed_bob',
  },
  {
    id: 'jin',
    name: 'Jin',
    body: { heightCm: 172, massKg: 68 },
    temperament: makeTemperament({ aggression: 0.2, courage: 0.3, discipline: 0.6, ego: -0.1, loyalty: 0.5, volatility: -0.2, sociability: 0.4, curiosity: 0.5, romance: 0.4, pragmatism: 0.7 }),
    skills: { cooking: 0.15 },
    bedroomId: 'bed_jin',
  },
  {
    id: 'martha',
    name: 'Martha',
    body: { heightCm: 165, massKg: 60 },
    temperament: makeTemperament({ aggression: 0.2, courage: 0.3, discipline: 0.2, ego: 0.1, loyalty: 0.2, volatility: 0.2, sociability: 0.6, curiosity: 0.3, romance: 0.5, pragmatism: 0.4 }),
    skills: { cooking: 0.4 },
    bedroomId: 'bed_martha',
  },
];

const rivals: FighterDef[] = [
  {
    id: 'sting',
    name: 'Sting',
    // A low, patient counter-puncher with a filthy mouth: big swings sail over him.
    body: { heightCm: 190, massKg: 96 },
    temperament: makeTemperament({ aggression: -0.3, courage: -0.3, discipline: 0.9, ego: 0.2, volatility: 0.7, curiosity: 0.2, pragmatism: 0.1 }),
    skills: { cooking: 0.2 },
    bedroomId: 'away',
  },
  {
    id: 'ox',
    name: 'Ox',
    body: { heightCm: 200, massKg: 128 },
    temperament: makeTemperament({ aggression: 0.4, courage: 0.6, discipline: 0.2, ego: 0.3, curiosity: -0.5 }),
    skills: { cooking: 0.3 },
    bedroomId: 'away',
  },
  {
    id: 'vex',
    name: 'Vex',
    body: { heightCm: 163, massKg: 57 },
    temperament: makeTemperament({ aggression: 0.5, courage: 0.4, discipline: 0.5, ego: 0.2, curiosity: 0.5 }),
    skills: { cooking: 0.3 },
    bedroomId: 'away',
  },
];

/** Past bouts: Sting beat Bob three times, and lost to two light, disciplined fighters. */
function history(): FightRecord[] {
  const bodies = {
    bob: house[0]!.body,
    sting: rivals[0]!.body,
    kenji: { heightCm: 170, massKg: 67 },
    lin: { heightCm: 167, massKg: 62 },
  };
  const bout = (id: string, tick: number, a: string, b: string, ab: number, ba: number, winningSide: 0 | 1): FightRecord => ({
    id,
    tick,
    sides: [[a], [b]],
    winningSide,
    damage: { [a]: { [b]: ab }, [b]: { [a]: ba } },
    bodies: { [a]: bodies[a as keyof typeof bodies], [b]: bodies[b as keyof typeof bodies] },
  });
  return [
    bout('past-1', -3000, 'bob', 'sting', 70, 235, 1),
    bout('past-2', -2000, 'bob', 'sting', 95, 240, 1),
    bout('past-3', -1000, 'bob', 'sting', 60, 250, 1),
    bout('past-4', -1500, 'kenji', 'sting', 215, 80, 0),
    bout('past-5', -500, 'lin', 'sting', 205, 95, 0),
  ];
}

export function rivalNight(opts: { leader?: string | null } = {}): Scenario {
  const layout: HouseLayout = {
    rooms: [
      { id: 'bed_bob', kind: 'bedroom', name: "Bob's room" },
      { id: 'bed_jin', kind: 'bedroom', name: "Jin's room" },
      { id: 'bed_martha', kind: 'bedroom', name: "Martha's room" },
      { id: 'kitchen_a', kind: 'kitchen', name: 'kitchen' },
      { id: 'gym', kind: 'gym', name: 'gym' },
      { id: 'lounge', kind: 'common', name: 'lounge' },
      { id: 'infirmary', kind: 'infirmary', name: 'infirmary' },
    ],
  };
  return {
    name: 'night of rivals',
    layout,
    fighters: house,
    outsiders: rivals,
    kitchens: { kitchen_a: { cooks: ['bob', 'martha'] } },
    relationships: [
      { from: 'bob', to: 'martha', affection: 0.6, attraction: 0.65, trust: 0.5, familiarity: 0.6, labels: ['dating'] },
      { from: 'martha', to: 'bob', affection: 0.6, attraction: 0.6, trust: 0.5, respect: 0.4, familiarity: 0.6, labels: ['dating'] },
      { from: 'bob', to: 'jin', affection: 0.6, respect: 0.5, trust: 0.6, familiarity: 0.7, labels: ['friend'] },
      { from: 'jin', to: 'bob', affection: 0.6, respect: 0.7, trust: 0.6, familiarity: 0.7, labels: ['friend'] },
      { from: 'jin', to: 'martha', affection: 0.4, trust: 0.4, familiarity: 0.5 },
      { from: 'martha', to: 'jin', affection: 0.4, trust: 0.4, respect: 0.3, familiarity: 0.5 },
      { from: 'bob', to: 'sting', resentment: 0.8, fear: 0.15, respect: 0.3, labels: ['rival'] },
      { from: 'sting', to: 'bob', resentment: 0.3, respect: -0.6 },
      { from: 'jin', to: 'sting', resentment: 0.2 },
    ],
    fightRecords: history(),
    upcoming: [
      {
        id: RIVAL_NIGHT_FIGHT_ID,
        tick: 2 * 48 + 38, // day 3, 19:00
        sides: [
          ['bob', 'jin', 'martha'],
          ['sting', 'ox', 'vex'],
        ],
        leaders: [opts.leader === undefined ? 'bob' : opts.leader, 'sting'],
        label: 'Night of Rivals',
      },
    ],
  };
}
