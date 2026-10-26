// Rule-based appraisal: the same event lands differently on different people,
// depending on their temperament, their role in it and their relationships.

import { magnitude, zeroEmotions, type EmotionVector } from '../../emotion';
import { compatibility, type Temperament } from '../../temperament';
import { COACH_ID, type FighterId, type RelDelta, type SimState, type WorldEvent } from '../../types';
import { clamp01, unit } from '../../util/math';
import { attachment, bond, chemistry, getFighter, peekRel } from '../../world';
import type { Appraisal, AppraisalContext, Appraiser } from '../providers';

/** Situational features of an event, from one perceiver's point of view. 0..1 each. */
interface Features {
  pleasure: number;
  displeasure: number;
  achievement: number;
  affection: number;
  gratitude: number;
  humiliation: number;
  threat: number;
  betrayal: number;
  jealousy: number;
  loss: number;
  guilt: number;
}

function zeroFeatures(): Features {
  return {
    pleasure: 0,
    displeasure: 0,
    achievement: 0,
    affection: 0,
    gratitude: 0,
    humiliation: 0,
    threat: 0,
    betrayal: 0,
    jealousy: 0,
    loss: 0,
    guilt: 0,
  };
}

/** Temperament decides how strongly each feature is felt as each emotion. */
export function featuresToEmotions(f: Features, t: Temperament): EmotionVector {
  const e = zeroEmotions();
  e.joy = f.pleasure * 0.8 + f.achievement * 0.8 + f.affection * 0.4;
  e.affection = f.affection * (0.5 + 0.6 * unit(t.sociability));
  e.gratitude = f.gratitude;
  e.anger =
    f.humiliation * (0.2 + 0.5 * unit(t.aggression) + 0.4 * unit(t.volatility)) +
    f.betrayal * (0.5 + 0.5 * unit(t.loyalty)) +
    f.displeasure * 0.4 * (0.5 + unit(t.ego)) +
    f.threat * 0.4 * unit(t.courage) +
    f.jealousy * 0.3;
  e.fear = f.threat * (1.1 - unit(t.courage));
  e.shame = f.humiliation * (0.3 + 0.7 * unit(t.ego)) + f.guilt * (0.4 + 0.6 * unit(t.loyalty));
  e.jealousy = f.jealousy * (0.6 + 0.4 * unit(t.ego) + 0.4 * unit(t.volatility));
  e.sadness = f.loss * (0.6 + 0.4 * unit(t.loyalty)) + f.displeasure * 0.3 + f.betrayal * 0.4;
  const amp = 0.75 + 0.5 * unit(t.volatility);
  for (const k of Object.keys(e) as (keyof EmotionVector)[]) e[k] = clamp01(e[k] * amp);
  return e;
}

/** Attraction growth from a positive moment with `other`; grows toward chemistry. */
function attractionGrowth(state: SimState, self: FighterId, other: FighterId, k = 1): number {
  const chem = chemistry(state, self, other);
  const current = peekRel(state, self, other).attraction;
  if (chem <= current) return 0;
  const romance = unit(getFighter(state, self).temperament.romance);
  return (chem - current) * (0.04 + 0.06 * romance) * k;
}

function counterpart(event: WorldEvent, self: FighterId): FighterId | undefined {
  return [...event.actors, ...event.targets].find((id) => id !== self);
}

function roleOf(event: WorldEvent, self: FighterId): 'actor' | 'target' | 'witness' {
  if (event.actors.includes(self)) return 'actor';
  if (event.targets.includes(self)) return 'target';
  return 'witness';
}

export class RuleAppraiser implements Appraiser {
  readonly id = 'rules.appraiser';

