// Perception: objective events become subjective memories, moods and
// relationship changes — but only for those who perceived them.

import { feel, valence } from '../emotion';
import type { CognitionProviders } from '../cognition/providers';
import { CORE_IMPORTANCE, GOSSIP_WORTHY, knowsEvent, MIN_STORED_IMPORTANCE } from '../mind/memory';
import { COACH_ID, type EntityId, type FighterId, type MemorySource, type SimState, type WorldEvent } from '../types';
import { clamp01 } from '../util/math';
import { applyRelDelta, getFighter, nameOf, peekRel } from '../world';

/** A resentment bump this small is a passing irritation, not something to have out. */
const GRIEVANCE_MIN = 0.03;

function entitiesOf(event: WorldEvent): EntityId[] {
  const ids = new Set<EntityId>([...event.actors, ...event.targets, event.location]);
  if (event.meal?.cook) ids.add(event.meal.cook);
  if (event.utterance) {
    ids.add(COACH_ID);
    for (const m of event.utterance.interpretation.mentions) ids.add(m);
  }
  if (event.reflection) {
    ids.add(event.reflection.subject);
    if (event.reflection.object) ids.add(event.reflection.object);
  }
  return [...ids].sort();
}

export function integrate(
  state: SimState,
  providers: CognitionProviders,
  perceiver: FighterId,
  event: WorldEvent,
  source: MemorySource,
  confidence: number,
  teller?: FighterId,
): void {
  const f = getFighter(state, perceiver);
  const appraisal = providers.appraiser.appraise({ state, perceiver, event, source, confidence, teller });

  for (const d of appraisal.deltas) applyRelDelta(state, perceiver, d);
  for (const [need, v] of Object.entries(appraisal.needs ?? {})) {
    const n = f.state.needs as unknown as Record<string, number>;
    n[need] = clamp01((n[need] ?? 0) + (v as number));
  }
  feel(f.state.mood, appraisal.emotions, 0.6);
  // Anything that made me resent someone is a grievance I may want to have out with them.
  const tags = [...appraisal.tags];
  for (const d of appraisal.deltas) {
    if ((d.resentment ?? 0) >= GRIEVANCE_MIN && (state.fighters[d.toward] || state.outsiders[d.toward])) tags.push(`grievance:${d.toward}`);
  }
  f.state.importanceSinceReflection += appraisal.importance;
  if (GOSSIP_WORTHY.has(event.type) && !f.known.includes(event.id)) f.known.push(event.id);

  if (appraisal.importance < MIN_STORED_IMPORTANCE) return;
  const gloss = source === 'told' && teller ? `${nameOf(state, teller)} told me: ${event.gloss}` : event.gloss;
  f.memories.push({
    id: `m${state.nextMemoryId++}`,
    eventId: event.id,
    source,
    ...(teller ? { toldBy: teller } : {}),
    confidence,
    emotions: appraisal.emotions,
    valence: valence(appraisal.emotions),
    importance: appraisal.importance,
    entities: entitiesOf(event),
    tags: [...new Set(tags)].sort(),
    createdAt: state.tick,
    lastRecalled: state.tick,
    core: appraisal.importance >= CORE_IMPORTANCE,
    gloss,
  });
}

/** Unvoiced grievances `id` holds against `other`, weighted by importance. */
export function unaddressedGrievance(state: SimState, id: FighterId, other: FighterId): number {
  const tag = `grievance:${other}`;
  let total = 0;
  for (const m of getFighter(state, id).memories) if (!m.addressed && m.tags.includes(tag)) total += m.importance;
  return total;
}

/** Having it out with someone voices every grievance held against them so far. */
function voiceGrievances(state: SimState, id: FighterId, other: FighterId): void {
  const tag = `grievance:${other}`;
  for (const m of getFighter(state, id).memories) if (m.tags.includes(tag)) m.addressed = true;
}

/** Deliver an event to everyone who perceived it (and propagate gossip). */
export function perceive(state: SimState, providers: CognitionProviders, event: WorldEvent): void {
  const source: MemorySource = event.type === 'reflection' ? 'inferred' : 'witnessed';
  for (const w of event.witnesses) integrate(state, providers, w, event, source, 1);

  if (event.confrontation) {
    const initiator = event.actors[0]!;
    const target = event.targets[0]!;
    voiceGrievances(state, initiator, target);
    if (event.confrontation.response !== 'walked_away') voiceGrievances(state, target, initiator);
  }

  if (event.type === 'gossip' && event.gossip) {
    const teller = event.actors[0]!;
    const listener = event.targets[0]!;
    const about = state.events[Number(event.gossip.aboutEventId.slice(1))];
    if (about && !knowsEvent(getFighter(state, listener), about.id)) {
      const trust = peekRel(state, listener, teller).trust;
      const confidence = clamp01(0.6 + 0.35 * trust);
      integrate(state, providers, listener, about, 'told', confidence, teller);
    }
  }
}
