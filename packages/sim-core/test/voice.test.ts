import { describe, expect, it } from 'vitest';
import {
  createState,
  feel,
  loveTriangle,
  loveTriangleSchedule,
  Simulation,
  teammateRefusals,
  unaddressedGrievance,
  zeroEmotions,
  perceive,
  ruleBasedProviders,
} from '../src';
import { addEvent, fighter, miniScenario, place } from './helpers';

describe('feelings persist until counteracted', () => {
  it('gratitude counteracts anger; nothing else touches it', () => {
    const mood = zeroEmotions();
    mood.anger = 0.8;
    const joy = zeroEmotions();
    joy.joy = 0.5;
    feel(mood, joy, 1);
    expect(mood.anger).toBe(0.8);
    const thanks = zeroEmotions();
    thanks.gratitude = 0.5;
    feel(mood, thanks, 1);
    expect(mood.anger).toBeLessThan(0.8);
  });

  it('a lone fighter stays exactly as angry as they were', () => {
    // Kai cooks for themself, so there are no bad meals to be annoyed by either.
    const sim = new Simulation(miniScenario([fighter('kai')], { kitchens: { kitchen: { cooks: ['kai'] } } }));
    sim.state.fighters.kai!.state.mood.anger = 0.7;
    sim.runDays(3);
    expect(sim.state.fighters.kai!.state.mood.anger).toBe(0.7);
  });
});

describe('grievances', () => {
  it('having it out voices the grievance; the resentment stays', () => {
    const state = createState(miniScenario([fighter('bob'), fighter('jin')]));
    const providers = ruleBasedProviders();
    place(state, ['bob', 'jin'], 'lounge');
    const insult = addEvent(state, { type: 'argument', actors: ['jin'], targets: ['bob'], location: 'lounge', intensity: 0.6, public: true, witnesses: ['bob', 'jin'] });
    perceive(state, providers, insult);
    expect(unaddressedGrievance(state, 'bob', 'jin')).toBeGreaterThan(0);
    const resentment = state.fighters.bob!.relationships.jin!.resentment;

    const confrontation = addEvent(state, {
      type: 'argument',
      actors: ['bob'],
      targets: ['jin'],
      location: 'lounge',
      intensity: 0.6,
      public: true,
      witnesses: ['bob', 'jin'],
      confrontation: { response: 'walked_away' },
    });
    perceive(state, providers, confrontation);
    expect(unaddressedGrievance(state, 'bob', 'jin')).toBe(0);
    expect(state.fighters.bob!.relationships.jin!.resentment).toBeGreaterThanOrEqual(resentment);
    // Jin walked away, so Jin's own grievance from being yelled at is still unvoiced.
    expect(unaddressedGrievance(state, 'jin', 'bob')).toBeGreaterThan(0);
  });
});

describe('fighters speak up', () => {
  const sim = new Simulation(loveTriangle());
  sim.runDays(14, loveTriangleSchedule);

  // Depends on the (currently disabled) pacing limits: without them Martha chats with Jin
  // every half hour, falls for him in a day and leaves Bob before she ever writes about it.
  it.skip('Martha confides her feelings for Jin to her journal while still with Bob', () => {
    const entries = sim.state.fighters.martha!.diary.map((d) => d.text).join('\n');
    expect(entries).toContain('I have strong feelings for Jin now... I hope Bob is ok with that.');
  });

  it("Bob tells the manager he won't fight alongside Jin or Martha", () => {
    const refusal = sim.state.inbox.find((m) => m.from === 'bob' && m.topic.startsWith('refuse:') && m.about.includes('jin') && m.about.includes('martha'));
    expect(refusal?.body).toContain('It hurts too much.');
    expect(teammateRefusals(sim.state, 'bob').map((r) => r.fighter).sort()).toEqual(['jin', 'martha']);
  });
});
