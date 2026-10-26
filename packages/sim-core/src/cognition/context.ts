/**
 * Mind context: everything an external mind (an LLM today, something better
 * tomorrow) needs to speak or act *as* a fighter, grounded in the simulation.
 *
 * The rule of thumb for any LLM layer: it may only reference facts present in
 * this context. The simulation stays the source of truth.
 */

import { dominantEmotion, type Emotion } from '../emotion';
import { retrieve } from '../mind/memory';
import { describeThread, readiness, type ReadinessStatus } from '../mind/threads';
import { traitsOf } from '../temperament';
import { formatTime } from '../time';
import { COACH_ID, type EntityId, type FighterId, type SimState } from '../types';
import { getFighter, nameOf } from '../world';
import type { CognitionProviders, RetrievalCue } from './providers';
import { beliefText, roomPhrase } from './rules/narrator';

export interface MindContext {
  fighter: { id: FighterId; name: string; traits: { label: string; description: string }[] };
  now: string;
  situation: { location: string; activity: string; status: ReadinessStatus; focus: number };
  feeling: { dominant: Emotion | null; mood: Record<Emotion, number> };
  needs: Record<string, number>;
  relationships: { id: EntityId; name: string; labels: string[]; summary: string }[];
  beliefs: { text: string; confidence: number }[];
  threads: string[];
  memories: { when: string; text: string; importance: number; source: string }[];
}

function describeRelationship(state: SimState, from: FighterId, to: EntityId): string {
  const r = getFighter(state, from).relationships[to]!;
  const parts: string[] = [];
  if (r.affection >= 0.5) parts.push('very fond of them');
  else if (r.affection >= 0.2) parts.push('likes them');
  else if (r.affection <= -0.3) parts.push('dislikes them');
  if (r.attraction >= 0.5) parts.push('strongly attracted');
  else if (r.attraction >= 0.3) parts.push('a little attracted');
  if (r.resentment >= 0.5) parts.push('deeply resentful');
  else if (r.resentment >= 0.25) parts.push('holds a grudge');
  if (r.trust <= -0.3) parts.push('does not trust them');
  else if (r.trust >= 0.4) parts.push('trusts them');
  if (r.respect >= 0.4) parts.push('respects them');
  if (r.fear >= 0.3) parts.push('uneasy around them');
  return parts.length ? parts.join(', ') : 'neutral';
}

/**
 * Build the context for `fighter`. `cue` steers which memories surface — e.g.
 * the entities mentioned in what the player just said.
 */
export function buildMindContext(
  state: SimState,
  providers: CognitionProviders,
  id: FighterId,
  cue: RetrievalCue = {},
  memoryCount = 8,
): MindContext {
  const f = getFighter(state, id);
  const ready = readiness(state, id);
  const relIds = Object.keys(f.relationships)
    .filter((o) => o === COACH_ID || state.fighters[o])
    .sort();
  return {
    fighter: {
      id,
      name: f.def.name,
      traits: traitsOf(f.temperament).map((t) => ({ label: t.label, description: t.description })),
    },
    now: formatTime(state.tick),
    situation: {
      location: nameOf(state, f.state.location),
      activity: f.state.activity,
      status: ready.status,
      focus: Number(f.state.focus.toFixed(2)),
    },
    feeling: { dominant: dominantEmotion(f.state.mood), mood: { ...f.state.mood } },
    needs: { ...f.state.needs },
    relationships: relIds.map((o) => ({
      id: o,
      name: nameOf(state, o),
      labels: [...f.relationships[o]!.labels],
      summary: describeRelationship(state, id, o),
    })),
    beliefs: f.beliefs.map((b) => ({ text: beliefText(state, b.predicate, b.subject, b.object), confidence: b.confidence })),
    threads: f.threads.map((t) => describeThread(state, t)),
    memories: retrieve(f, cue, providers.relevance, state.tick, memoryCount).map(({ memory }) => ({
      when: formatTime(memory.createdAt),
      text: memory.gloss,
      importance: Number(memory.importance.toFixed(2)),
      source: memory.source,
    })),
  };
}

/** Render a mind context as prompt-ready text. */
export function renderMindContext(ctx: MindContext): string {
  const lines: string[] = [];
  lines.push(`You are ${ctx.fighter.name}, a fighter living in the team house. It is ${ctx.now}.`);
  if (ctx.fighter.traits.length) {
    lines.push(`Personality: ${ctx.fighter.traits.map((t) => `${t.label} (${t.description})`).join('; ')}.`);
  }
  lines.push(
    `Right now: ${ctx.situation.activity} in ${roomPhrase(ctx.situation.location)}. Status: ${ctx.situation.status}, focus ${ctx.situation.focus}.`,
  );
  if (ctx.feeling.dominant) lines.push(`Strongest feeling: ${ctx.feeling.dominant}.`);
  if (ctx.threads.length) lines.push(`On your mind: ${ctx.threads.join('; ')}.`);
  if (ctx.relationships.length) {
    lines.push('People:');
    for (const r of ctx.relationships) {
      lines.push(`- ${r.name}${r.labels.length ? ` [${r.labels.join(', ')}]` : ''}: ${r.summary}`);
    }
  }
  if (ctx.beliefs.length) {
    lines.push('What you believe:');
    for (const b of ctx.beliefs) lines.push(`- ${b.text} (confidence ${b.confidence.toFixed(2)})`);
  }
  if (ctx.memories.length) {
    lines.push('Relevant memories:');
    for (const m of ctx.memories) lines.push(`- [${m.when}${m.source !== 'witnessed' ? `, ${m.source}` : ''}] ${m.text}`);
  }
  return lines.join('\n');
}