  appraise(ctx: AppraisalContext): Appraisal {
    const { state, perceiver: me, event } = ctx;
    const t = getFighter(state, me).temperament;
    const role = roleOf(event, me);
    const f = zeroFeatures();
    const deltas: RelDelta[] = [];
    const tags: string[] = [event.type];
    const other = counterpart(event, me);
    const participants = [...event.actors, ...event.targets];

    switch (event.type) {
      case 'chat': {
        if (role === 'witness' || !other) break;
        const compat = compatibility(t, getFighter(state, other).temperament);
        const ceiling = 0.25 + 0.5 * compat;
        f.affection = 0.25 * (0.6 + compat);
        deltas.push({
          toward: other,
          // Pleasant chats build toward a compatibility ceiling; incompatibility erodes slowly.
          affection: Math.max(0, ceiling - peekRel(state, me, other).affection) * 0.05 +
            Math.min(0, ceiling - peekRel(state, me, other).affection) * 0.005,
          familiarity: 0.02,
          attraction: attractionGrowth(state, me, other),
        });
        break;
      }

      case 'flirt': {
        if (role === 'witness') {
          this.romanticTriad(state, me, event, f, deltas, 0.5);
          break;
        }
        if (!other) break;
        if (role === 'actor') {
          f.affection = 0.2;
          deltas.push({ toward: other, attraction: attractionGrowth(state, me, other, 0.5) });
        } else if (peekRel(state, me, other).attraction >= 0.2) {
          f.affection = 0.5;
          deltas.push({ toward: other, attraction: attractionGrowth(state, me, other, 1.5), affection: 0.02 });
        } else {
          f.threat = 0.1; // unwanted attention is awkward
          deltas.push({ toward: other, fear: 0.03 });
        }
        break;
      }

      case 'romance_start':
      case 'affection_display': {
        if (role === 'witness' || !other) {
          this.romanticTriad(state, me, event, f, deltas, event.type === 'romance_start' ? 1 : 0.6);
          break;
        }
        f.affection = event.type === 'romance_start' ? 0.9 : 0.5;
        deltas.push({ toward: other, affection: 0.04, attraction: attractionGrowth(state, me, other, 0.5), trust: 0.02 });
        // Guilt toward a friend who is the partner's ex.
        if (event.type === 'romance_start') {
          for (const [exId, r] of Object.entries(getFighter(state, other).relationships)) {
            if (exId === me || !r.labels.includes('ex')) continue;
            const friendship = peekRel(state, me, exId).affection;
            if (friendship > 0.2) {
              f.guilt += friendship * 0.8;
              tags.push(`guilt:${exId}`);
              deltas.push({ toward: exId, fear: 0.15 * friendship });
            }
          }
        }
        break;
      }

      case 'breakup': {
        if (!other) break;
        if (role === 'target') {
          const r = peekRel(state, me, other);
          f.loss = clamp01(r.attraction + 0.2);
          f.humiliation = 0.4;
          deltas.push({
            toward: other,
            affection: -0.15,
            trust: -0.15,
            resentment: 0.15 * (0.5 + unit(t.ego)),
          });
        } else if (role === 'actor') {
          f.guilt = 0.3;
          tags.push(`guilt:${other}`);
          deltas.push({ toward: other, fear: 0.05 });
        } else {
          this.romanticTriad(state, me, event, f, deltas, 0.3);
        }
        break;
      }

      case 'gossip': {
        if (role === 'witness' || !other) break;
        f.affection = 0.15;
        deltas.push({ toward: other, affection: 0.02, familiarity: 0.02, trust: 0.01 });
        break;
      }

      case 'argument':
      case 'brawl': {
        const brawl = event.type === 'brawl';
        if (role !== 'witness' && other) {
          f.humiliation = brawl ? 0.5 : 0.4;
          f.threat = brawl ? 0.7 : 0.3;
          deltas.push({
            toward: other,
            resentment: brawl ? 0.2 : 0.12,
            affection: brawl ? -0.12 : -0.08,
            fear: brawl ? 0.08 : 0.02,
            trust: -0.05,
          });
        } else {
          f.threat = brawl ? 0.3 : 0.1;
          // Witnesses side with whoever they like more.
          const [a, b] = participants;
          if (a && b) {
            const lean = peekRel(state, me, a).affection - peekRel(state, me, b).affection;
            if (Math.abs(lean) > 0.2) {
              const disliked = lean > 0 ? b : a;
              deltas.push({ toward: disliked, resentment: 0.04 * Math.abs(lean), affection: -0.02 });
            }
          }
        }
        break;
      }

      case 'comfort': {
        if (role === 'target' && other) {
          f.affection = 0.6;
          f.gratitude = 0.5;
          deltas.push({ toward: other, affection: 0.06, trust: 0.04, attraction: attractionGrowth(state, me, other) });
        } else if (role === 'actor' && other) {
          f.affection = 0.2;
          deltas.push({ toward: other, affection: 0.02 });
        }
        break;
      }

      case 'apology': {
        if (!other) break;
        const accepted = event.apology?.accepted ?? false;
        if (role === 'target') {
          if (accepted) {
            f.gratitude = 0.4;
            deltas.push({ toward: other, resentment: -0.45, trust: 0.1, affection: 0.08, fear: -0.05 });
          } else {
            f.humiliation = 0.1; // "too little, too late"
            deltas.push({ toward: other, resentment: -0.05 });
          }
        } else if (role === 'actor') {
          if (accepted) {
            f.pleasure = 0.4;
            deltas.push({ toward: other, resentment: -0.2, fear: -0.1, affection: 0.05 });
          } else {
            f.humiliation = 0.4;
            deltas.push({ toward: other, resentment: 0.08 });
          }
        }
        break;
      }

      case 'visit': {
        if (role === 'target' && other) {
          f.affection = 0.5;
          f.gratitude = 0.5;
          deltas.push({
            toward: other,
            affection: 0.06,
            trust: 0.03,
            attraction: attractionGrowth(state, me, other, 1.5),
          });
        } else if (role === 'actor' && other) {
          f.affection = 0.3;
          deltas.push({ toward: other, affection: 0.02, attraction: attractionGrowth(state, me, other) });
        }
        break;
      }

      case 'meal': {
        const meal = event.meal!;
        if (event.targets.includes(me)) {
          if (meal.quality >= 0.5) f.pleasure = (meal.quality - 0.5) * 1.6;
          else f.displeasure = (0.5 - meal.quality) * 1.6;
          if (meal.cook && meal.cook !== me) {
            deltas.push({ toward: meal.cook, respect: (meal.quality - 0.5) * 0.06, affection: (meal.quality - 0.5) * 0.02 });
          }
          if (meal.cook) tags.push(`cook:${meal.cook}`);
        } else if (meal.cook === me) {
          f.achievement = meal.quality * 0.3;
        }
        break;
      }

      case 'sparring': {
        if (role === 'witness' || !other) break;
        f.achievement = 0.3;
        deltas.push({ toward: other, respect: 0.03, familiarity: 0.03 });
        break;
      }

      case 'injury': {
        if (role !== 'witness') {
          f.threat = 0.6;
          f.loss = 0.4;
        } else {
          const victim = event.targets[0] ?? event.actors[0];
          if (victim) f.loss = Math.max(0, bond(state, me, victim)) * 0.6;
        }
        break;
      }

      case 'recovery': {
        if (role !== 'witness') f.pleasure = 0.6;
        else {
          const who = event.actors[0];
          if (who) f.pleasure = Math.max(0, peekRel(state, me, who).affection) * 0.4;
        }
        break;
      }

      case 'speech': {
        const sp = event.speech!;
        if (sp.kind === 'taunt' && sp.about === me && other) {
          f.humiliation = 0.35;
          deltas.push({ toward: event.actors[0]!, resentment: 0.1 * (0.5 + unit(t.ego)), respect: -0.03 });
        } else if (sp.kind === 'pep' && role === 'witness') {
          f.pleasure = 0.2;
        }
        break;
      }

      case 'match_result': {
        const m = event.match!;
        const mySide = m.sides[0].includes(me) ? 0 : m.sides[1].includes(me) ? 1 : null;
        if (mySide !== null) {
          if (m.winningSide === mySide) {
            f.achievement = 0.6;
            for (const mate of m.sides[mySide]) if (mate !== me) deltas.push({ toward: mate, affection: 0.03, respect: 0.03 });
          } else if (m.winningSide !== null) {
            f.humiliation = 0.4;
            f.loss = 0.3;
          }
        } else {
          // Watching from home: cheering for housemates.
          let care = 0;
          let side: 0 | 1 = 0;
          for (const s of [0, 1] as const) {
            for (const p of m.sides[s]) {
              const b = bond(state, me, p);
              if (b > care) {
                care = b;
                side = s;
              }
            }
          }
          if (m.winningSide === side) f.pleasure = 0.3 * care;
          else if (m.winningSide !== null) f.loss = 0.3 * care;
        }
        break;
      }

      case 'knockout': {
        if (role === 'target' && other) {
          f.humiliation = 0.6;
          f.threat = 0.5;
          deltas.push({ toward: other, resentment: 0.15 * (0.5 + unit(t.ego)), fear: 0.1 * (1 - unit(t.courage)), respect: 0.05 });
        } else if (role === 'actor') {
          f.achievement = 0.5;
        } else {
          const victim = event.targets[0];
          if (victim) f.loss = Math.max(0, bond(state, me, victim)) * 0.4;
        }
        break;
      }

      case 'rescue': {
        if (role === 'target' && other) {
          f.gratitude = 0.6;
          deltas.push({ toward: other, affection: 0.06, trust: 0.08, respect: 0.04 });
          // Someone stepping into the fight I claimed: a proud fighter feels undermined too.
          const claimed = event.rescue && peekRel(state, me, event.rescue.from).resentment > 0.4;
          if (claimed) {
            f.humiliation = 0.3 * unit(t.ego);
            deltas.push({ toward: other, resentment: 0.04 * unit(t.ego) });
          }
        } else if (role === 'actor' && other) {
          f.achievement = 0.3;
          deltas.push({ toward: other, affection: 0.03 });
        }
        break;
      }

      case 'coach_spoke':
        this.coachUtterance(state, me, event, f, deltas, tags);
        break;

      case 'reflection':
        this.reflection(event, f, tags);
        break;
    }

    let emotions = featuresToEmotions(f, t);
    const mag = magnitude(emotions);
    let involvement: number;
    if (role !== 'witness' || event.reflection?.owner === me) involvement = 1;
    else {
      let maxBond = 0;
      for (const p of participants) maxBond = Math.max(maxBond, bond(state, me, p));
      involvement = 0.25 + 0.75 * maxBond;
      // Something that hits you personally (jealousy, betrayal) is never peripheral.
      if (f.jealousy > 0.3 || f.betrayal > 0.3) involvement = 1;
    }
    let importance = clamp01(event.intensity * involvement * Math.min(1.2, 0.3 + mag));

    // Second-hand information is held more loosely.
    if (ctx.source === 'told') {
      importance *= ctx.confidence;
      for (const d of deltas) {
        for (const k of Object.keys(d) as (keyof RelDelta)[]) {
          if (k !== 'toward') (d[k] as number) *= ctx.confidence;
        }
      }
      emotions = Object.fromEntries(
        Object.entries(emotions).map(([k, v]) => [k, v * ctx.confidence]),
      ) as EmotionVector;
    }

    return { emotions, importance, deltas, tags };
  }

