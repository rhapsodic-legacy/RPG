import {
  buildMindContext,
  dayOf,
  fighterIds,
  formatTime,
  nameOf,
  readiness,
  renderMindContext,
  type EventType,
  type Simulation,
  type WorldEvent,
} from '@rpg/sim-core';

const NOTABLE: ReadonlySet<EventType> = new Set([
  'romance_start',
  'breakup',
  'brawl',
  'argument',
  'gossip',
  'injury',
  'recovery',
  'reflection',
  'coach_spoke',
  'apology',
  'visit',
]);

export function narrate(events: WorldEvent[], verbose: boolean): string {
  const lines: string[] = [];
  let day = -1;
  const shownDisplays = new Set<string>();
  for (const e of events) {
    let show = verbose || NOTABLE.has(e.type);
    // Show the first public display of affection per couple per day.
    if (!show && e.type === 'affection_display') {
      const key = `${dayOf(e.tick)}:${[...e.actors, ...e.targets].sort().join('|')}`;
      show = !shownDisplays.has(key);
      shownDisplays.add(key);
    }
    if (!show) continue;
    if (dayOf(e.tick) !== day) {
      day = dayOf(e.tick);
      lines.push('', `── Day ${day + 1} ──`);
    }
    const watchers = e.witnesses.filter((w) => !e.actors.includes(w) && !e.targets.includes(w));
    const seen = e.public && watchers.length ? `  [seen by ${watchers.join(', ')}]` : '';
    lines.push(`  ${formatTime(e.tick).slice(-5)}  ${e.gloss}${seen}`);
  }
  return lines.join('\n');
}

function pct(n: number): string {
  return `${Math.round(n * 100)}`.padStart(4);
}

export function relationshipTable(sim: Simulation): string {
  const s = sim.state;
  const ids = fighterIds(s);
  const lines = ['', 'Relationships (row → column): affection / attraction / resentment, ×100'];
  lines.push('            ' + ids.map((id) => nameOf(s, id).padEnd(18)).join(''));
  for (const a of ids) {
    let row = nameOf(s, a).padEnd(12);
    for (const b of ids) {
      if (a === b) {
        row += '—'.padEnd(18);
        continue;
      }
      const r = s.fighters[a]!.relationships[b];
      row += (r ? `${pct(r.affection)}/${pct(r.attraction)}/${pct(r.resentment)}` : '').padEnd(18);
    }
    lines.push(row);
  }
  lines.push('', 'Labels:');
  for (const a of ids) {
    for (const [b, r] of Object.entries(s.fighters[a]!.relationships)) {
      if (r.labels.length) lines.push(`  ${nameOf(s, a)} → ${nameOf(s, b)}: ${r.labels.join(', ')}`);
    }
  }
  return lines.join('\n');
}

export function readinessTable(sim: Simulation): string {
  const s = sim.state;
  const lines = ['', `Fight readiness at ${formatTime(s.tick)}:`];
  for (const id of fighterIds(s)) {
    const r = readiness(s, id);
    lines.push(
      `  ${nameOf(s, id).padEnd(8)} ${r.status.padEnd(11)} focus ${r.focus.toFixed(2)}${r.reasons.length ? `  — ${r.reasons.join('; ')}` : ''}`,
    );
  }
  return lines.join('\n');
}

export function inspect(sim: Simulation, id: string): string {
  const ctx = buildMindContext(sim.state, sim.providers, id);
  return ['', `──── Mind context for ${nameOf(sim.state, id)} (what an LLM would be given) ────`, renderMindContext(ctx)].join('\n');
}

export function journal(sim: Simulation, id: string): string {
  const f = sim.state.fighters[id];
  if (!f) return `No fighter ${id}`;
  const lines = ['', `──── ${f.def.name}'s journal ────`];
  for (const e of f.diary) lines.push(`  ${formatTime(e.tick).replace(/ \d\d:\d\d$/, '')}  ${e.text}`);
  return lines.join('\n');
}

export function inbox(sim: Simulation): string {
  const s = sim.state;
  const lines = ['', `──── Manager's inbox (${s.inbox.length}) ────`];
  for (const m of s.inbox) {
    lines.push('', `  ${formatTime(m.tick)}  From: ${nameOf(s, m.from)}  —  ${m.subject}`, `    ${m.body}`);
  }
  return lines.join('\n');
}

