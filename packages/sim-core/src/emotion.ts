export const EMOTIONS = [
  'joy',
  'affection',
  'gratitude',
  'anger',
  'fear',
  'shame',
  'jealousy',
  'sadness',
] as const;

export type Emotion = (typeof EMOTIONS)[number];
export type EmotionVector = Record<Emotion, number>;

const POSITIVE: ReadonlySet<Emotion> = new Set(['joy', 'affection', 'gratitude']);

export function zeroEmotions(): EmotionVector {
  const e = {} as EmotionVector;
  for (const k of EMOTIONS) e[k] = 0;
  return e;
}

export function addScaled(into: EmotionVector, add: EmotionVector, k: number): void {
  for (const e of EMOTIONS) into[e] = Math.max(0, Math.min(1, into[e] + add[e] * k));
}

export function scaleEmotions(v: EmotionVector, k: number): EmotionVector {
  const out = zeroEmotions();
  for (const e of EMOTIONS) out[e] = v[e] * k;
  return out;
}

export function magnitude(v: EmotionVector): number {
  let sum = 0;
  for (const e of EMOTIONS) sum += v[e] * v[e];
  return Math.sqrt(sum);
}

export function cosine(a: EmotionVector, b: EmotionVector): number {
  const ma = magnitude(a);
  const mb = magnitude(b);
  if (ma === 0 || mb === 0) return 0;
  let dot = 0;
  for (const e of EMOTIONS) dot += a[e] * b[e];
  return dot / (ma * mb);
}

/** Overall pleasantness in [-1, 1]. */
export function valence(v: EmotionVector): number {
  let pos = 0;
  let neg = 0;
  for (const e of EMOTIONS) {
    if (POSITIVE.has(e)) pos += v[e];
    else neg += v[e];
  }
  const total = pos + neg;
  return total === 0 ? 0 : (pos - neg) / Math.max(1, total);
}

export function dominantEmotion(v: EmotionVector): Emotion | null {
  let best: Emotion | null = null;
  let bestValue = 0.05;
  for (const e of EMOTIONS) {
    if (v[e] > bestValue) {
      best = e;
      bestValue = v[e];
    }
  }
  return best;
}
