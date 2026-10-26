// Conversations take time. Two people talk for as long as both of them would
// rather keep talking than do anything else. What keeps them there: liking each
// other, attraction, needing company, having something to say. What winds it
// down: company stops being needed, news runs out, hunger, a match on TV, bed.

import { routineOf } from '../home/routine';
import { GOSSIP_WORTHY, knowsEvent, recencyOf } from '../mind/memory';
import type { Conversation, ConversationKind, EntityId, FighterId, Pastime, SimState } from '../types';
import { unit } from '../util/math';
import { bond, getFighter, peekRel } from '../world';

export interface Topic {
  /** Unique per thing-to-say; once told to someone, it's been said. */
  key: string;
  kind: 'news' | 'feelings' | 'pastime';
  eventId?: string;
  memoryId?: string;
  about?: EntityId;
  pastime?: Pastime;
  weight: number;
}

/** The kind of thing you'd get off your chest. */
const CONFIDABLE: ReadonlySet<string> = new Set(['injury', 'breakup', 'romance_start', 'argument', 'brawl', 'knockout', 'match_result', 'rescue', 'apology', 'speech', 'coach_spoke']);

/** Things `speaker` could tell `listener` that they haven't already. */
export function topicsFor(state: SimState, speaker: FighterId, listener: FighterId): Topic[] {
  const s = getFighter(state, speaker);
  const l = getFighter(state, listener);
  const told = new Set(s.state.told[listener] ?? []);
  const out: Topic[] = [];
  const trust = Math.max(peekRel(state, speaker, listener).trust, peekRel(state, speaker, listener).affection);
  for (const m of s.memories) {
    if (told.has(m.id) || m.source === 'inferred') continue;
    const e = state.events[Number(m.eventId.slice(1))];
    if (!e) continue;
    const involved = [...e.actors, ...e.targets];
    if (m.tags.some((t) => GOSSIP_WORTHY.has(t)) && !involved.includes(listener) && !knowsEvent(l, e.id)) {
      let concern = 0;
      for (const p of involved) concern = Math.max(concern, bond(state, listener, p));
      out.push({ key: m.id, kind: 'news', eventId: e.id, memoryId: m.id, weight: (0.3 + m.importance) * (0.3 + concern) * recencyOf(m, state.tick) });
    } else if (CONFIDABLE.has(e.type) && m.importance >= 0.35 && trust > 0.2 && state.tick - m.createdAt < 96 && !involved.includes(listener)) {
      // Getting something off your chest, with someone you trust.
      out.push({ key: m.id, kind: 'feelings', memoryId: m.id, ...(involved[0] ? { about: involved.find((p) => p !== speaker) ?? involved[0] } : {}), weight: m.importance * trust });
    }
  }
  return out.sort((a, b) => b.weight - a.weight || (a.key < b.key ? -1 : 1));
}

/** A pastime both enjoy: always something to chat about. */
export function sharedPastime(state: SimState, a: FighterId, b: FighterId): Pastime | null {
  const ra = routineOf(getFighter(state, a)).pastimes;
  const rb = routineOf(getFighter(state, b)).pastimes;
  let best: Pastime | null = null;
  let score = 0.25;
  for (const p of Object.keys(ra).sort() as Pastime[]) {
    const v = Math.min(ra[p] ?? 0, rb[p] ?? 0);
    if (v > score) {
      score = v;
      best = p;
    }
  }
  return best;
}

/**
 * How much `me` wants to keep talking to `other` right now. Nothing here counts
 * minutes: it falls as company stops being needed and things to say run out.
 */
export function engagement(state: SimState, me: FighterId, other: FighterId, kind: ConversationKind): number {
  const f = getFighter(state, me);
  const t = f.temperament;
  const r = peekRel(state, me, other);
  const n = f.state.needs;
  const romantic = kind === 'flirt' || r.labels.includes('dating') ? 0.5 * r.attraction * (0.5 + unit(t.romance)) : 0;
  // Having news only makes you seek someone out if you're the type to share it.
  const talker = 0.08 + 0.15 * unit(t.sociability);
  const somethingToSay = topicsFor(state, me, other).length > 0 ? talker : sharedPastime(state, me, other) ? 0.4 * talker : 0;
  const sadness = kind === 'comfort' ? 0.3 * Math.max(getFighter(state, other).state.mood.sadness, f.state.mood.sadness) : 0;
  // Wanting company is the engine; who it's with sets how much of it you want.
  const appetite = 0.15 + 0.85 * (1 - n.social);
  const pull = 0.3 + 0.5 * unit(t.sociability) + 0.4 * Math.max(0, r.affection) + romantic;
  return appetite * pull + somethingToSay + sadness - 0.5 * r.resentment - 0.3 * (1 - n.energy);
}

/** Below this, a fighter would rather be doing something else. */
export const WILLING_TO_TALK = 0.3;

export function conversationOf(state: SimState, id: FighterId): Conversation | undefined {
  const cid = getFighter(state, id).state.conversation;
  return cid ? state.conversations.find((c) => c.id === cid) : undefined;
}

export function partnerIn(c: Conversation, id: FighterId): FighterId {
  return c.participants[0] === id ? c.participants[1] : c.participants[0];
}

export function markTold(state: SimState, speaker: FighterId, listener: FighterId, key: string): void {
  const f = getFighter(state, speaker);
  const list = (f.state.told[listener] ??= []);
  if (!list.includes(key)) list.push(key);
}
