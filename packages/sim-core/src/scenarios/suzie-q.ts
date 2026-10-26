// A ten-fighter house. On day 1 the manager signs a cheap unknown off the gym
// board: Suzie Q. Nothing about what follows is scripted.

import { generateFighter } from '../content/generate';
import type { Input } from '../sim/inputs';
import type { Scenario } from '../sim/scenario';
import { makeTemperament } from '../temperament';
import type { Tick } from '../time';
import type { FighterDef, FightRecord } from '../types';

const core: FighterDef[] = [
  {
    id: 'bob',
    name: 'Bob',
    body: { heightCm: 188, massKg: 102 },
    // An ego bigger than the moon: glory first, women second.
    temperament: makeTemperament({ aggression: 0.5, courage: 0.6, discipline: 0.2, ego: 0.95, loyalty: 0.3, volatility: 0.5, sociability: 0.2, romance: 0.2, pragmatism: 0 }),
    skills: { cooking: 0.8 },
    bedroomId: 'bed_bob',
    routine: { chronotype: 0.3, pastimes: { billiards: 0.9, golf: 0.5 } },
    gender: 'man',
    attractedTo: ['woman'],
    looks: { attractiveness: 0.6, hair: 'short', hairColor: 'brown', style: 'rugged' },
    prefers: { looks: 0.6, confidence: 0.3, status: 0.2, kindness: 0.2, attention: 0.2 },
  },
  {
    id: 'jin',
    name: 'Jin',
    body: { heightCm: 174, massKg: 70 },
    // Hot-blooded; only being with Martha holds him back.
    temperament: makeTemperament({ aggression: 0.3, courage: 0.3, discipline: 0.3, ego: 0.2, loyalty: 0.3, volatility: 0.3, sociability: 0.5, curiosity: 0.4, romance: 0.9, pragmatism: 0.4 }),
    skills: { cooking: 0.2 },
    bedroomId: 'bed_jin',
    routine: { chronotype: 0.2, pastimes: { tv: 0.8, gaming: 0.6 } },
    gender: 'man',
    attractedTo: ['woman'],
    looks: { attractiveness: 0.7, hair: 'straight', hairColor: 'black', style: 'sporty' },
    prefers: { looks: 0.85, hair: ['curly', 'wavy'], style: ['flashy', 'elegant'], confidence: 0.3, status: 0.1, kindness: 0.4, attention: 0.3 },
  },
  {
    id: 'martha',
    name: 'Martha',
    body: { heightCm: 166, massKg: 61 },
    temperament: makeTemperament({ aggression: 0.2, courage: 0.3, discipline: 0.2, ego: 0.5, loyalty: 0.4, volatility: 0.4, sociability: 0.6, curiosity: 0.3, romance: 0.5, pragmatism: 0.3 }),
    skills: { cooking: 0.5 },
    bedroomId: 'bed_martha',
    routine: { chronotype: 0.4, pastimes: { tv: 0.9, music: 0.5 } },
    gender: 'woman',
    attractedTo: ['man'],
    looks: { attractiveness: 0.75, hair: 'curly', hairColor: 'brown', style: 'elegant' },
    // She likes men who spend their time with her.
    prefers: { looks: 0.4, confidence: 0.3, status: 0.2, kindness: 0.5, attention: 0.95 },
  },
  {
    id: 'kai',
    name: 'Kai',
    body: { heightCm: 171, massKg: 66 },
    // Thinks if he hangs around long enough, it'll happen. Never takes the hint.
    temperament: makeTemperament({ aggression: -0.2, courage: -0.2, discipline: -0.3, ego: -0.5, loyalty: 0.3, volatility: 0, sociability: -0.1, curiosity: -0.7, romance: 0.8, pragmatism: -0.6 }),
    skills: { cooking: 0.3 },
    bedroomId: 'bed_kai',
    routine: { chronotype: 0.5, pastimes: { gaming: 0.9, tv: 0.6 } },
    gender: 'man',
    attractedTo: ['woman'],
    looks: { attractiveness: 0.2, hair: 'shaved', hairColor: 'black', style: 'plain' },
    prefers: { looks: 0.9, confidence: 0.1, status: 0.1, kindness: 0.2, attention: 0.2 },
  },
];

