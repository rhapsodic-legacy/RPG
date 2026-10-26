// Perception: objective events become subjective memories, moods and
// relationship changes — but only for those who perceived them.

import { addScaled, valence } from '../emotion';
import type { CognitionProviders } from '../cognition/providers';
import { CORE_IMPORTANCE, GOSSIP_WORTHY, knowsEvent, MIN_STORED_IMPORTANCE } from '../mind/memory';
import { COACH_ID, type EntityId, type FighterId, type MemorySource, type SimState, type WorldEvent } from '../types';
import { clamp01 } from '../util/math';
import { applyRelDelta, getFighter, nameOf, peekRel } from '../world';

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
  addScaled(f.state.mood, appraisal.emotions, 0.6);
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
    tags: [...new Set(appraisal.tags)].sort(),
    createdAt: state.tick,
    lastRecalled: state.tick,
    core: appraisal.importance >= CORE_IMPORTANCE,
    gloss,
  });
}

/** Deliver an event to everyone who perceived it (and propagate gossip). */
export function perceive(state: SimState, providers: CognitionProviders, event: WorldEvent): void {
  const source: MemorySource = event.type === 'reflection' ? 'inferred' : 'witnessed';
  for (const w of event.witnesses) integrate(state, providers, w, event, source, 1);

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
