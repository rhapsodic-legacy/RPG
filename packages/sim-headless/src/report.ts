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