/** Suzie Q: as she really is. The player never sees this — only what she does. */
export const SUZIE_Q: FighterDef = {
  id: 'suzie',
  name: 'Suzie Q',
  body: { heightCm: 170, massKg: 58 },
  temperament: makeTemperament({ aggression: 0.1, courage: -0.4, discipline: -0.2, ego: 0.8, loyalty: -0.6, volatility: 0.4, sociability: 0.8, curiosity: 0.2, romance: 0.8, pragmatism: -0.3 }),
  skills: { cooking: 0.3 },
  bedroomId: 'bed_spare',
  routine: { chronotype: 0.6, pastimes: { music: 0.8, tv: 0.6, billiards: 0.5 } },
  gender: 'woman',
  attractedTo: ['man'],
  looks: { attractiveness: 0.97, hair: 'wavy', hairColor: 'blonde', style: 'flashy' },
  prefers: { looks: 0.5, confidence: 0.9, status: 0.8, kindness: 0.1, attention: 0.3, build: [80, 115] },
};

const RECRUIT_TICK: Tick = 48 + 22; // day 2, 11:00

export function suzieQ(): Scenario {
  const generated = Array.from({ length: 6 }, (_, i) => generateFighter(`cadre-${i}`, { id: `crew${i}`, bedroomId: `bed_crew${i}` }));
  const fighters = [...core, ...generated];
  const rooms = [
    ...fighters.map((f) => ({ id: f.bedroomId, kind: 'bedroom' as const, name: `${f.name}'s room` })),
    { id: 'bed_spare', kind: 'bedroom' as const, name: 'the spare room' },
    { id: 'kitchen', kind: 'kitchen' as const, name: 'kitchen' },
    { id: 'gym', kind: 'gym' as const, name: 'gym' },
    { id: 'lounge', kind: 'common' as const, name: 'TV lounge', amenities: ['tv' as const, 'gaming' as const] },
    { id: 'den', kind: 'common' as const, name: 'billiards room', amenities: ['billiards' as const, 'music' as const] },
    { id: 'infirmary', kind: 'infirmary' as const, name: 'infirmary' },
  ];
  // Bob's winning streak, in the public record.
  const streak: FightRecord[] = [1, 2, 3, 4].map((k) => ({
    id: `bob-win-${k}`,
    tick: -500 * k,
    sides: [['bob'], [`stranger${k}`]],
    winningSide: 0,
    damage: { bob: { [`stranger${k}`]: 220 }, [`stranger${k}`]: { bob: 90 } },
    bodies: { bob: core[0]!.body, [`stranger${k}`]: { heightCm: 185, massKg: 95 } },
  }));
  const familiar = fighters.flatMap((a) => fighters.filter((b) => b !== a).map((b) => ({ from: a.id, to: b.id, familiarity: 0.5 })));
  return {
    name: 'Suzie Q',
    layout: { rooms },
    fighters,
    outsiders: [
      { id: 'tank', name: 'Tank', body: { heightCm: 203, massKg: 135 }, temperament: makeTemperament({ aggression: 0.6, courage: 0.7, ego: 0.5 }), skills: { cooking: 0 }, bedroomId: 'away' },
      { id: 'rook', name: 'Rook', body: { heightCm: 196, massKg: 118 }, temperament: makeTemperament({ aggression: 0.5, courage: 0.6, discipline: 0.4 }), skills: { cooking: 0 }, bedroomId: 'away' },
      { id: 'viper', name: 'Viper', body: { heightCm: 180, massKg: 90 }, temperament: makeTemperament({ aggression: 0.4, courage: 0.5, discipline: 0.6 }), skills: { cooking: 0 }, bedroomId: 'away' },
    ],
    kitchens: { kitchen: { cooks: ['bob', 'martha'] } },
    relationships: [
      ...familiar,
      { from: 'jin', to: 'martha', affection: 0.6, attraction: 0.6, trust: 0.5, familiarity: 0.7, labels: ['dating'] },
      { from: 'martha', to: 'jin', affection: 0.6, attraction: 0.6, trust: 0.5, familiarity: 0.7, labels: ['dating'] },
      { from: 'bob', to: 'jin', affection: 0.4, respect: 0.4, familiarity: 0.7, labels: ['friend'] },
      { from: 'jin', to: 'bob', affection: 0.4, respect: 0.6, familiarity: 0.7, labels: ['friend'] },
    ],
    fightRecords: streak,
    upcoming: [
      { id: 'heavyweights', tick: 5 * 48 + 38, sides: [['bob', 'jin', 'suzie'], ['tank', 'rook', 'viper']], leaders: ['bob', null], label: 'the heavyweight bout' },
    ],
  };
}

export function suzieQSchedule(tick: Tick): Input[] {
  return tick === RECRUIT_TICK ? [{ kind: 'recruit', fighter: SUZIE_Q }] : [];
}
