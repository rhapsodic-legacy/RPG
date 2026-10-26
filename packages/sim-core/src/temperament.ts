import { clampSigned, unit } from './util/math';

/**
 * The personality vector. Every axis must change decisions both at home and in
 * the arena. Values are in [-1, 1]; 0 is "average".
 */
export const TEMPERAMENT_AXES = [
  'aggression',
  'courage',
  'discipline',
  'ego',
  'loyalty',
  'volatility',
  'sociability',
  'curiosity',
  'romance',
] as const;

export type TemperamentAxis = (typeof TEMPERAMENT_AXES)[number];
export type Temperament = Record<TemperamentAxis, number>;

export function makeTemperament(partial: Partial<Temperament> = {}): Temperament {
  const t = {} as Temperament;
  for (const axis of TEMPERAMENT_AXES) t[axis] = clampSigned(partial[axis] ?? 0);
  return t;
}

/**
 * Readable traits derived from regions of the vector. Players see these (and
 * behaviour), never raw numbers. They also seed LLM prompts.
 */
export interface Trait {
  id: string;
  label: string;
  description: string;
  test: (t: Temperament) => boolean;
}

export const TRAITS: readonly Trait[] = [
  {
    id: 'glory_hound',
    label: 'Glory Hound',
    description: 'craves recognition and the spotlight',
    test: (t) => t.ego >= 0.5,
  },
  {
    id: 'hothead',
    label: 'Hothead',
    description: 'quick to anger, slow to cool down',
    test: (t) => t.volatility >= 0.4 && t.aggression >= 0.2,
  },
  {
    id: 'cold_professional',
    label: 'Cold Professional',
    description: 'disciplined and emotionally contained',
    test: (t) => t.discipline >= 0.5 && t.volatility <= -0.2,
  },
  {
    id: 'mother_hen',
    label: 'Mother Hen',
    description: 'protective of friends to a fault',
    test: (t) => t.loyalty >= 0.5 && t.sociability >= 0.3,
  },
  {
    id: 'social_butterfly',
    label: 'Social Butterfly',
    description: 'always in the middle of the conversation (and the gossip)',
    test: (t) => t.sociability >= 0.6,
  },
  {
    id: 'lone_wolf',
    label: 'Lone Wolf',
    description: 'needs space and keeps to themself',
    test: (t) => t.sociability <= -0.4,
  },
  {
    id: 'romantic',
    label: 'Romantic',
    description: 'falls for people easily',
    test: (t) => t.romance >= 0.5,
  },
  {
    id: 'fickle_heart',
    label: 'Fickle Heart',
    description: 'affections drift when someone new comes along',
    test: (t) => t.romance >= 0.3 && t.loyalty <= -0.2,
  },
  {
    id: 'stalwart',
    label: 'Stalwart',
    description: 'brave and steady under pressure',
    test: (t) => t.courage >= 0.5 && t.volatility <= 0.1,
  },
  {
    id: 'skittish',
    label: 'Skittish',
    description: 'avoids confrontation',
    test: (t) => t.courage <= -0.3,
  },
  {
    id: 'student',
    label: 'Eager Student',
    description: 'curious and quick to learn',
    test: (t) => t.curiosity >= 0.5,
  },
];

export function traitsOf(t: Temperament): Trait[] {
  return TRAITS.filter((trait) => trait.test(t));
}

/**
 * Social compatibility in [-1, 1]. Similar energy levels get along; two big
 * egos or two volatile people clash; mutual loyalty bonds.
 */
export function compatibility(a: Temperament, b: Temperament): number {
  const sociabilityMatch = 1 - Math.abs(a.sociability - b.sociability);
  const curiosityMatch = 1 - Math.abs(a.curiosity - b.curiosity);
  const egoClash = unit(a.ego) * unit(b.ego);
  const volatilityClash = unit(a.volatility) * unit(b.volatility);
  const loyaltyBond = unit(a.loyalty) * unit(b.loyalty);
  const score =
    0.35 * (sociabilityMatch - 1) +
    0.2 * (curiosityMatch - 1) -
    0.5 * egoClash -
    0.4 * volatilityClash +
    0.5 * loyaltyBond +
    0.25;
  return clampSigned(score * 1.5);
}
