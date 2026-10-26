// Talk before and during a fight. Nobody is obliged to say anything and nobody is
// obliged to listen: what a leader says comes from who they are, and what each
// teammate does with it comes from who *they* are and how they feel about the speaker.
//
// This is an LLM seam (`CombatVoice`): a model can write the words and decide
// what to say, as long as it returns SpeechActs.

import type { FighterId, SimState } from '../types';
import { clamp01, unit } from '../util/math';
import { getFighter, nameOf, peekRel } from '../world';
import { maxHp } from './body';
import { headToHead, perceivedEdge, speedOf } from './records';
import type { Influence, SpeechAct } from './types';

export interface PregameContext {
  state: SimState;
  sides: [FighterId[], FighterId[]];
  leaders: [FighterId | null, FighterId | null];
}

export interface CombatVoice {
  readonly id: string;
  pregame(ctx: PregameContext): SpeechAct[];
}

/** How a leader tends to lead. Not a rule — just which way their personality leans. */
export function leadershipStyle(state: SimState, id: FighterId): 'dictate' | 'strategize' | 'inspire' | 'ramble' {
  const t = getFighter(state, id).temperament;
  const competence = (unit(t.discipline) + unit(t.pragmatism) + unit(t.curiosity)) / 3;
  if (competence < 0.3) return 'ramble';
  const scores: [ReturnType<typeof leadershipStyle>, number][] = [
    ['dictate', unit(t.ego) + unit(t.aggression) + 0.5 * unit(t.discipline) - 0.5 * unit(t.sociability)],
    ['strategize', unit(t.pragmatism) + unit(t.curiosity) + 0.5 * unit(t.discipline)],
    ['inspire', unit(t.sociability) + (1 - unit(t.ego)) + 0.5 * unit(t.loyalty)],
  ];
  scores.sort((a, b) => b[1] - a[1]);
  return scores[0]![0];
}

/** How much `id` wants a piece of `opponent` personally: grudges and history. */
export function grudge(state: SimState, id: FighterId, opponent: FighterId): number {
  const r = peekRel(state, id, opponent);
  const { lost } = headToHead(state, id, opponent);
  return clamp01(r.resentment + 0.1 * lost);
}

export class RuleCombatVoice implements CombatVoice {
  readonly id = 'rules.combat-voice';

  pregame(ctx: PregameContext): SpeechAct[] {
    const { state, sides, leaders } = ctx;
    const n = (id: string) => nameOf(state, id);
    const acts: SpeechAct[] = [];

    for (const side of [0, 1] as const) {
      const team = sides[side];
      const opponents = sides[1 - side]!;
      const leader = leaders[side];

      // Trash talk across the line: contempt or a grudge, plus the ego or temper to voice it.
      for (const me of team) {
        const t = getFighter(state, me).temperament;
        for (const opp of opponents) {
          const r = peekRel(state, me, opp);
          const contempt = Math.max(0, -r.respect);
          const drive = (grudge(state, me, opp) + contempt) * (unit(t.ego) + unit(t.volatility)) / 2 - 0.3 * unit(t.discipline);
          if (drive < 0.3) continue;
          const { won } = headToHead(state, me, opp);
          const line =
            won >= 2
              ? `Hey ${n(opp)}! Ready to hit the floor again, you washed-up piece of ****?`
              : `${n(opp)}, I'm going to put you through the ****ing floor.`;
          acts.push({ frame: 0, speaker: me, audience: [...team, ...opponents], kind: 'taunt', text: line, about: opp });
        }
      }

      // Personal claims: "he's mine" — a grudge plus the ego to say it out loud.
      for (const me of team) {
        if (me === leader) continue;
        const t = getFighter(state, me).temperament;
        for (const opp of opponents) {
          const drive = grudge(state, me, opp) * (unit(t.ego) + unit(t.aggression)) / 2;
          if (drive < 0.45) continue;
          acts.push({ frame: 0, speaker: me, audience: team, kind: 'claim', text: `${n(opp)} is mine. Stay out of it.`, about: opp });
        }
      }

      if (!leader) continue;
      const style = leadershipStyle(state, leader);
      const lt = getFighter(state, leader).temperament;
      switch (style) {
        case 'dictate': {
          // The leader takes who they want, then hands out the rest as they see it.
          const left = [...opponents];
          const mine = [...left].sort((a, b) => grudge(state, leader, b) - grudge(state, leader, a) || (a < b ? -1 : 1))[0]!;
          left.splice(left.indexOf(mine), 1);
          const parts = [`${n(mine)}'s mine.`];
          acts.push({ frame: 0, speaker: leader, audience: team, kind: 'claim', text: '', about: mine });
          for (const mate of team) {
            if (mate === leader || left.length === 0) continue;
            // As the leader judges it: who is this teammate best against?
            left.sort((a, b) => perceivedEdge(state, mate, b, leader) - perceivedEdge(state, mate, a, leader) || (a < b ? -1 : 1));
            const pick = left.shift()!;
            parts.push(`${n(mate)}, you take ${n(pick)}.`);
            acts.push({ frame: 0, speaker: leader, audience: team, kind: 'assign', text: '', about: pick, to: mate });
          }
          parts.push(unit(lt.ego) > 0.6 ? 'Nobody touches my fight.' : 'Stick to the plan.');
          acts.push({ frame: 0, speaker: leader, audience: team, kind: 'bark', text: parts.join(' ') });
          break;
        }
        case 'strategize': {
          const fastest = [...opponents].sort((a, b) => speedOf(state, b) - speedOf(state, a) || (a < b ? -1 : 1))[0]!;
          const hardest = [...opponents].sort((a, b) => maxHp(getFighter(state, b).def.body) - maxHp(getFighter(state, a).def.body) || (a < b ? -1 : 1))[0]!;
          // Fast opponents pick teams apart; heavy ones take the longest to bring down.
          const target = unit(lt.curiosity) >= unit(lt.aggression) ? fastest : hardest;
          const why = target === fastest ? 'their fastest guy' : 'their biggest hitter';
          acts.push({ frame: 0, speaker: leader, audience: team, kind: 'priority', text: `Take out ${why} first — that's ${n(target)} — then do your thing.`, about: target });
          break;
        }
        case 'inspire':
          acts.push({ frame: 0, speaker: leader, audience: team, kind: 'pep', text: "We've trained for this. Look after each other and we walk out of here winners!" });
          break;
        case 'ramble': {
          const tallest = [...opponents].sort((a, b) => getFighter(state, b).def.body.heightCm - getFighter(state, a).def.body.heightCm || (a < b ? -1 : 1))[0]!;
          acts.push({ frame: 0, speaker: leader, audience: team, kind: 'nonsense', text: `Okay so... everybody hit the tall one. ${n(tallest)}. Tall people hate that. Trust me.`, about: tallest });
          break;
        }
      }
    }
    return acts;
  }
}

