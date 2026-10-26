// Acceptance tests for Milestone 2: the love triangle emerges from the rules.
// Only Bob's injury is scripted. (With time-taking conversations and routines the
// story is slower and calmer than it was with constant chatter: the triangle forms
// over TV evenings, and both Martha and Jin try to make amends.) If tuning changes break these, the drama
// generator has regressed (or the test needs a deliberate update).

import { describe, expect, it } from 'vitest';
import { loveTriangle, loveTriangleSchedule, Simulation, type WorldEvent } from '../src';

function run(kitchens: 1 | 2, days = 14) {
  const sim = new Simulation(loveTriangle({ kitchens }));
  const events = sim.runDays(days, loveTriangleSchedule);
  return { sim, events };
}

const between = (e: WorldEvent, a: string, b: string) =>
  [...e.actors, ...e.targets].includes(a) && [...e.actors, ...e.targets].includes(b);

describe('emergent love triangle', () => {
  const { sim, events } = run(1);

  it('Martha leaves Bob for Jin while Bob is in the infirmary', () => {
    const breakup = events.find((e) => e.type === 'breakup' && e.actors[0] === 'martha' && e.targets[0] === 'bob');
    const together = events.find((e) => e.type === 'romance_start' && between(e, 'martha', 'jin'));
    expect(breakup).toBeDefined();
    expect(together).toBeDefined();
    expect(together!.tick).toBeGreaterThan(breakup!.tick);
    expect(together!.witnesses).not.toContain('bob');
  });

  it('Jin, feeling guilty, tries to make peace with Bob', () => {
    expect(sim.state.fighters.jin!.diary.some((d) => d.text.includes('I feel terrible about Bob'))).toBe(true);
    expect(events.some((e) => e.type === 'apology' && e.actors[0] === 'jin' && e.targets[0] === 'bob')).toBe(true);
  });

  // Depends on the (currently disabled) pacing limits; re-enable once they're decided.
  it.skip('a second kitchen keeps Bob and Jin from clashing at mealtimes', () => {
    const kitchenFights = (evs: WorldEvent[]) =>
      evs.filter((e) => (e.type === 'argument' || e.type === 'brawl') && between(e, 'bob', 'jin') && e.location.startsWith('kitchen')).length;
    const two = run(2);
    expect(kitchenFights(events)).toBeGreaterThan(0);
    expect(kitchenFights(two.events)).toBe(0);
  });
});
