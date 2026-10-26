import { describe, expect, it } from 'vitest';
import { loveTriangle, loveTriangleSchedule, powi, Simulation, TICKS_PER_DAY } from '../src';

describe('determinism', () => {
  it('produces identical state from identical scenario and inputs', () => {
    const a = new Simulation(loveTriangle());
    const b = new Simulation(loveTriangle());
    a.runDays(7, loveTriangleSchedule);
    b.runDays(7, loveTriangleSchedule);
    expect(a.hash()).toBe(b.hash());
    expect(a.state.events.length).toBeGreaterThan(0);
  });

  it('replays a run exactly from scenario + journal', () => {
    const original = new Simulation(loveTriangle());
    original.runDays(5, (tick) => [
      ...loveTriangleSchedule(tick),
      ...(tick === 3 * TICKS_PER_DAY + 30 ? [{ kind: 'coach_utterance' as const, text: 'Great job, Jin!', location: 'gym' }] : []),
    ]);
    const replayed = Simulation.replay(loveTriangle(), original.journal, original.state.tick);
    expect(replayed.hash()).toBe(original.hash());
  });

  it('powi matches repeated multiplication', () => {
    let expected = 1;
    for (let i = 0; i < 37; i++) expected *= 0.995;
    expect(powi(0.995, 37)).toBeCloseTo(expected, 12);
    expect(powi(2, 0)).toBe(1);
  });
});
