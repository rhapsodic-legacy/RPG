// Rule-based reflection: nightly pattern-matching over recent memories.

import { TICKS_PER_WEEK } from '../../time';
import { COACH_ID, type FighterId, type Memory, type SimState, type WorldEvent } from '../../types';
import { clamp01 } from '../../util/math';
import { getFighter, peekRel } from '../../world';
import type { BeliefCandidate, Reflector } from '../providers';

function eventOf(state: SimState, m: Memory): WorldEvent | undefined {
  return state.events[Number(m.eventId.slice(1))];
}

export class RuleReflector implements Reflector {
  readonly id = 'rules.reflector';

  reflect(state: SimState, id: FighterId): BeliefCandidate[] {
    const f = getFighter(state, id);
    const since = state.tick - TICKS_PER_WEEK;
    const recent = f.memories.filter((m) => m.createdAt >= since && m.source !== 'inferred');
    const out: BeliefCandidate[] = [];

    // Betrayal: a friend got romantic with someone I'm attached to.
    // Preference: someone I'm attached to chose someone else.
    for (const m of recent) {
      if (m.emotions.jealousy < 0.2) continue;
      const e = eventOf(state, m);
      if (!e || (e.type !== 'romance_start' && e.type !== 'affection_display')) continue;
      const pair = [...e.actors, ...e.targets];
      for (const beloved of pair) {
        const rival = pair.find((p) => p !== beloved)!;
        const r = peekRel(state, id, beloved);
        if (r.attraction < 0.45 && !r.labels.includes('ex') && !r.labels.includes('dating')) continue;
        out.push({
          subject: beloved,
          predicate: 'prefers',
          object: rival,
          confidence: clamp01(0.4 + m.confidence * 0.5),
          evidence: [m.id],
        });
        if (m.emotions.anger > 0.15 && peekRel(state, id, rival).trust > -0.5) {
          out.push({
            subject: rival,
            predicate: 'betrayed_me',
            confidence: clamp01(m.emotions.anger + m.emotions.jealousy * 0.5),
            evidence: [m.id],
          });
        }
      }
    }

    // Hostility / kindness: repeated treatment by the same person.
    const byActor = new Map<FighterId, { hostile: string[]; kind: string[] }>();
    for (const m of recent) {
      const e = eventOf(state, m);
      if (!e) continue;
      for (const actor of [...e.actors, ...e.targets]) {
        if (actor === id) continue;
        const entry = byActor.get(actor) ?? { hostile: [], kind: [] };
        if (m.emotions.anger > 0.25 && (e.type === 'argument' || e.type === 'brawl')) entry.hostile.push(m.id);
        if (m.emotions.affection + m.emotions.gratitude > 0.3 && e.targets.includes(id)) entry.kind.push(m.id);
        byActor.set(actor, entry);
      }
    }
    for (const [actor, entry] of [...byActor.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
      if (entry.hostile.length >= 2) {
        out.push({ subject: actor, predicate: 'is_hostile_to_me', confidence: clamp01(0.3 * entry.hostile.length), evidence: entry.hostile });
      }
      if (entry.kind.length >= 3 && peekRel(state, id, actor).resentment < 0.3) {
        out.push({ subject: actor, predicate: 'is_kind_to_me', confidence: clamp01(0.2 * entry.kind.length), evidence: entry.kind });
      }
    }

    // Bad cook: repeated bad meals from the same cook.
    const badMeals = new Map<FighterId, string[]>();
    for (const m of recent) {
      const e = eventOf(state, m);
      if (e?.type !== 'meal' || !e.meal?.cook || e.meal.quality >= 0.4 || e.meal.cook === id) continue;
      badMeals.set(e.meal.cook, [...(badMeals.get(e.meal.cook) ?? []), m.id]);
    }
    for (const [cook, ids] of [...badMeals.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
      if (ids.length >= 2) out.push({ subject: cook, predicate: 'is_bad_cook', confidence: clamp01(0.25 * ids.length), evidence: ids });
    }

    // Coach favouritism: the coach keeps cheering for a rival.
    const favoured = new Map<FighterId, string[]>();
    for (const m of recent) {
      if (!m.tags.includes('coach_favours_rival')) continue;
      const e = eventOf(state, m);
      for (const intent of e?.utterance?.interpretation.intents ?? []) {
        if (intent.target && intent.target !== id) favoured.set(intent.target, [...(favoured.get(intent.target) ?? []), m.id]);
      }
    }
    for (const [who, ids] of [...favoured.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
      out.push({ subject: COACH_ID, predicate: 'favours', object: who, confidence: clamp01(0.35 * ids.length), evidence: ids });
    }

    return out;
  }
}
