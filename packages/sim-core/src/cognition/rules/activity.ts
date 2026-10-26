// Rule-based home planner: needs + temperament + who-is-where.

import { enjoys, isSleepTimeFor, peakHours, routineOf } from '../../home/routine';
import { conversationOf, engagement, partnerIn } from '../../sim/conversation';
import { mealAt, mealKey } from '../../time';
import { PORTABLE_PASTIMES, type Fighter, type FighterId, type Pastime, type RoomId, type SimState } from '../../types';
import { unit } from '../../util/math';
import { attachment, bond, getFighter, isInjured, peekRel, roomsOfKind } from '../../world';
import type { ActivityChoice, ActivityContext, ActivityPolicy } from '../providers';

/** How much `me` wants to steer clear of `other` (resentment, discomfort, guilt). */
export function avoidance(state: SimState, me: FighterId, other: FighterId): number {
  const t = getFighter(state, me).temperament;
  const r = peekRel(state, me, other);
  const fromResentment = r.resentment * (1 - 0.6 * unit(t.courage));
  const fromDiscomfort = r.fear * (1 - 0.4 * unit(t.courage));
  return fromResentment + fromDiscomfort;
}

/** How much `me` wants to be near `other`. */
export function affinity(state: SimState, me: FighterId, other: FighterId): number {
  const t = getFighter(state, me).temperament;
  return Math.max(0, peekRel(state, me, other).affection) * 0.15 * (0.5 + unit(t.sociability)) +
    attachment(state, me, other) * 0.25;
}

/** Social pull/push of a room, given who is expected there. */
function roomSocialScore(ctx: ActivityContext, room: RoomId): { score: number; note: string } {
  const { state, fighter: me, expected, } = ctx;
  let score = 0;
  const notes: string[] = [];
  const intents = getFighter(state, me).state.intents;
  for (const [other, loc] of Object.entries(expected)) {
    if (other === me || loc !== room) continue;
    const avoid = avoidance(state, me, other);
    const seek = affinity(state, me, other);
    score += seek - avoid;
    if (avoid > 0.25) notes.push(`avoiding ${other}`);
    for (const intent of intents) {
      if (intent.target !== other) continue;
      score += intent.type === 'seek' ? 1 : -1;
      notes.push(`${intent.type} ${other}${intent.reason ? ` (${intent.reason})` : ''}`);
    }
  }
  return { score, note: notes.join(', ') };
}

function cookingKitchen(state: SimState, f: Fighter): RoomId | null {
  for (const kitchenId of Object.keys(state.kitchens).sort()) {
    const cook = state.kitchens[kitchenId]!.cooks.find((id) => {
      const c = getFighter(state, id);
      return !isInjured(c, state.tick);
    });
    if (cook === f.def.id) return kitchenId;
  }
  return null;
}

export class RuleActivityPolicy implements ActivityPolicy {
  readonly id = 'rules.activity';

