import { zeroEmotions } from '../emotion';
import type {
  FighterDef,
  HouseLayout,
  KitchenConfig,
  RelLabel,
  Relationship,
  SimState,
} from '../types';
import { WAKE_SLOT, type Tick } from '../time';
import { emptyRelationship, pairKey } from '../world';

export interface InitialRelationship extends Partial<Omit<Relationship, 'labels'>> {
  from: string;
  to: string;
  labels?: RelLabel[];
}

/** Everything needed to start a simulation. Pure data. */
export interface Scenario {
  name: string;
  layout: HouseLayout;
  fighters: FighterDef[];
  kitchens: Record<string, KitchenConfig>;
  /** Romantic chemistry overrides, keyed by either "a|b" order. */
  chemistry?: Record<string, number>;
  relationships?: InitialRelationship[];
  startTick?: Tick;
}

export function createState(scenario: Scenario): SimState {
  const state: SimState = {
    version: 1,
    tick: scenario.startTick ?? WAKE_SLOT,
    layout: structuredClone(scenario.layout),
    fighters: {},
    kitchens: structuredClone(scenario.kitchens),
    chemistry: {},
    events: [],
    nextEventId: 0,
    nextMemoryId: 0,
    cooldowns: {},
  };

  for (const def of [...scenario.fighters].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    state.fighters[def.id] = {
      def: structuredClone(def),
      temperament: { ...def.temperament },
      state: {
        location: def.bedroomId,
        activity: 'relax',
        needs: { fullness: 0.7, energy: 0.8, social: 0.6, comfort: 0.7 },
        mood: zeroEmotions(),
        injuredUntil: null,
        shakenUntil: null,
        lastMeal: null,
        lastVisit: {},
        lastSeen: {},
        focus: 1,
        intents: [],
        importanceSinceReflection: 0,
      },
      relationships: {},
      memories: [],
      known: [],
      beliefs: [],
      threads: [],
    };
  }

  for (const [key, value] of Object.entries(scenario.chemistry ?? {})) {
    const [a, b] = key.split('|');
    state.chemistry[pairKey(a!, b!)] = value;
  }

  for (const r of scenario.relationships ?? []) {
    const { from, to, labels, ...axes } = r;
    const f = state.fighters[from];
    if (!f) throw new Error(`Unknown fighter in relationship: ${from}`);
    f.relationships[to] = { ...emptyRelationship(), ...axes, labels: [...(labels ?? [])].sort() };
  }

  return state;
}
