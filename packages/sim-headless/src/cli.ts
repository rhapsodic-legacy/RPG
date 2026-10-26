import { parseArgs } from 'node:util';
import { loveTriangle, loveTriangleSchedule, Simulation, type WorldEvent } from '@rpg/sim-core';
import { inbox, inspect, journal, narrate, readinessTable, relationshipTable, replayJournal, rhythm } from './report';

const { values } = parseArgs({
  options: {
    days: { type: 'string', default: '14' },
    kitchens: { type: 'string', default: '1' },
    verbose: { type: 'boolean', default: false },
    inspect: { type: 'string', multiple: true, default: [] },
    journal: { type: 'string', multiple: true, default: [] },
    inbox: { type: 'boolean', default: false },
    compare: { type: 'boolean', default: false },
    rhythm: { type: 'boolean', default: false },
    talks: { type: 'string', multiple: true, default: [] },
  },
});

const days = Number(values.days);

function run(kitchens: 1 | 2): { sim: Simulation; events: WorldEvent[] } {
  const sim = new Simulation(loveTriangle({ kitchens }));
  const events = sim.runDays(days, loveTriangleSchedule);
  return { sim, events };
}

/** Bob–Jin confrontations, grouped by room. */
function conflicts(events: WorldEvent[], type: 'argument' | 'brawl'): string {
  const byRoom = new Map<string, number>();
  for (const e of events) {
    const who = [...e.actors, ...e.targets];
    if (e.type !== type || !who.includes('bob') || !who.includes('jin')) continue;
    byRoom.set(e.location, (byRoom.get(e.location) ?? 0) + 1);
  }
  const total = [...byRoom.values()].reduce((a, b) => a + b, 0);
  const rooms = [...byRoom.entries()].map(([room, n]) => `${room}: ${n}`).join(', ');
  return `${total}${rooms ? ` (${rooms})` : ''}`;
}

if (values.rhythm) {
  const k = values.kitchens === '2' ? 2 : 1;
  const sim = new Simulation(loveTriangle({ kitchens: k }));
  console.log(rhythm(sim, days, loveTriangleSchedule));
} else if (values.compare) {
  console.log(`Comparing house layouts over ${days} days (identical fighters, identical inputs):\n`);
  for (const k of [1, 2] as const) {
    const { sim, events } = run(k);
    console.log(`${sim.state.layout.rooms.filter((r) => r.kind === 'kitchen').length} kitchen(s):`);
    console.log(`  Bob–Jin arguments: ${conflicts(events, 'argument')}`);
    console.log(`  Bob–Jin brawls:    ${conflicts(events, 'brawl')}`);
    console.log(readinessTable(sim));
    console.log('');
  }
} else {
  const k = values.kitchens === '2' ? 2 : 1;
  const { sim, events } = run(k);
  console.log(`Scenario: ${sim.state.layout.rooms.length} rooms, ${k} kitchen(s), ${days} days. State hash ${sim.hash()}`);
  console.log(narrate(events, values.verbose));
  console.log(relationshipTable(sim));
  console.log(readinessTable(sim));
  for (const id of values.journal) console.log(journal(sim, id));
  for (const id of values.talks) console.log(replayJournal(sim, id));
  if (values.inbox) console.log(inbox(sim));
  for (const id of values.inspect) console.log(inspect(sim, id));
}