  /**
   * Seeing two people be romantic. Jealousy if attached to one of them; betrayal
   * if the other was a friend.
   */
  private romanticTriad(
    state: SimState,
    me: FighterId,
    event: WorldEvent,
    f: Features,
    deltas: RelDelta[],
    weight: number,
  ): void {
    const pair = [...event.actors, ...event.targets];
    if (pair.length !== 2) return;
    const t = getFighter(state, me).temperament;
    for (let i = 0; i < 2; i++) {
      const beloved = pair[i]!;
      const rival = pair[1 - i]!;
      const att = attachment(state, me, beloved);
      if (att < 0.35) continue;
      const jealousy = ((att - 0.3) / 0.7) * weight;
      const friendship = Math.max(0, peekRel(state, me, rival).affection);
      // A crush can't fairly blame an established couple; an ex or partner can.
      const mine = peekRel(state, me, beloved).labels.some((l) => l === 'dating' || l === 'ex');
      const theirs = peekRel(state, rival, beloved).labels.includes('dating');
      const blame = theirs && !mine ? 0.3 : 1;
      f.jealousy = Math.max(f.jealousy, jealousy);
      f.betrayal = Math.max(f.betrayal, jealousy * friendship * 1.5 * blame);
      f.loss = Math.max(f.loss, jealousy * 0.5);
      const heat = 0.5 + 0.5 * unit(t.ego) + 0.5 * unit(t.volatility);
      deltas.push({
        toward: rival,
        resentment: 0.3 * jealousy * heat * blame,
        affection: -0.25 * jealousy,
        trust: -0.3 * jealousy * (0.5 + friendship),
      });
      deltas.push({ toward: beloved, resentment: 0.08 * jealousy, trust: -0.08 * jealousy });
    }
  }

