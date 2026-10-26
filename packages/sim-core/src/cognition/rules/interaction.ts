// Rule-based social behaviour: whom to engage, and how, when sharing a room.

import { GOSSIP_WORTHY, recencyOf } from '../../mind/memory';
import { unaddressedGrievance } from '../../sim/perception';
import { engagement, WILLING_TO_TALK } from '../../sim/conversation';
import type { FighterId, SimState } from '../../types';
import { unit } from '../../util/math';
import { bond, getFighter, partnerOf, peekRel } from '../../world';
import type { ConfrontationResponse, InteractionChoice, InteractionPolicy } from '../providers';

/** Minimum utility for a fighter to bother engaging at all. */
const THRESHOLD = 0.25;

export function interactionCooldownKey(kind: string, actor: FighterId, target: FighterId): string {
  return `${kind}:${actor}>${target}`;
}

/** Recently turned down romantically by this person (fading as memories do). */
export function turnedDownBy(state: SimState, actor: FighterId, other: FighterId): number {
  let sum = 0;
  for (const m of getFighter(state, actor).memories) {
    if (m.tags.includes('turned_down') && m.entities.includes(other)) sum += recencyOf(m, state.tick) * 1.5;
  }
  return sum;
}

/** "They just told me they're busy": recent brush-offs from this person, fading as memories do. */
export function recentlyRebuffed(state: SimState, actor: FighterId, other: FighterId): number {
  let sum = 0;
  for (const m of getFighter(state, actor).memories) {
    if (m.tags.includes('brushed_off') && m.entities.includes(other)) sum += recencyOf(m, state.tick);
  }
  return 0.5 * sum;
}

/**
 * "I've already apologised for that": an accepted apology covers everything up to
 * it, until something new goes wrong between us.
 */
export function alreadyMadeAmends(state: SimState, actor: FighterId, other: FighterId): boolean {
  const at = state.cooldowns[`apology_ok:${actor}>${other}`];
  if (at === undefined) return false;
  return !getFighter(state, actor).memories.some(
    (m) => m.createdAt > at && m.valence < 0 && m.entities.includes(other) && !m.tags.includes('apology'),
  );
}

/**
 * The urge to have it out with someone: unvoiced grievances and anger, held back
 * by discipline, pragmatism (a divided team loses) and fear.
 */
export function confrontUtility(state: SimState, actor: FighterId, other: FighterId): number {
  const me = getFighter(state, actor);
  const t = me.temperament;
  const r = peekRel(state, actor, other);
  const grievance = unaddressedGrievance(state, actor, other);
  const drive =
    grievance * (0.5 + 0.5 * unit(t.aggression) + 0.3 * unit(t.volatility)) + r.resentment * me.state.mood.anger * 0.6;
  const restraint =
    0.25 * unit(t.discipline) +
    0.3 * unit(t.pragmatism) +
    r.fear * (1 - unit(t.courage)) +
    0.15 * (1 - unit(t.courage)) +
    // You think twice before tearing into a friend.
    Math.max(0, r.affection) * unit(t.loyalty) * 0.5;
  return drive - restraint;
}

/**
 * The juiciest thing `teller` knows that `listener` doesn't, about people the
 * listener cares about.
 */
export function bestGossip(
  state: SimState,
  teller: FighterId,
  listener: FighterId,
): { eventId: string; juiciness: number } | null {
  const t = getFighter(state, teller);
  const l = getFighter(state, listener);
  const known = new Set([...l.memories.map((m) => m.eventId), ...l.known]);
  let best: { eventId: string; juiciness: number } | null = null;
  for (const m of t.memories) {
    if (m.source === 'inferred' || known.has(m.eventId)) continue;
    if (!m.tags.some((tag) => GOSSIP_WORTHY.has(tag))) continue;
    const event = state.events[Number(m.eventId.slice(1))];
    if (!event) continue;
    const involved = [...event.actors, ...event.targets];
    if (involved.includes(teller) || involved.includes(listener)) continue;
    let concern = 0;
    for (const p of involved) concern = Math.max(concern, bond(state, listener, p));
    // Gossiping about someone you resent is extra tempting; so is telling a
    // friend something they "deserve to know".
    let spite = 0;
    for (const p of involved) spite = Math.max(spite, peekRel(state, teller, p).resentment);
    const dutyToTell = Math.max(0, peekRel(state, teller, listener).affection) * unit(t.temperament.loyalty) * concern;
    const juiciness = (0.3 + m.importance) * (0.3 + concern) * (0.5 + spite + dutyToTell) * recencyOf(m, state.tick);
    if (!best || juiciness > best.juiciness) best = { eventId: m.eventId, juiciness };
  }
  return best;
}

