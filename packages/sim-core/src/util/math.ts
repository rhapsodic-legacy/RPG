// Deterministic numeric helpers.
//
// The simulation must produce bit-identical results on every machine (replays,
// PvP verification). IEEE-754 +, -, *, / and Math.sqrt are exactly specified, but
// Math.pow/exp/sin etc. may differ between JS engines, so sim code uses only the
// helpers below.

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

export function clamp01(x: number): number {
  return clamp(x, 0, 1);
}

export function clampSigned(x: number): number {
  return clamp(x, -1, 1);
}

/** Map a temperament axis value from [-1, 1] to [0, 1]. */
export function unit(x: number): number {
  return (x + 1) / 2;
}

/** base^n for integer n >= 0, by repeated squaring (no Math.pow). */
export function powi(base: number, n: number): number {
  let result = 1;
  let b = base;
  let e = Math.floor(n);
  if (e <= 0) return 1;
  while (e > 0) {
    if (e & 1) result *= b;
    b *= b;
    e >>= 1;
  }
  return result;
}

/** Move `value` toward `target` by `rate` of the remaining gap. */
export function approach(value: number, target: number, rate: number): number {
  return value + (target - value) * rate;
}

/** FNV-1a 32-bit hash of a string, as 8 hex chars. */
export function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