/**
 * How much `listener` takes `speaker` seriously: trust, respect and fondness,
 * against resentment; discipline makes you listen, ego makes you not.
 */
export function heed(state: SimState, listener: FighterId, speaker: FighterId, speakerLeads: boolean): number {
  if (listener === speaker) return 1;
  const t = getFighter(state, listener).temperament;
  const r = peekRel(state, listener, speaker);
  const regard = 0.2 + 0.35 * Math.max(0, r.trust) + 0.3 * Math.max(0, r.respect) + 0.2 * Math.max(0, r.affection) - 0.6 * r.resentment;
  const role = speakerLeads ? 0.15 * unit(t.discipline) : 0;
  return clamp01(regard * (0.6 + 0.6 * unit(t.discipline)) * (1 - 0.4 * unit(t.ego)) + role);
}

/** Turn what was said into each listener's influences (and immediate feelings). */
export function absorb(
  state: SimState,
  acts: SpeechAct[],
  leaders: [FighterId | null, FighterId | null],
  combatants: { id: FighterId; influences: Influence[]; rage: number; fear: number }[],
): void {
  const byId = new Map(combatants.map((c) => [c.id, c]));
  for (const act of acts) {
    const leads = leaders.includes(act.speaker);
    for (const listenerId of act.audience) {
      const c = byId.get(listenerId);
      if (!c) continue;
      const lt = getFighter(state, listenerId).temperament;
      const h = heed(state, listenerId, act.speaker, leads);
      switch (act.kind) {
        case 'claim':
          if (listenerId === act.speaker) c.influences.push({ from: act.speaker, kind: 'focus', target: act.about!, weight: 1 });
          else c.influences.push({ from: act.speaker, kind: 'avoid', target: act.about!, weight: h });
          break;
        case 'assign':
          if (listenerId === act.to) c.influences.push({ from: act.speaker, kind: 'focus', target: act.about!, weight: h });
          break;
        case 'priority':
          c.influences.push({ from: act.speaker, kind: 'focus', target: act.about!, weight: 0.8 * h });
          break;
        case 'nonsense':
          c.influences.push({ from: act.speaker, kind: 'focus', target: act.about!, weight: 0.6 * h });
          break;
        case 'pep':
          c.fear = clamp01(c.fear - 0.3 * h);
          c.rage = clamp01(c.rage + 0.1 * h);
          break;
        case 'taunt':
          if (listenerId !== act.about) break;
          // Getting called out: the proud and the volatile take the bait.
          c.rage = clamp01(c.rage + 0.4 * (unit(lt.ego) + unit(lt.volatility)) / 2);
          c.fear = clamp01(c.fear + 0.15 * (1 - unit(lt.courage)));
          c.influences.push({ from: act.speaker, kind: 'focus', target: act.speaker, weight: 0.6 * (unit(lt.ego) + unit(lt.volatility)) / 2 });
          break;
        default:
          break;
      }
    }
  }
}