  choose(ctx: ActivityContext): ActivityChoice {
    const { state, fighter: id } = ctx;
    const f = getFighter(state, id);
    const t = f.temperament;
    const n = f.state.needs;
    const tick = state.tick;

    if (isInjured(f, tick)) {
      const infirmary = roomsOfKind(state, 'infirmary')[0];
      return { activity: 'recover', location: infirmary?.id ?? f.def.bedroomId, reason: 'injured' };
    }
    if (isSleepTimeFor(f, tick)) {
      return { activity: 'sleep', location: f.def.bedroomId, reason: 'night' };
    }

    const options: ActivityChoice[] = [];
    const utilities: number[] = [];
    const add = (choice: ActivityChoice, u: number) => {
      options.push(choice);
      utilities.push(u);
    };

    const meal = mealAt(tick);
    if (meal) {
      const kitchen = cookingKitchen(state, f);
      if (kitchen) return { activity: 'cook', location: kitchen, reason: `cooking ${meal}` };
      if (f.state.lastMeal !== mealKey(tick)) {
        for (const k of roomsOfKind(state, 'kitchen')) {
          const social = roomSocialScore(ctx, k.id);
          add(
            { activity: 'eat', location: k.id, reason: `${meal}${social.note ? `; ${social.note}` : ''}` },
            0.6 + (1 - n.fullness) * 1.2 + social.score,
          );
        }
      }
    }

    for (const gym of roomsOfKind(state, 'gym')) {
      const social = roomSocialScore(ctx, gym.id);
      const tired = 0.7 * (1 - n.energy) * (1 - n.energy);
      add(
        { activity: 'train', location: gym.id, reason: `training${social.note ? `; ${social.note}` : ''}` },
        0.3 + 0.3 * unit(t.discipline) + 0.2 * n.energy - tired + peakHours(f, tick) + social.score,
      );
    }
    for (const common of roomsOfKind(state, 'common')) {
      const social = roomSocialScore(ctx, common.id);
      add(
        { activity: 'socialize', location: common.id, reason: `hanging out${social.note ? `; ${social.note}` : ''}` },
        // Hanging out is for people who enjoy company; loners meet the need other ways.
        0.1 + (1 - n.social) * 0.7 * (0.3 + 0.7 * unit(t.sociability)) + 0.15 * unit(t.sociability) + social.score,
      );
    }
    // Pastimes: wherever they're on offer — and books and music go wherever you do,
    // including the room where someone you like happens to spend their evenings.
    const pastimes = routineOf(f).pastimes;
    for (const p of Object.keys(pastimes).sort() as Pastime[]) {
      const love = enjoys(f, p);
      if (love < 0.2) continue;
      const portable = PORTABLE_PASTIMES.includes(p);
      const rooms = state.layout.rooms.filter(
        (r) => r.amenities?.includes(p) || (portable && (r.kind === 'common' || r.id === f.def.bedroomId)),
      );
      for (const room of rooms) {
        const social = roomSocialScore(ctx, room.id);
        // Alone with a book in your own room is its own pleasure for the unsociable.
        const solitude = room.id === f.def.bedroomId ? 0.15 * (1 - unit(t.sociability)) : 0;
        add(
          { activity: 'pastime', location: room.id, pastime: p, reason: `${p}${social.note ? `; ${social.note}` : ''}` },
          0.05 + love * (0.25 + 0.6 * (1 - n.fun)) + solitude + social.score,
        );
      }
    }

    // Mid-conversation: keep talking, if that still beats everything else.
    const convo = conversationOf(state, id);
    if (convo) {
      const other = partnerIn(convo, id);
      add({ activity: 'talk', location: convo.location, reason: `talking with ${other}` }, engagement(state, id, other, convo.kind));
    }

    add(
      { activity: 'relax', location: f.def.bedroomId, reason: 'time alone' },
      0.1 + (1 - n.comfort) * 0.5 + (1 - n.energy) * 0.3 + 0.2 * (1 - unit(t.sociability)) + f.state.mood.sadness * 0.3,
    );

    // Visit injured people you care about, once a day.
    const day = Math.floor(tick / 48);
    for (const [otherId, other] of Object.entries(state.fighters).sort(([a], [b]) => (a < b ? -1 : 1))) {
      if (otherId === id || !isInjured(other, tick)) continue;
      if (f.state.lastVisit[otherId] === day) continue;
      const care = bond(state, id, otherId);
      if (care < 0.3) continue;
      add(
        { activity: 'visit', location: other.state.location, reason: `visiting ${otherId}`, visitTarget: otherId },
        care * (0.3 + 0.6 * unit(t.loyalty)) + 0.2 - avoidance(state, id, otherId),
      );
    }

    let best = 0;
    for (let i = 1; i < options.length; i++) if (utilities[i]! > utilities[best]!) best = i;
    return { ...options[best]!, utility: utilities[best]! };
  }
}
