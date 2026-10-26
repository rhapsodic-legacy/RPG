import { describe, expect, it } from 'vitest';
import {
  buildMindContext,
  createState,
  overlapRelevance,
  perceive,
  renderMindContext,
  retrieve,
  RuleAppraiser,
  ruleBasedProviders,
  type Memory,
} from '../src';
import { zeroEmotions } from '../src/emotion';
import { addEvent, fighter, miniScenario, place } from './helpers';

describe('subjective appraisal', () => {
  it('the same insult lands harder on a big ego', () => {
    const state = createState(
      miniScenario([fighter('ace'), fighter('proud', { ego: 0.9 }), fighter('humble', { ego: -0.9 })]),
    );
    const appraiser = new RuleAppraiser();
    const atProud = addEvent(state, { type: 'argument', actors: ['ace'], targets: ['proud'], location: 'lounge', intensity: 0.6, public: true, witnesses: ['ace', 'proud'] });
    const atHumble = addEvent(state, { type: 'argument', actors: ['ace'], targets: ['humble'], location: 'lounge', intensity: 0.6, public: true, witnesses: ['ace', 'humble'] });
    const proud = appraiser.appraise({ state, perceiver: 'proud', event: atProud, source: 'witnessed', confidence: 1 });
    const humble = appraiser.appraise({ state, perceiver: 'humble', event: atHumble, source: 'witnessed', confidence: 1 });
    expect(proud.emotions.shame).toBeGreaterThan(humble.emotions.shame * 2);
  });

  it('a kiss between others is only painful to someone attached to one of them', () => {
    const state = createState(
      miniScenario([fighter('ana'), fighter('ben'), fighter('cal', { ego: 0.5 }), fighter('dee')], {
        relationships: [
          { from: 'cal', to: 'ana', attraction: 0.8, labels: ['ex'] },
          { from: 'cal', to: 'ben', affection: 0.6, labels: ['friend'] },
        ],
      }),
    );
    const kiss = addEvent(state, { type: 'romance_start', actors: ['ana'], targets: ['ben'], location: 'lounge', intensity: 0.8, public: true, witnesses: ['ana', 'ben', 'cal', 'dee'] });
    const appraiser = new RuleAppraiser();
    const cal = appraiser.appraise({ state, perceiver: 'cal', event: kiss, source: 'witnessed', confidence: 1 });
    const dee = appraiser.appraise({ state, perceiver: 'dee', event: kiss, source: 'witnessed', confidence: 1 });
    expect(cal.emotions.jealousy).toBeGreaterThan(0.3);
    expect(cal.deltas.find((d) => d.toward === 'ben')?.resentment ?? 0).toBeGreaterThan(0.1);
    expect(dee.emotions.jealousy).toBe(0);
    expect(cal.importance).toBeGreaterThan(dee.importance);
  });
});

describe('knowledge is local', () => {
  it('only witnesses know; gossip passes it on with reduced confidence', () => {
    const state = createState(
      miniScenario([fighter('ana'), fighter('ben'), fighter('cal'), fighter('rosa', { sociability: 0.8 })], {
        relationships: [
          { from: 'cal', to: 'ana', attraction: 0.8, labels: ['ex'] },
          { from: 'rosa', to: 'ana', affection: 0.4 },
        ],
      }),
    );
    const providers = ruleBasedProviders();
    place(state, ['ana', 'ben', 'rosa'], 'lounge');
    place(state, ['cal'], 'gym');
    const kiss = addEvent(state, { type: 'romance_start', actors: ['ana'], targets: ['ben'], location: 'lounge', intensity: 0.8, public: true, witnesses: ['ana', 'ben', 'rosa'] });
    perceive(state, providers, kiss);

    const cal = state.fighters.cal!;
    expect(cal.memories.some((m) => m.eventId === kiss.id)).toBe(false);
    expect(state.fighters.rosa!.known).toContain(kiss.id);

    const gossip = addEvent(state, {
      type: 'gossip',
      actors: ['rosa'],
      targets: ['cal'],
      location: 'gym',
      intensity: 0.3,
      public: false,
      witnesses: ['rosa', 'cal'],
      gossip: { aboutEventId: kiss.id },
    });
    perceive(state, providers, gossip);
    const heard = cal.memories.find((m) => m.eventId === kiss.id);
    expect(heard).toBeDefined();
    expect(heard!.source).toBe('told');
    expect(heard!.toldBy).toBe('rosa');
    expect(heard!.confidence).toBeLessThan(1);
    expect(heard!.gloss).toMatch(/^Rosa told me:/);
  });
});

describe('retrieval', () => {
  it('ranks important, relevant memories above trivial recent ones', () => {
    const state = createState(miniScenario([fighter('ana'), fighter('ben')]));
    const ana = state.fighters.ana!;
    const mem = (id: string, importance: number, entities: string[], createdAt: number): Memory => ({
      id,
      eventId: `e${id}`,
      source: 'witnessed',
      confidence: 1,
      emotions: zeroEmotions(),
      valence: 0,
      importance,
      entities,
      tags: [],
      createdAt,
      lastRecalled: createdAt,
      core: false,
      gloss: id,
    });
    ana.memories.push(mem('trivial', 0.1, ['lounge'], 100), mem('defining', 0.9, ['ben'], 10));
    const top = retrieve(ana, { entities: ['ben'] }, overlapRelevance, 100, 2);
    expect(top[0]!.memory.id).toBe('defining');
  });
});

describe('mind context (LLM hook)', () => {
  it('renders a grounded, prompt-ready description of the fighter', () => {
    const state = createState(
      miniScenario([fighter('ana', { sociability: 0.8 }), fighter('ben')], {
        relationships: [{ from: 'ana', to: 'ben', affection: 0.6, labels: ['friend'] }],
      }),
    );
    const providers = ruleBasedProviders();
    state.fighters.ana!.beliefs.push({ subject: 'ben', predicate: 'is_kind_to_me', confidence: 0.8, evidence: [], formedAt: 0, updatedAt: 0 });
    const text = renderMindContext(buildMindContext(state, providers, 'ana'));
    expect(text).toContain('You are Ana');
    expect(text).toContain('Social Butterfly');
    expect(text).toContain('Ben [friend]');
    expect(text).toContain('Ben is good to me');
  });
});
