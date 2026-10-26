// Export fights (with frame traces) as JSON for the 2.5D replay viewer.
//   npm run export-fights -- --out fights.json

import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import {
  createState,
  MOVES,
  nameOf,
  RIVAL_NIGHT_FIGHT_ID,
  rivalNight,
  runFight,
  runTeamFight,
  Simulation,
  sparringGym,
  topOf,
  type FighterId,
  type FightResult,
  type SimState,
} from '@rpg/sim-core';

const { values } = parseArgs({ options: { out: { type: 'string', default: 'fights.json' }, every: { type: 'string', default: '2' } } });
const every = Number(values.every);

function pack(state: SimState, title: string, subtitle: string, result: FightResult) {
  const ids: FighterId[] = [...result.sides[0], ...result.sides[1]];
  return {
    title,
    subtitle,
    fighters: ids.map((id) => {
      const f = state.fighters[id] ?? state.outsiders[id]!;
      return {
        id,
        name: nameOf(state, id),
        side: result.sides[0].includes(id) ? 0 : 1,
        heightCm: f.def.body.heightCm,
        massKg: f.def.body.massKg,
        crouchTop: topOf(f.def.body, 'crouched'),
        focus: Number(f.state.focus.toFixed(2)),
      };
    }),
    events: result.events.map((e) => ({
      frame: e.frame,
      type: e.type,
      text: e.text,
      ...(e.attacker ? { a: e.attacker } : {}),
      ...(e.defender ? { d: e.defender } : {}),
      ...(e.quality ? { q: e.quality } : {}),
      ...(e.region ? { r: e.region } : {}),
    })),
    result: {
      winningSide: result.winningSide,
      method: result.method,
      frames: result.frames,
      finalHp: Object.fromEntries(Object.entries(result.finalHp).map(([k, v]) => [k, Math.round(v)])),
    },
    trace: {
      every: result.trace!.every,
      // Compact rows: [x, z, crouched, action, move, t, hp, target, hover, out]
      frames: result.trace!.frames.map((poses) =>
        ids.map((id) => {
          const p = poses[id]!;
          return [p.x, p.z, p.stance === 'crouched' ? 1 : 0, p.action, p.move ?? '', p.t, p.hp, p.target ? ids.indexOf(p.target) : -1, p.mode === 'hover' ? 1 : 0, p.out ? 1 : 0];
        }),
      ),
    },
  };
}

function rivals(leader: FighterId) {
  const sim = new Simulation(rivalNight({ leader }));
  const fight = sim.state.upcoming.find((f) => f.id === RIVAL_NIGHT_FIGHT_ID)!;
  while (sim.state.tick < fight.tick) sim.step();
  const state = structuredClone(sim.state);
  const result = runTeamFight(state, fight.sides, { leaders: fight.leaders, trace: every });
  return pack(state, 'Night of Rivals', `${nameOf(state, leader)} leading · after three days in the house`, result);
}

function spar(a: FighterId, b: FighterId, subtitle: string) {
  const state = createState(sparringGym());
  return pack(state, `${nameOf(state, a)} vs ${nameOf(state, b)}`, subtitle, runFight(state, a, b, { trace: every }));
}

const moves = Object.fromEntries(
  Object.values(MOVES).map((m) => [m.id, { name: m.name, startup: m.startup, active: m.active, recovery: m.recovery, reach: m.reach, yLo: m.yLo, yHi: m.yHi, grab: !!m.grab, kick: m.id.includes('kick') || m.id === 'roundhouse' }]),
);

const fights = [
  rivals('bob'),
  rivals('martha'),
  spar('brick', 'shell', 'A giant brawler against a crouching turtle'),
  spar('wren', 'brick', 'A petite fighter against a giant'),
];

writeFileSync(values.out, JSON.stringify({ moves, fights }));
console.log(`Wrote ${fights.length} fights to ${values.out}`);
