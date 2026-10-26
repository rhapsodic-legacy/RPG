import { describe, expect, it } from 'vitest';
import {
  engagement,
  isSleepTimeFor,
  loveTriangle,
  loveTriangleSchedule,
  Simulation,
  type Routine,
} from '../src';
import { fighter, miniScenario } from './helpers';

describe('conversations take time', () => {
  const sim = new Simulation(loveTriangle());
  const events = sim.runDays(7, loveTriangleSchedule);

  it('a handful a day, not one every half hour', () => {
    const opened = events.filter((e) => e.conversation?.part === 'opening').length;
    expect(opened / 7).toBeLessThan(15);
    expect(opened).toBeGreaterThan(0);
  });

  it('every word is kept for replay', () => {
    const talks = [...sim.state.dialogue, ...sim.state.conversations].filter((c) => c.turns.length > 3);
    expect(talks.length).toBeGreaterThan(0);
    expect(talks.every((c) => c.turns.every((t) => t.text.length > 0))).toBe(true);
  });

  it('journal lines point at the conversations they describe', () => {
    const withRefs = Object.values(sim.state.fighters).flatMap((f) => f.diary.filter((d) => d.refs?.length));
    expect(withRefs.length).toBeGreaterThan(0);
  });

  it('company satisfies: someone who just talked for hours wants it less', () => {
    const s = sim.state;
    const before = engagement(s, 'martha', 'jin', 'chat');
    s.fighters.martha!.state.needs.social = 1;
    expect(engagement(s, 'martha', 'jin', 'chat')).toBeLessThan(before);
  });
});

describe('everyone keeps their own hours', () => {
  const lark: Routine = { chronotype: -1, pastimes: { reading: 0.8 } };
  const owl: Routine = { chronotype: 1, pastimes: { tv: 0.8 } };

  it('early birds are asleep while night owls are still up', () => {
    const sim = new Simulation(miniScenario([{ ...fighter('ann'), routine: lark }, { ...fighter('oz'), routine: owl }]));
    const at2230 = 45;
    expect(isSleepTimeFor(sim.state.fighters.ann!, at2230)).toBe(true);
    expect(isSleepTimeFor(sim.state.fighters.oz!, at2230)).toBe(false);
  });

  it('a bookworm takes their book to wherever the one they like spends their evenings', () => {
    const rooms = (crush: boolean) => {
      const sally = { ...fighter('sally', { sociability: -0.2, curiosity: 0.6, romance: 0.6 }), routine: { chronotype: 0, pastimes: { reading: 0.9 } } };
      const bob = { ...fighter('bob', { ego: 0.5, sociability: 0.4, discipline: -0.5 }), routine: { chronotype: 0.2, pastimes: { billiards: 1 } } };
      const scenario = miniScenario([sally, bob], {
        relationships: crush ? [{ from: 'sally', to: 'bob', attraction: 0.8, affection: 0.5 }] : [],
      });
      scenario.layout.rooms.push({ id: 'den', kind: 'common', name: 'billiards room', amenities: ['billiards'] });
      const sim = new Simulation(scenario);
      let readingNearBob = 0;
      for (let i = 0; i < 48 * 3; i++) {
        sim.step();
        const s = sim.state.fighters.sally!.state;
        if (s.activity === 'pastime' && s.pastime === 'reading' && s.location === sim.state.fighters.bob!.state.location) readingNearBob++;
      }
      return readingNearBob;
    };
    expect(rooms(true)).toBeGreaterThan(rooms(false));
  });

  it('temperament gives a routine to anyone without one', () => {
    const sim = new Simulation(miniScenario([fighter('kai', { discipline: 0.9, volatility: -0.5 }), fighter('vic', { discipline: -0.6, volatility: 0.7 })]));
    const at2100 = 42;
    // The disciplined turn in early; the restless are still up.
    expect(isSleepTimeFor(sim.state.fighters.kai!, at2100)).toBe(true);
    expect(isSleepTimeFor(sim.state.fighters.vic!, at2100)).toBe(false);
  });
});
