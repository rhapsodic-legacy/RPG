// Rule-based voices: what fighters write in their journals and to the manager.
// Both are LLM seams — swap in a model that writes from the same mind context.

import { teammateRefusals } from '../../mind/teams';
import { COACH_ID, type FighterId, type Memory, type SimState, type Suggestion } from '../../types';
import { unit } from '../../util/math';
import { headToHead, perceivedEdge } from '../../combat/records';
import { grudge } from '../../combat/talk';
import { getFighter, nameOf, partnerOf, peekRel, roomsOfKind } from '../../world';
import type { Correspondent, Diarist, MessageDraft } from '../providers';
import { beliefText } from './narrator';

function namesList(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
}

function eventOf(state: SimState, m: Memory) {
  return state.events[Number(m.eventId.slice(1))];
}

export class RuleDiarist implements Diarist {
  readonly id = 'rules.diarist';

  write(state: SimState, id: FighterId, since: number): string | null {
    const f = getFighter(state, id);
    const n = (x: string) => nameOf(state, x);
    const lines: string[] = [];
    const today = f.memories.filter((m) => m.createdAt > since).sort((a, b) => b.importance - a.importance);

    for (const m of today) {
      const e = eventOf(state, m);
      if (!e || lines.length >= 3) continue;
      const other = [...e.actors, ...e.targets].find((p) => p !== id);
      switch (e.type) {
        case 'romance_start':
          if (other && (e.actors.includes(id) || e.targets.includes(id))) lines.push(`${n(other)} and I are together now.`);
          else if (m.emotions.jealousy > 0.3) lines.push(`${m.source === 'told' ? `${n(m.toldBy!)} told me about` : 'I saw'} ${n(e.actors[0]!)} and ${n(e.targets[0]!)}. I feel sick.`);
          break;
        case 'breakup':
          if (e.targets.includes(id)) lines.push(`${n(e.actors[0]!)} ended it with me.`);
          else if (e.actors.includes(id)) lines.push(`I ended things with ${n(e.targets[0]!)}. I hope it was the right thing.`);
          break;
        case 'apology':
          if (e.targets.includes(id) && other) {
            const stillHurts = f.threads.some((t) => t.about.includes(other));
            lines.push(e.apology?.accepted ? `${n(other)} apologised. I accepted${stillHurts ? ', but it still hurts' : ''}.` : `${n(other)} tried to apologise. Not good enough.`);
          } else if (e.actors.includes(id) && other) {
            lines.push(e.apology?.accepted ? `I made peace with ${n(other)}. Or tried to.` : `I tried to make peace with ${n(other)}. Stubborn.`);
          }
          break;
        case 'argument':
        case 'brawl':
          if (other && e.type === 'brawl') lines.push(`${n(other)} and I came to blows today.`);
          else if (other && (e.actors.includes(id) || e.targets.includes(id))) lines.push(`Another fight with ${n(other)}.`);
          break;
        case 'injury':
          if (e.targets.includes(id)) lines.push(`Hurt. Stuck in the infirmary for ${e.injury?.days ?? 'a few'} days.`);
          break;
        case 'match_result': {
          const mm = e.match!;
          const mySide = mm.sides[0].includes(id) ? 0 : mm.sides[1].includes(id) ? 1 : null;
          if (mySide === null) break;
          lines.push(mm.winningSide === mySide ? 'We won tonight.' : mm.winningSide === null ? 'A draw. Nobody happy.' : 'We lost tonight.');
          break;
        }
        case 'knockout':
          if (e.targets.includes(id)) lines.push(`${n(e.actors[0]!)} knocked me out. ${peekRel(state, id, e.actors[0]!).resentment > 0.5 ? 'Again.' : ''}`.trim());
          else if (e.actors.includes(id)) lines.push(`I put ${n(e.targets[0]!)} down.`);
          break;
        case 'rescue':
          if (e.targets.includes(id)) lines.push(`${n(e.actors[0]!)} jumped in for me against ${n(e.rescue!.from)}.${m.emotions.shame > 0.1 ? " I didn't ask for that." : ''}`);
          else if (e.actors.includes(id)) lines.push(`${n(e.targets[0]!)} was going down. I couldn't just watch.`);
          break;
        case 'speech':
          if (e.speech?.kind === 'taunt' && e.speech.about === id) lines.push(`${n(e.actors[0]!)} ran their mouth at me before the bell.`);
          break;
        case 'reflection': {
          const r = e.reflection!;
          if (r.owner === id && r.predicate !== 'is_kind_to_me') {
            lines.push(`${beliefText(state, r.predicate, r.subject, r.object)}.`);
          }
          break;
        }
        default:
          break;
      }
    }

    // Feelings for someone while with someone else.
    const partner = partnerOf(state, id);
    if (partner && lines.length < 3) {
      const toPartner = peekRel(state, id, partner).attraction;
      for (const [other, r] of Object.entries(f.relationships).sort(([a], [b]) => (a < b ? -1 : 1))) {
        if (other === partner || !state.fighters[other]) continue;
        if (r.attraction >= 0.45 && r.attraction >= toPartner - 0.1) {
          lines.push(`I have strong feelings for ${n(other)} now... I hope ${n(partner)} is ok with that.`);
          break;
        }
      }
    }

    // What's weighing on me — unless I already wrote exactly that last time.
    const top = f.threads[0];
    const lastEntry = f.diary[f.diary.length - 1]?.text ?? '';
    const before = lines.length;
    if (top && lines.length < 3) {
      const [a, b] = top.about;
      switch (top.kind) {
        case 'feud':
          lines.push(`I can't stand being in the same room as ${n(a!)}.`);
          break;
        case 'heartbreak':
          lines.push(`I still think about ${n(a!)}.`);
          break;
        case 'caught_in_middle':
          lines.push(`${n(a!)} and ${n(b!)} are at each other's throats and I'm stuck in the middle.`);
          break;
        case 'guilt':
          lines.push(`I feel terrible about ${n(a!)}.`);
          break;
      }
      if (lines.length > before && lastEntry.includes(lines[lines.length - 1]!)) lines.pop();
    }

    return lines.length ? lines.join(' ') : null;
  }
}

