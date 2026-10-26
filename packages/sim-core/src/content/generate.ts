// Random fighters for the open market. World generation is the one place a seed
// is used: once someone exists, everything they do is deterministic.

import { makeTemperament, TEMPERAMENT_AXES, type Temperament } from '../temperament';
import type { FighterDef, Gender, Hair, HairColor, Preferences, Style } from '../types';
import { fnv1a } from '../util/math';

/** Small deterministic PRNG (mulberry32), seeded from a string. */
export function seededRandom(seed: string): () => number {
  let a = parseInt(fnv1a(seed), 16) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES: Record<Gender, string[]> = {
  woman: ['Ava', 'Nadia', 'Tess', 'Lena', 'Mira', 'Rita', 'Yuki', 'Dana', 'Ines', 'Coco', 'Joy', 'Sasha'],
  man: ['Marco', 'Dev', 'Tomas', 'Rex', 'Hugo', 'Omar', 'Felix', 'Niko', 'Brock', 'Leon', 'Sol', 'Tommy'],
  nonbinary: ['Sky', 'Remy', 'Ash', 'Quinn'],
};
const HAIR: Hair[] = ['curly', 'wavy', 'straight', 'short', 'shaved'];
const COLORS: HairColor[] = ['black', 'brown', 'blonde', 'red', 'grey'];
const STYLES: Style[] = ['flashy', 'plain', 'rugged', 'elegant', 'sporty'];

export interface GenerateOptions {
  id: string;
  bedroomId: string;
  gender?: Gender;
  name?: string;
}

/** Someone who posted on the gym board looking for a crew: you know nothing about them. */
export function generateFighter(seed: string, opts: GenerateOptions): FighterDef {
  const r = seededRandom(seed);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  const between = (lo: number, hi: number) => lo + (hi - lo) * r();
  // Personalities cluster toward the middle, with the occasional extreme.
  const axis = () => (r() + r() - 1) * 1.1;

  const gender: Gender = opts.gender ?? (r() < 0.48 ? 'woman' : r() < 0.96 ? 'man' : 'nonbinary');
  const t: Partial<Temperament> = {};
  for (const a of TEMPERAMENT_AXES) t[a] = axis();
  const heightCm = Math.round(gender === 'woman' ? between(155, 180) : between(165, 198));
  const massKg = Math.round((heightCm - 100) * between(0.85, 1.35));
  const orientation = r();
  const other: Gender = gender === 'woman' ? 'man' : 'woman';
  const attractedTo: Gender[] = orientation < 0.85 ? [other] : orientation < 0.93 ? [gender] : ['woman', 'man', 'nonbinary'];
  const prefers: Preferences = {
    looks: between(0.2, 0.9),
    confidence: r(),
    status: r(),
    kindness: r(),
    attention: r(),
    ...(r() < 0.5 ? { hair: [pick(HAIR)] } : {}),
    ...(r() < 0.4 ? { hairColor: [pick(COLORS)] } : {}),
    ...(r() < 0.4 ? { style: [pick(STYLES)] } : {}),
  };
  return {
    id: opts.id,
    name: opts.name ?? pick(NAMES[gender]),
    body: { heightCm, massKg },
    temperament: makeTemperament(t),
    skills: { cooking: Math.round(r() * 100) / 100 },
    bedroomId: opts.bedroomId,
    gender,
    attractedTo,
    looks: { attractiveness: Math.round(between(0.2, 0.85) * 100) / 100, hair: pick(HAIR), hairColor: pick(COLORS), style: pick(STYLES) },
    prefers,
  };
}