/**
 * Where everyone spends their waking hours, and who they talk to. Collected by
 * stepping the simulation and sampling each half hour.
 */
export function rhythm(sim: Simulation, days: number, schedule?: (tick: number) => import('@rpg/sim-core').Input[]): string {
  const s = sim.state;
  const ids = fighterIds(s);
  const where: Record<string, Record<string, number>> = {};
  const talkTicks: Record<string, Record<string, number>> = {};
  const starts: Record<string, number> = {};
  const brushOffs: Record<string, number> = {};
  let conversations = 0;
  const end = s.tick + days * 48;
  while (s.tick < end) {
    const events = sim.step(schedule?.(s.tick) ?? []);
    for (const e of events) {
      if (e.conversation?.part === 'opening') {
        conversations++;
        starts[e.actors[0]!] = (starts[e.actors[0]!] ?? 0) + 1;
      }
      if (e.conversation?.part === 'brushed_off') brushOffs[e.actors[0]!] = (brushOffs[e.actors[0]!] ?? 0) + 1;
    }
    for (const id of ids) {
      const f = s.fighters[id]!;
      if (f.state.activity === 'sleep') continue;
      const label = f.state.activity === 'pastime' ? f.state.pastime ?? 'pastime' : f.state.activity;
      const key = `${label} @ ${nameOf(s, f.state.location)}`;
      (where[id] ??= {})[key] = (where[id]![key] ?? 0) + 1;
      if (f.state.conversation) {
        const c = s.conversations.find((x) => x.id === f.state.conversation);
        const other = c ? (c.participants[0] === id ? c.participants[1] : c.participants[0]) : null;
        if (other) (talkTicks[id] ??= {})[other] = (talkTicks[id]![other] ?? 0) + 1;
      }
    }
  }
  const lines = ['', `Daily rhythm over ${days} days (${(conversations / days).toFixed(1)} conversations a day across the house):`];
  for (const id of ids) {
    const total = Object.values(where[id] ?? {}).reduce((a, b) => a + b, 0) || 1;
    const top = Object.entries(where[id] ?? {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([k, v]) => `${k} ${Math.round((100 * v) / total)}%`)
      .join(', ');
    const talks = Object.entries(talkTicks[id] ?? {})
      .sort((a, b) => b[1] - a[1])
      .map(([o, v]) => `${nameOf(s, o)} ${(v / 2 / days).toFixed(1)}h`)
      .join(', ');
    lines.push(`  ${nameOf(s, id).padEnd(7)} ${top}`);
    lines.push(`          talks/day: ${talks || 'nobody'}; starts ${((starts[id] ?? 0) / days).toFixed(1)} a day, brushed off ${((brushOffs[id] ?? 0) / days).toFixed(1)}`);
  }
  return lines.join('\n');
}

/** Journal entries that point at a recorded conversation, with the conversation itself. */
export function replayJournal(sim: Simulation, id: string): string {
  const s = sim.state;
  const f = s.fighters[id];
  if (!f) return `No fighter ${id}`;
  const lines = ['', `──── ${f.def.name}'s journal, with the conversations behind it ────`];
  let shown = 0;
  for (const entry of f.diary) {
    if (!entry.refs?.length) continue;
    const recorded = entry.refs.map((r) => [...s.dialogue, ...s.conversations].find((c) => c.id === r)).filter((c) => c !== undefined);
    if (recorded.length === 0) continue;
    lines.push('', `  ${formatTime(entry.tick).replace(/ \d\d:\d\d$/, '')}  "${entry.text}"`);
    for (const c of recorded) {
      lines.push(`    ┌ ${formatTime(c.startedAt)} → ${formatTime(c.endedAt ?? s.tick).slice(-5)}, ${nameOf(s, c.location)}`);
      for (const t of c.turns) lines.push(`    │ ${nameOf(s, t.speaker)}: ${t.text}`);
    }
    shown++;
  }
  if (!shown) lines.push('  (no recorded conversations in the last few days)');
  return lines.join('\n');
}
