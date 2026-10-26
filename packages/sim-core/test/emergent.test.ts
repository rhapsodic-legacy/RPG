// Acceptance tests for Milestone 2: the love triangle emerges from the rules.
// Only Bob's injury is scripted. If tuning changes break these, the drama
// generator has regressed (or the test needs a deliberate update).

import { describe, expect, it } from 'vitest';
import { loveTriangle, loveTriangleSchedule, readiness, Simulation, type WorldEvent } from '../src';

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

  it('Bob hears about it through gossip and concludes Jin betrayed him', () => {
    const told = sim.state.fighters.bob!.memories.find((m) => m.source === 'told' && m.tags.includes('romance_start'));
    expect(told).toBeDefined();
    const belief = sim.state.fighters.bob!.beliefs.find((b) => b.predicate === 'betrayed_me' && b.subject === 'jin');
    expect(belief).toBeDefined();
  });

  it('the old friends end up feuding, and Martha is distracted', () => {
    expect(events.some((e) => e.type === 'brawl' && between(e, 'bob', 'jin'))).toBe(true);
    expect(readiness(sim.state, 'martha').status).toBe('distracted');
    expect(sim.state.fighters.martha!.threads.some((t) => t.kind === 'caught_in_middle')).toBe(true);
  });

  it('a second kitchen keeps Bob and Jin from clashing at mealtimes', () => {
    const kitchenFights = (evs: WorldEvent[]) =>
      evs.filter((e) => (e.type === 'argument' || e.type === 'brawl') && between(e, 'bob', 'jin') && e.location.startsWith('kitchen')).length;
    const two = run(2);
    expect(kitchenFights(events)).toBeGreaterThan(0);
    expect(kitchenFights(two.events)).toBe(0);
  });
});