export class RuleInteractionPolicy implements InteractionPolicy {
  readonly id = 'rules.interaction';

  strikesFirst(state: SimState, initiator: FighterId, target: FighterId): boolean {
    const f = getFighter(state, initiator);
    const t = f.temperament;
    const rage =
      f.state.mood.anger * (0.5 + unit(t.volatility)) +
      peekRel(state, initiator, target).resentment * unit(t.aggression) -
      0.5 * unit(t.discipline) -
      0.3 * unit(t.pragmatism);
    return rage > 0.8;
  }

  respondToConfrontation(state: SimState, target: FighterId, initiator: FighterId): ConfrontationResponse {
    const f = getFighter(state, target);
    const t = f.temperament;
    const r = peekRel(state, target, initiator);
    const heat =
      r.resentment +
      f.state.mood.anger * 0.5 +
      0.3 * unit(t.aggression) +
      0.3 * unit(t.volatility) +
      0.2 * unit(t.ego) -
      0.3 * unit(t.discipline) -
      0.3 * unit(t.pragmatism) -
      r.fear * (1 - unit(t.courage));
    if (heat > 1.1 && unit(t.courage) > 0.4) return 'fought_back';
    if (heat > 0.45) return 'argued_back';
    return 'walked_away';
  }

  acceptsAdvance(state: SimState, target: FighterId, actor: FighterId): boolean {
    const me = getFighter(state, target);
    const toThem = peekRel(state, target, actor).attraction;
    if (toThem < 0.5 || partnerOf(state, target)) return false;
    // Only if they're the one I want most right now.
    for (const [other, r] of Object.entries(me.relationships)) {
      if (other !== actor && (state.fighters[other] || state.outsiders[other]) && r.attraction > toThem + 0.05) return false;
    }
    return true;
  }

  acceptsApology(state: SimState, target: FighterId, actor: FighterId): boolean {
    const t = getFighter(state, target).temperament;
    const r = peekRel(state, target, actor);
    const willingness =
      0.25 +
      0.4 * unit(t.loyalty) +
      0.3 * unit(t.pragmatism) +
      0.3 * r.familiarity +
      0.2 * r.respect -
      r.resentment * (0.3 + 0.5 * unit(t.ego)) -
      0.2 * unit(t.volatility);
    return willingness > 0;
  }

