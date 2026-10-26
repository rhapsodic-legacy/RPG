import { parseArgs } from 'node:util';
import { FPS, formatTime, nameOf, RIVAL_NIGHT_FIGHT_ID, rivalNight, Simulation, type WorldEvent } from '@rpg/sim-core';

const { values } = parseArgs({
  options: {
    leader: { type: 'string' },
    days: { type: 'string', default: '4' },
    all: { type: 'boolean', default: false },
  },
});

const sim = new Simulation(rivalNight({ leader: values.leader === 'none' ? null : values.leader }));
const fight = sim.state.upcoming.find((f) => f.id === RIVAL_NIGHT_FIGHT_ID)!;
const n = (id: string) => nameOf(sim.state, id);

console.log(`${fight.label}: ${fight.sides[0].map(n).join(', ')} vs ${fight.sides[1].map(n).join(', ')} at ${formatTime(fight.tick)}`);
console.log(`Leading: ${fight.leaders[0] ? n(fight.leaders[0]) : 'nobody'} / ${fight.leaders[1] ? n(fight.leaders[1]) : 'nobody'}`);

// Up to the fight.
sim.runDays(0);
while (sim.state.tick < fight.tick) sim.step();
console.log(`\n──── Manager's inbox before the fight ────`);
for (const m of sim.state.inbox) console.log(`\n  ${formatTime(m.tick)}  From: ${n(m.from)} — ${m.subject}\n    ${m.body}`);
if (sim.state.inbox.length === 0) console.log('  (empty)');

// The fight.
sim.step();
const r = sim.lastFight!.result;
const s = (f: number) => `${(f / FPS).toFixed(1)}s`.padStart(6);
console.log(`\n──── ${fight.label} ────`);
for (const e of r.events) {
  const show = values.all || e.type !== 'contact' || e.quality === 'clean' || e.damage === undefined || (e.damage ?? 0) >= 12;
  if (!show || e.type === 'stance') continue;
  console.log(`  ${s(e.frame)}  ${e.text}`);
}
console.log(`\n  Result: ${r.winningSide === null ? 'draw' : `${r.sides[r.winningSide].map(n).join(', ')} win by ${r.method}`} at ${s(r.frames).trim()}`);
for (const id of [...r.sides[0], ...r.sides[1]]) {
  const st = r.stats[id]!;
  const hits = Object.entries(r.damage[id] ?? {}).map(([t, d]) => `${n(t)} ${d.toFixed(0)}`).join(', ');
  console.log(`    ${n(id).padEnd(7)} hp ${r.finalHp[id]!.toFixed(0).padStart(4)}  dealt ${st.damageDealt.toFixed(0).padStart(4)}${hits ? ` (${hits})` : ''}`);
}

// Aftermath at home.
const after: WorldEvent[] = sim.runDays(Number(values.days));
console.log(`\n──── Back at the house ────`);
for (const e of after.filter((e) => ['reflection', 'argument', 'brawl', 'apology', 'gossip', 'comfort', 'visit', 'recovery'].includes(e.type))) {
  console.log(`  ${formatTime(e.tick)}  ${e.gloss}`);
}
for (const id of fight.sides[0]) {
  const f = sim.state.fighters[id]!;
  const entries = f.diary.filter((d) => d.tick >= fight.tick - 48);
  if (entries.length) console.log(`\n  ${f.def.name}'s journal:\n${entries.map((d) => `    ${formatTime(d.tick).replace(/ \d\d:\d\d$/, '')}  ${d.text}`).join('\n')}`);
}
