// Rule-based social behaviour: whom to engage, and how, when sharing a room.

import { GOSSIP_WORTHY, recencyOf } from '../../mind/memory';
import type { FighterId, SimState } from '../../types';
import { unit } from '../../util/math';
import { bond, cooldownReady, getFighter, partnerOf, peekRel } from '../../world';
import type { InteractionChoice, InteractionPolicy } from '../providers';

/** Minimum utility for a fighter to bother engaging at all. */
const THRESHOLD = 0.25;

/** Event types worth passing on. */

export function interactionCooldownKey(kind: string, actor: FighterId, target: FighterId): string {
  return `${kind}:${actor}>${target}`;
}

/** Will `target` accept an apology from `actor`? Deterministic, personality-driven. */
export function acceptsApology(state: SimState, target: FighterId, actor: FighterId): boolean {
  const t = getFighter(state, target).temperament;
  const r = peekRel(state, target, actor);
  const willingness =
    0.25 + 0.4 * unit(t.loyalty) + 0.3 * r.familiarity + 0.2 * r.respect - r.resentment * (0.3 + 0.5 * unit(t.ego)) - 0.2 * unit(t.volatility);
  return willingness > 0;
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

  choose(state: SimState, actor: FighterId, present: FighterId[]): InteractionChoice | null {
    const me = getFighter(state, actor);
    const t = me.temperament;
    const myPartner = partnerOf(state, actor);
    let best: InteractionChoice | null = null;
    const consider = (choice: InteractionChoice, cooldown: number) => {
      if (choice.utility < THRESHOLD) return;
      if (!cooldownReady(state, interactionCooldownKey(choice.kind, actor, choice.target), cooldown)) return;
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
            utility: 0.2 + 0.35 * (1 - me.state.needs.social) + 0.2 * unit(t.sociability) + 0.3 * r.affection,
          },
          4,
        );
      }

      if (r.attraction > 0.3 && myPartner !== other) {
        let restraint = 0;
        if (myPartner) restraint += 0.2 + 0.4 * unit(t.loyalty);
        if (theirPartner) restraint += 0.1 + 0.4 * unit(t.loyalty) * Math.max(0, peekRel(state, actor, theirPartner).affection);
        consider(
          { kind: 'flirt', target: other, utility: r.attraction * 0.9 * (0.5 + 0.5 * unit(t.romance)) - restraint },
          6,
        );
      }

      if (
        !myPartner &&
        !theirPartner &&
        r.attraction >= 0.55 &&
        back.attraction >= 0.5 &&
        r.familiarity >= 0.3
      ) {
        consider({ kind: 'ask_out', target: other, utility: 1 + r.attraction }, 12);
      }

      if (myPartner === other) {
        consider({ kind: 'affection_display', target: other, utility: 0.55 }, 6);
      }

      const sadness = getFighter(state, other).state.mood.sadness;
      if (sadness > 0.3 && r.affection > 0.3 && !guiltyAbout) {
        consider({ kind: 'comfort', target: other, utility: 0.3 + sadness * 0.5 + 0.2 * unit(t.loyalty) }, 8);
      }

      // Make amends when guilt outweighs grievance.
      const guilt = me.threads.find((th) => th.kind === 'guilt' && th.about[0] === other)?.weight ?? 0;
      const theirGrievance = back.resentment;
      if ((guilt > 0 || theirGrievance > 0.3) && r.resentment < 0.6 + guilt) {
        consider(
          {
            kind: 'apologize',
            target: other,
            utility: 0.2 + guilt * (1 + unit(t.loyalty)) + theirGrievance * 0.6 * unit(t.discipline) - 0.3 * unit(t.ego) - r.resentment * 0.5,
          },
          3 * 48,
        );
      }

      const gossip = bestGossip(state, actor, other);
      if (gossip && gossip.juiciness >= 0.15) {
        consider(
          {
            kind: 'gossip',
            target: other,
            utility: 0.3 + gossip.juiciness * 1.5 * (0.4 + 0.6 * unit(t.sociability)),
            aboutEventId: gossip.eventId,
          },
          8,
        );
      }
    }
    return best;
  }
}