/** Is this fighter the type to write to the manager at all? */
function willWrite(state: SimState, id: FighterId): boolean {
  const t = getFighter(state, id).temperament;
  const trust = peekRel(state, id, COACH_ID).trust;
  return 0.3 + 0.3 * unit(t.sociability) + 0.2 * unit(t.pragmatism) + 0.3 * trust > 0.45;
}

export class RuleCorrespondent implements Correspondent {
  readonly id = 'rules.correspondent';

  compose(state: SimState, id: FighterId): MessageDraft[] {
    if (!willWrite(state, id)) return [];
    const f = getFighter(state, id);
    const n = (x: string) => nameOf(state, x);
    const out: MessageDraft[] = [];

    // "I won't fight alongside them."
    const refusals = teammateRefusals(state, id);
    if (refusals.length) {
      const names = refusals.map((r) => n(r.fighter));
      const hurts = refusals.some((r) => r.reason === 'heartbreak');
      out.push({
        topic: `refuse:${refusals.map((r) => r.fighter).sort().join(',')}`,
        about: refusals.map((r) => r.fighter),
        subject: `I won't fight with ${namesList(names)}`,
        body: `Coach, I need you to know I won't fight on a team with ${namesList(names)}. ${hurts ? 'It hurts too much.' : "I don't trust them to have my back."}`,
        suggestions: [],
      });
    }

    // "I tried to make peace; please intervene."
    for (const t of f.threads) {
      if (t.kind !== 'feud') continue;
      const other = t.about[0]!;
      const triedPeace = f.memories.some((m) => {
        const e = eventOf(state, m);
        return e?.type === 'apology' && e.actors[0] === id && e.targets[0] === other;
      });
      if (!triedPeace || peekRel(state, other, id).resentment < 0.4) continue;
      const suggestions: Suggestion[] = [];
      const partner = partnerOf(state, id);
      if (partner && peekRel(state, other, partner).labels.includes('ex')) {
        suggestions.push({
          kind: 'build_room',
          about: [id, partner],
          text: `Perhaps if a room was put in the basement, ${n(partner)} and I could live down there. Then no one hears us at night.`,
        });
      }
      const kitchenFights = f.memories.filter((m) => {
        const e = eventOf(state, m);
        return (e?.type === 'argument' || e?.type === 'brawl') && e.location.startsWith('kitchen') && [...e.actors, ...e.targets].includes(other);
      }).length;
      if (kitchenFights >= 2 && roomsOfKind(state, 'kitchen').length < 2) {
        suggestions.push({ kind: 'second_kitchen', about: [id, other], text: `${n(other)} and I keep running into each other at meals. A second kitchen might help.` });
      }
      out.push({
        topic: `intervene:${other}`,
        about: [other],
        subject: `Please talk to ${n(other)}`,
        body: `I've tried to heal things with ${n(other)}, but ${n(other)} is being a stubborn fool. Could you please intervene?${suggestions.length ? ' ' + suggestions.map((s) => s.text).join(' ') : ''}`,
        suggestions,
      });
    }

    // "I'm stuck in the middle."
    for (const t of f.threads) {
      if (t.kind !== 'caught_in_middle' || t.weight < 0.5) continue;
      out.push({
        topic: `caught:${t.about.join('|')}`,
        about: t.about,
        subject: `${n(t.about[0]!)} and ${n(t.about[1]!)}`,
        body: `${n(t.about[0]!)} and ${n(t.about[1]!)} are at each other's throats and I'm stuck in the middle. I don't know what to do. Can you help?`,
        suggestions: [{ kind: 'talk_to', about: t.about, text: `Talk to ${n(t.about[0]!)} and ${n(t.about[1]!)}.` }],
      });
    }

    // Fights coming up: would I be the better one to lead?
    for (const fight of state.upcoming) {
      const side = fight.sides[0].includes(id) ? 0 : fight.sides[1].includes(id) ? 1 : null;
      if (side === null) continue;
      const leader = fight.leaders[side];
      if (!leader || leader === id || !state.fighters[leader]) continue;
      const opponents = fight.sides[1 - side]!;
      // Who will the leader go after? Whoever they hold the biggest grudge against.
      const wanted = [...opponents].sort((a, b) => grudge(state, leader, b) - grudge(state, leader, a) || (a < b ? -1 : 1))[0]!;
      if (grudge(state, leader, wanted) < 0.4) continue;
      const mine = perceivedEdge(state, id, wanted);
      const theirs = perceivedEdge(state, leader, wanted, id);
      const ambition = 0.3 * unit(f.temperament.pragmatism) + 0.2 * unit(f.temperament.ego) + 0.1 * unit(f.temperament.courage);
      if (mine - theirs < 0.5 - ambition) continue;
      const { lost } = headToHead(state, leader, wanted);
      out.push({
        topic: `lead:${fight.id}`,
        about: [leader, wanted],
        subject: `Let me lead against ${n(wanted)}'s team`,
        body:
          `Coach, make me the leader for the fight against ${namesList(opponents.map(n)).replace(/ or /, ' and ')}. ` +
          `${n(wanted)} ${lost >= 2 ? `has beaten ${n(leader)} every time they've met` : `is a bad matchup for ${n(leader)}`}, but ${n(wanted)} struggles against fighters built like me — the record shows it. ` +
          `${n(leader)} will want ${n(wanted)} no matter what. If I'm leading, I can take ${n(wanted)} myself and ${n(leader)} gets someone they can beat.`,
        suggestions: [{ kind: 'talk_to', about: [leader], text: `Make ${n(id)} the leader, or talk ${n(leader)} out of taking ${n(wanted)}.` }],
      });
    }

    // Complaints about the food.
    for (const b of f.beliefs) {
      if (b.predicate !== 'is_bad_cook') continue;
      out.push({
        topic: `cook:${b.subject}`,
        about: [b.subject],
        subject: 'The food',
        body: `Is there any way someone else could cook? ${n(b.subject)}'s food is hard to eat.`,
        suggestions: [{ kind: 'change_cook', about: [b.subject], text: `Assign a different cook.` }],
      });
    }

    return out;
  }
}