  /**
   * What the coach said, as heard by `me`. Being the one in focus while the
   * coach cheers someone else's name stings — more so if that someone is a rival.
   */
  private coachUtterance(
    state: SimState,
    me: FighterId,
    event: WorldEvent,
    f: Features,
    deltas: RelDelta[],
    tags: string[],
  ): void {
    const u = event.utterance!;
    const t = getFighter(state, me).temperament;
    const positive = new Set(['encourage', 'praise', 'reassure']);
    for (const intent of u.interpretation.intents) {
      const toMe = intent.target === me || (intent.target === null && u.focus === me);
      if (toMe) {
        if (positive.has(intent.kind)) {
          f.pleasure += 0.3;
          f.gratitude += 0.2;
          deltas.push({ toward: COACH_ID, trust: 0.03, affection: 0.02 });
        } else if (intent.kind === 'criticize') {
          f.humiliation += 0.4;
          deltas.push({ toward: COACH_ID, affection: -0.04, trust: -0.01 * (1 + t.ego) });
        }
      } else if (intent.target) {
        const other = intent.target;
        const resent = peekRel(state, me, other).resentment;
        if (positive.has(intent.kind)) {
          if (u.focus === me) {
            // "You can do it, Bob!" — said to me.
            f.humiliation += 0.35;
            tags.push('misaddressed');
            deltas.push({ toward: COACH_ID, trust: -0.1, affection: -0.05 });
          }
          if (resent > 0.2) {
            f.jealousy += resent * 0.6;
            f.betrayal += resent * (u.focus === me ? 0.8 : 0.3);
            deltas.push({ toward: COACH_ID, trust: -0.08 * resent });
            deltas.push({ toward: other, resentment: 0.05 * resent });
            tags.push('coach_favours_rival');
          }
        } else if (intent.kind === 'criticize') {
          const fondness = peekRel(state, me, other).affection;
          if (resent > 0.3) f.pleasure += 0.15;
          if (fondness > 0.4) deltas.push({ toward: COACH_ID, affection: -0.03 });
        }
      }
    }
  }

  private reflection(event: WorldEvent, f: Features, tags: string[]): void {
    const r = event.reflection!;
    tags.push(`belief:${r.predicate}`);
    switch (r.predicate) {
      case 'betrayed_me':
        f.betrayal = 0.7;
        break;
      case 'prefers':
        f.jealousy = 0.5;
        f.loss = 0.4;
        break;
      case 'is_hostile_to_me':
        f.threat = 0.3;
        f.humiliation = 0.2;
        break;
      case 'is_kind_to_me':
        f.affection = 0.4;
        break;
      case 'is_bad_cook':
        f.displeasure = 0.3;
        break;
      case 'favours':
        f.jealousy = 0.4;
        break;
    }
  }
}
