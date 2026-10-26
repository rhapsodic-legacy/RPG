import { parseArgs } from 'node:util';
import {
  createState,
  FPS,
  loveTriangle,
  loveTriangleSchedule,
  MOVE_IDS,
  MOVES,
  nameOf,
  runFight,
  Simulation,
  sparringGym,
  type CombatStats,
  type FightResult,
  type SimState,
} from '@rpg/sim-core';

const { values } = parseArgs({
  options: {
    a: { type: 'string', default: 'brick' },
    b: { type: 'string', default: 'shell' },
    scenario: { type: 'string', default: 'sparring' },
    days: { type: 'string', default: '14' },
    rounds: { type: 'string', default: '1' },
    log: { type: 'boolean', default: false },
  },
});

function load(): SimState {
  if (values.scenario === 'love-triangle') {
    // Fight with whatever the house has done to them after `days` days.
    const sim = new Simulation(loveTriangle());
    sim.runDays(Number(values.days), loveTriangleSchedule);
    return sim.state;
  }
  return createState(sparringGym());
}

function seconds(frames: number): string {
  return `${(frames / FPS).toFixed(1)}s`;
}

function statsTable(state: SimState, id: string, s: CombatStats, frames: number): string {
  const lines = [`  ${nameOf(state, id)}: dealt ${s.damageDealt.toFixed(0)}, blocked ${s.blocks}, knockdowns suffered ${s.knockdowns}, crouched ${Math.round((100 * s.framesCrouched) / Math.max(1, frames))}% of the fight${s.taunts ? `, taunted ${s.taunts}×` : ''}`];
  for (const move of MOVE_IDS) {
    const n = s.attempts[move];
    if (!n) continue;
    const o = s.byMove[move] ?? { clean: 0, glancing: 0, blocked: 0, whiff: 0 };
    lines.push(`    ${MOVES[move].name.padEnd(16)} ×${String(n).padStart(3)}   clean ${o.clean}  glancing ${o.glancing}  blocked ${o.blocked}  whiff ${o.whiff}`);
  }
  return lines.join('\n');
}

const state = load();
const a = values.a;
const b = values.b;
for (const id of [a, b]) if (!state.fighters[id]) throw new Error(`No fighter "${id}" in scenario ${values.scenario}`);

for (const id of [a, b]) {
  const f = state.fighters[id]!;
  console.log(`${f.def.name}: ${f.def.body.heightCm}cm ${f.def.body.massKg}kg, focus ${f.state.focus.toFixed(2)}`);
}

const rounds = Number(values.rounds);
let last: FightResult | undefined;
for (let r = 1; r <= rounds; r++) {
  const result = runFight(state, a, b);
  last = result;
  console.log(`\n═══ Fight ${r}: ${result.winner ? `${nameOf(state, result.winner)} wins by ${result.method}` : 'draw'} at ${seconds(result.frames)} ═══`);
  if (values.log) for (const e of result.events) console.log(`  ${seconds(e.frame).padStart(6)}  ${e.text}`);
  console.log(statsTable(state, a, result.stats[a]!, result.frames));
  console.log(statsTable(state, b, result.stats[b]!, result.frames));
}

if (last && rounds > 1) {
  console.log('\nWhat they learned (expected value of each move vs the opponent stances they faced):');
  for (const id of [a, b]) {
    const k = state.fighters[id]!.combat.moves;
    const entries = Object.entries(k)
      .sort(([x], [y]) => (x < y ? -1 : 1))
      .map(([key, v]) => `${key.replace('|', ' vs ')} ${v.expected.toFixed(2)} (n=${v.n})`);
    console.log(`  ${nameOf(state, id)}: ${entries.join('; ')}`);
  }
}