  choose(state: SimState, actor: FighterId, present: FighterId[]): InteractionChoice | null {
    const me = getFighter(state, actor);
    const t = me.temperament;
    const myPartner = partnerOf(state, actor);
    let best: InteractionChoice | null = null;
    // `pacing` (slots) was a cap on repeating the same small gesture (a chat, a flirt).
    // PACING LIMITS DISABLED: observing how behaviour grows without them before
    // deciding which limits are needed, and how. To restore, uncomment below.
    const consider = (choice: InteractionChoice, _pacing = 0) => {
      if (choice.utility < THRESHOLD) return;
      // if (_pacing && !cooldownReady(state, interactionCooldownKey(choice.kind, actor, choice.target), _pacing)) return;
      if (!best || choice.utility > best.utility) best = choice;
    };

    for (const other of present) {
      if (other === actor) continue;
      const r = peekRel(state, actor, other);
      const back = peekRel(state, other, actor);
      const theirPartner = partnerOf(state, other);
      const guiltyAbout = me.threads.some((th) => th.kind === 'guilt' && th.about[0] === other);

      if (r.resentment < 0.35 && r.affection > -0.3) {
        consider(
          {
            kind: 'chat',
            target: other,
            // Only if talking to them beats what I'm doing right now.
            utility:
              engagement(state, actor, other, 'chat') -
              Math.max(me.state.engrossed, WILLING_TO_TALK) +
              THRESHOLD -
              recentlyRebuffed(state, actor, other) -
              // Reading the room: you can see they're absorbed. Only the pushy barge in.
              getFighter(state, other).state.engrossed * (0.2 + 0.6 * unit(t.discipline) - 0.3 * unit(t.sociability)),
          },
          4,
        );
      }

      if (r.attraction > 0.3 && myPartner !== other) {
        let restraint = 0;
        if (myPartner) restraint += 0.2 + 0.4 * unit(t.loyalty);
        if (theirPartner) restraint += 0.1 + 0.4 * unit(t.loyalty) * Math.max(0, peekRel(state, actor, theirPartner).affection);
        consider(
          { kind: 'flirt', target: other, utility: r.attraction * 0.9 * (0.5 + 0.5 * unit(t.romance)) - restraint - recentlyRebuffed(state, actor, other) },
          6,
        );
      }

      if (
        !myPartner &&
        !theirPartner &&
        r.attraction >= 0.55 &&
        r.familiarity >= 0.3
      ) {
        // Only the one you want most; hope, courage and ego push; a recent no holds you back.
        const mostWanted = Object.entries(me.relationships).every(
          ([o, x]) => o === other || !(state.fighters[o] || state.outsiders[o]) || x.attraction <= r.attraction,
        );
        const nerve = !mostWanted ? 0 : 0.4 + r.attraction + 0.3 * unit(t.courage) + 0.2 * unit(t.ego) - turnedDownBy(state, actor, other);
        consider({ kind: 'ask_out', target: other, utility: nerve });
      }

      // Couples spend time together: a romantic conversation, visible to anyone around.
      if (myPartner === other) {
        consider({ kind: 'flirt', target: other, utility: engagement(state, actor, other, 'flirt') - Math.max(me.state.engrossed, WILLING_TO_TALK) + THRESHOLD - recentlyRebuffed(state, actor, other) });
      }

      const sadness = getFighter(state, other).state.mood.sadness;
      if (sadness > 0.3 && r.affection > 0.3 && !guiltyAbout) {
        consider({ kind: 'comfort', target: other, utility: 0.3 + sadness * 0.5 + 0.2 * unit(t.loyalty) - recentlyRebuffed(state, actor, other) });
      }

      // Make amends: out of guilt, or because a feud costs the team. Having already
      // been turned away (an unaddressed grievance against them) makes it harder.
      const guilt = me.threads.find((th) => th.kind === 'guilt' && th.about[0] === other)?.weight ?? 0;
      const theirGrievance = back.resentment;
      const rebuffed = unaddressedGrievance(state, actor, other);
      if ((guilt > 0 || theirGrievance > 0.3) && !alreadyMadeAmends(state, actor, other)) {
        consider({
          kind: 'apologize',
          target: other,
          utility:
            0.2 +
            guilt * (1 + unit(t.loyalty)) +
            theirGrievance * 0.4 * (unit(t.discipline) + unit(t.pragmatism)) -
            0.3 * unit(t.ego) -
            r.resentment * 0.5 -
            rebuffed,
        });
      }

      const confront = confrontUtility(state, actor, other);
      if (confront > 0) consider({ kind: 'confront', target: other, utility: confront });

      const gossip = bestGossip(state, actor, other);
      if (gossip && gossip.juiciness >= 0.15) {
        consider({
          kind: 'gossip',
          target: other,
          utility: 0.3 + gossip.juiciness * 1.5 * (0.4 + 0.6 * unit(t.sociability)) - recentlyRebuffed(state, actor, other),
          aboutEventId: gossip.eventId,
        });
      }
    }
    return best;
  }
}
