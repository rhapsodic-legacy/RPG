import { describe, expect, it } from 'vitest';
import {
  COACH_ID,
  createState,
  KeywordUtteranceInterpreter,
  peekRel,
  Simulation,
  type UtteranceInterpretation,
} from '../src';
import { fighter, miniScenario } from './helpers';

const scenario = () =>
  miniScenario([fighter('bob'), fighter('jin', { ego: 0.3 }), fighter('kai')], {
    relationships: [
      { from: 'jin', to: 'bob', resentment: 0.7, affection: -0.4 },
      { from: 'jin', to: COACH_ID, trust: 0.5 },
    ],
  });

describe('keyword utterance interpreter', () => {
  it('finds who was named and what was meant', () => {
    const state = createState(scenario());
    const interp = new KeywordUtteranceInterpreter().interpret('You can do it Bob!', {
      state,
      speaker: COACH_ID,
      audience: ['jin'],
      focus: 'jin',
    });
    expect(interp.mentions).toEqual(['bob']);
    expect(interp.addressee).toBe('bob');
    expect(interp.intents.map((i) => i.kind)).toContain('encourage');
    expect(interp.intents[0]!.target).toBe('bob');
  });

  it('falls back to whoever the coach is facing', () => {
    const state = createState(scenario());
    const interp = new KeywordUtteranceInterpreter().interpret('Come on, keep going!', {
      state,
      speaker: COACH_ID,
      audience: ['jin'],
      focus: 'jin',
    });
    expect(interp.addressee).toBe('jin');
  });
});

describe('what the coach says matters', () => {
  it('cheering "You can do it Bob!" at Jin backfires', () => {
    const sim = new Simulation(scenario());
    const trustBefore = peekRel(sim.state, 'jin', COACH_ID).trust;
    const resentBefore = peekRel(sim.state, 'jin', 'bob').resentment;
    const [event] = sim.step([{ kind: 'coach_utterance', text: 'You can do it Bob!', audience: ['jin'], focus: 'jin' }]);

    expect(event!.type).toBe('coach_spoke');
    expect(event!.utterance!.misaddressed).toBe(true);
    expect(peekRel(sim.state, 'jin', COACH_ID).trust).toBeLessThan(trustBefore - 0.1);
    expect(peekRel(sim.state, 'jin', 'bob').resentment).toBeGreaterThan(resentBefore);

    const memory = sim.state.fighters.jin!.memories.find((m) => m.eventId === event!.id);
    expect(memory?.tags).toContain('misaddressed');
    expect(memory?.gloss).toContain('You can do it Bob!');
    // Bob wasn't there, so Bob doesn't know.
    expect(sim.state.fighters.bob!.memories.some((m) => m.eventId === event!.id)).toBe(false);
  });

  it('the right name lands well', () => {
    const sim = new Simulation(scenario());
    const before = peekRel(sim.state, 'jin', COACH_ID).trust;
    sim.step([{ kind: 'coach_utterance', text: 'You can do it Jin!', audience: ['jin'], focus: 'jin' }]);
    expect(peekRel(sim.state, 'jin', COACH_ID).trust).toBeGreaterThan(before);
  });

  it('uses an externally supplied interpretation verbatim and journals it', () => {
    const sim = new Simulation(scenario());
    const external: UtteranceInterpretation = {
      mentions: ['jin'],
      addressee: 'jin',
      intents: [{ kind: 'praise', target: 'jin' }],
      sentiment: 0.9,
      confidence: 0.95,
      interpreter: 'llm.test-double',
    };
    const [event] = sim.step([
      { kind: 'coach_utterance', text: 'That counter was textbook.', audience: ['jin'], focus: 'jin', interpretation: external },
    ]);
    expect(event!.utterance!.interpretation.interpreter).toBe('llm.test-double');
    const entry = sim.journal.find((j) => j.input.kind === 'coach_utterance');
    expect(entry?.input.kind === 'coach_utterance' && entry.input.interpretation?.interpreter).toBe('llm.test-double');
  });

  it('journals the in-sim interpretation so replays never re-interpret', () => {
    const sim = new Simulation(scenario());
    sim.step([{ kind: 'coach_utterance', text: 'Great job, Kai!', audience: ['jin', 'kai'] }]);
    const entry = sim.journal[0]!;
    expect(entry.input.kind === 'coach_utterance' && entry.input.interpretation?.interpreter).toBe('rules.keyword-utterance');
  });
});

describe('external intents', () => {
  it('an injected "seek" goal steers the planner', () => {
    const base = scenario();
    const run = (seek: boolean) => {
      const sim = new Simulation(base);
      const inputs = seek
        ? [{ kind: 'intent' as const, fighter: 'kai', intent: { type: 'seek' as const, target: 'jin', untilTick: 10_000, reason: 'test' } }]
        : [];
      let together = 0;
      for (let i = 0; i < 48; i++) {
        sim.step(i === 0 ? inputs : []);
        const s = sim.state.fighters;
        if (s.kai!.state.activity !== 'sleep' && s.kai!.state.location === s.jin!.state.location) together++;
      }
      return together;
    };
    expect(run(true)).toBeGreaterThan(run(false));
  });
});
