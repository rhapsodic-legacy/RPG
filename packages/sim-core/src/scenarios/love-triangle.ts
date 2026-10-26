import type { Input } from '../sim/inputs';
import type { Scenario } from '../sim/scenario';
import { makeTemperament } from '../temperament';
import type { Tick } from '../time';
import type { HouseLayout } from '../types';

/**
 * Bob and Jin are friends. Bob is dating Martha and is the house cook. Bob spends his
 * evenings at the billiards table; Martha and Jin both love the TV lounge. Nothing
 * else is scripted except Bob getting injured on day 2 (later this will come
 * from an arena fight). Everything after that is emergent.
 */
export function loveTriangle(opts: { kitchens: 1 | 2 } = { kitchens: 1 }): Scenario {
  const layout: HouseLayout = {
    rooms: [
      { id: 'bed_bob', kind: 'bedroom', name: "Bob's room" },
      { id: 'bed_jin', kind: 'bedroom', name: "Jin's room" },
      { id: 'bed_martha', kind: 'bedroom', name: "Martha's room" },
      { id: 'bed_rosa', kind: 'bedroom', name: "Rosa's room" },
      { id: 'bed_kai', kind: 'bedroom', name: "Kai's room" },
      { id: 'kitchen_a', kind: 'kitchen', name: opts.kitchens === 2 ? 'east kitchen' : 'kitchen' },
      ...(opts.kitchens === 2 ? [{ id: 'kitchen_b', kind: 'kitchen' as const, name: 'west kitchen' }] : []),
      { id: 'gym', kind: 'gym', name: 'gym' },
      { id: 'lounge', kind: 'common', name: 'TV lounge', amenities: ['tv', 'gaming'] },
      { id: 'den', kind: 'common', name: 'billiards room', amenities: ['billiards', 'music'] },
      { id: 'infirmary', kind: 'infirmary', name: 'infirmary' },
    ],
  };

  return {
    name: `love-triangle (${opts.kitchens} kitchen${opts.kitchens === 2 ? 's' : ''})`,
    layout,
    fighters: [
      {
        id: 'bob',
        name: 'Bob',
        body: { heightCm: 188, massKg: 102 },
        temperament: makeTemperament({ aggression: 0.4, courage: 0.5, discipline: -0.2, ego: 0.6, loyalty: 0.5, volatility: 0.5, sociability: 0.2, romance: 0.3 }),
        skills: { cooking: 0.85 },
        bedroomId: 'bed_bob',
        routine: { chronotype: 0.3, pastimes: { billiards: 0.9, golf: 0.5, tv: 0.3 } },
      },
      {
        id: 'jin',
        name: 'Jin',
        body: { heightCm: 175, massKg: 74 },
        temperament: makeTemperament({ aggression: 0.1, courage: 0.1, discipline: 0.3, ego: 0, loyalty: 0.3, volatility: 0, sociability: 0.5, curiosity: 0.4, romance: 0.5 }),
        skills: { cooking: 0.15 },
        bedroomId: 'bed_jin',
        routine: { chronotype: 0.2, pastimes: { tv: 0.8, gaming: 0.6, reading: 0.3 } },
      },
      {
        id: 'martha',
        name: 'Martha',
        body: { heightCm: 165, massKg: 60 },
        temperament: makeTemperament({ aggression: 0.1, courage: 0.2, discipline: 0, ego: 0.1, loyalty: -0.3, volatility: 0.3, sociability: 0.6, curiosity: 0.3, romance: 0.6 }),
        skills: { cooking: 0.4 },
        bedroomId: 'bed_martha',
        routine: { chronotype: 0.5, pastimes: { tv: 0.9, music: 0.6 } },
      },
      {
        id: 'rosa',
        name: 'Rosa',
        body: { heightCm: 170, massKg: 68 },
        temperament: makeTemperament({ aggression: 0.2, courage: 0.3, discipline: 0.1, ego: 0.2, loyalty: 0.6, volatility: 0.3, sociability: 0.8, romance: -0.2 }),
        skills: { cooking: 0.5 },
        bedroomId: 'bed_rosa',
        routine: { chronotype: 0, pastimes: { tv: 0.4, billiards: 0.4, music: 0.3 } },
      },
      {
        id: 'kai',
        name: 'Kai',
        body: { heightCm: 182, massKg: 90 },
        temperament: makeTemperament({ aggression: 0, courage: 0.6, discipline: 0.7, ego: -0.2, loyalty: 0.2, volatility: -0.5, sociability: -0.5, curiosity: 0.2, romance: -0.6 }),
        skills: { cooking: 0.3 },
        bedroomId: 'bed_kai',
        routine: { chronotype: -0.8, pastimes: { reading: 0.9, golf: 0.4 } },
      },
    ],
    kitchens: {
      kitchen_a: { cooks: ['bob', 'jin'] },
      ...(opts.kitchens === 2 ? { kitchen_b: { cooks: ['rosa'] } } : {}),
    },
    chemistry: {
      'bob|martha': 0.65,
      'jin|martha': 0.85,
    },
    relationships: [
      { from: 'bob', to: 'jin', affection: 0.6, respect: 0.5, trust: 0.5, familiarity: 0.7, labels: ['friend'] },
      { from: 'jin', to: 'bob', affection: 0.6, respect: 0.5, trust: 0.5, familiarity: 0.7, labels: ['friend'] },
      { from: 'bob', to: 'martha', affection: 0.6, attraction: 0.65, trust: 0.5, familiarity: 0.6, labels: ['dating'] },
      { from: 'martha', to: 'bob', affection: 0.5, attraction: 0.6, trust: 0.4, familiarity: 0.6, labels: ['dating'] },
      { from: 'martha', to: 'jin', affection: 0.3, attraction: 0.3, familiarity: 0.4 },
      { from: 'jin', to: 'martha', affection: 0.3, attraction: 0.35, familiarity: 0.4 },
      { from: 'rosa', to: 'bob', affection: 0.5, trust: 0.4, familiarity: 0.5, labels: ['friend'] },
      { from: 'bob', to: 'rosa', affection: 0.4, trust: 0.4, familiarity: 0.5, labels: ['friend'] },
      { from: 'rosa', to: 'jin', affection: -0.2, resentment: 0.25, familiarity: 0.4 },
      { from: 'rosa', to: 'martha', affection: 0.2, familiarity: 0.4 },
      { from: 'martha', to: 'rosa', affection: 0.3, familiarity: 0.4 },
    ],
  };
}

/** Bob gets hurt on day 2 — the one scripted beat. */
export function loveTriangleSchedule(tick: Tick): Input[] {
  return tick === 48 + 20 ? [{ kind: 'injure', fighter: 'bob', days: 7, cause: 'sparring accident' }] : [];
}
