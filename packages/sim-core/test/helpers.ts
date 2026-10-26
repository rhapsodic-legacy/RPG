import {
  createState,
  makeTemperament,
  type FighterDef,
  type Scenario,
  type SimState,
  type Temperament,
  type WorldEvent,
} from '../src';

export function fighter(id: string, temperament: Partial<Temperament> = {}): FighterDef {
  return {
    id,
    name: id[0]!.toUpperCase() + id.slice(1),
    body: { heightCm: 175, massKg: 75 },
    temperament: makeTemperament(temperament),
    skills: { cooking: 0.5 },
    bedroomId: `bed_${id}`,
  };
}

/** A tiny house with the given fighters. */
export function miniScenario(defs: FighterDef[], extra: Partial<Scenario> = {}): Scenario {
  return {
    name: 'mini',
    layout: {
      rooms: [
        ...defs.map((d) => ({ id: d.bedroomId, kind: 'bedroom' as const, name: `${d.name}'s room` })),
        { id: 'kitchen', kind: 'kitchen', name: 'kitchen' },
        { id: 'gym', kind: 'gym', name: 'gym' },
        { id: 'lounge', kind: 'common', name: 'lounge' },
        { id: 'infirmary', kind: 'infirmary', name: 'infirmary' },
      ],
    },
    fighters: defs,
    kitchens: { kitchen: { cooks: [] } },
    ...extra,
  };
}

/** Append a hand-made event to the log (bypassing the simulation's own emission). */
export function addEvent(state: SimState, e: Omit<WorldEvent, 'id' | 'tick' | 'gloss'> & { gloss?: string }): WorldEvent {
  const event: WorldEvent = { gloss: `${e.type}`, ...e, id: `e${state.nextEventId}`, tick: state.tick };
  state.nextEventId++;
  state.events.push(event);
  return event;
}

export function place(state: SimState, ids: string[], room: string): void {
  for (const id of ids) {
    state.fighters[id]!.state.location = room;
    state.fighters[id]!.state.activity = 'socialize';
  }
}

export { createState };
