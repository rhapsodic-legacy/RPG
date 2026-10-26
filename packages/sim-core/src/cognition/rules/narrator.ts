// Template narrator: structured events → natural language.

import type { SimState, WorldEvent } from '../../types';
import { nameOf } from '../../world';
import type { Narrator } from '../providers';

const PREDICATE_TEXT: Record<string, (s: string, o: string) => string> = {
  betrayed_me: (s) => `${s} betrayed me`,
  prefers: (s, o) => `${s} prefers ${o}`,
  is_hostile_to_me: (s) => `${s} has it in for me`,
  is_kind_to_me: (s) => `${s} is good to me`,
  is_bad_cook: (s) => `${s} is a terrible cook`,
  favours: (s, o) => `${s} favours ${o}`,
};

export function beliefText(state: SimState, predicate: string, subject: string, object?: string): string {
  const fn = PREDICATE_TEXT[predicate];
  const s = nameOf(state, subject);
  const o = object ? nameOf(state, object) : '';
  return fn ? fn(s, o) : `${s} ${predicate} ${o}`.trim();
}

/** "the gym", but "Bob's room". */
export function roomPhrase(name: string): string {
  return /'s\b/.test(name) ? name : `the ${name}`;
}

function list(names: string[]): string {
  if (names.length <= 1) return names[0] ?? 'nobody';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function quality(q: number): string {
  if (q >= 0.75) return 'a delicious';
  if (q >= 0.5) return 'a decent';
  if (q >= 0.3) return 'a bland';
  return 'an inedible';
}

export class TemplateNarrator implements Narrator {
  readonly id = 'rules.template-narrator';

  describe(e: Omit<WorldEvent, 'gloss'>, state: SimState): string {
    const n = (id: string) => nameOf(state, id);
    const a = e.actors[0] ? n(e.actors[0]) : '';
    const b = e.targets[0] ? n(e.targets[0]) : '';
    const loc = roomPhrase(n(e.location));
    switch (e.type) {
      case 'chat':
        return `${a} chatted with ${b} in ${loc}.`;
      case 'flirt':
        return `${a} flirted with ${b}.`;
      case 'romance_start':
        return `${a} and ${b} kissed in ${loc} — they're together now.`;
      case 'affection_display':
        return `${a} and ${b} were openly affectionate in ${loc}.`;
      case 'breakup':
        return `${a} broke up with ${b}.`;
      case 'gossip': {
        const about = e.gossip ? state.events[Number(e.gossip.aboutEventId.slice(1))] : undefined;
        const what = about ? about.gloss.replace(/\.$/, '') : 'something';
        return `${a} told ${b}: "${what}."`;
      }
      case 'argument':
        return `${a} got into a heated argument with ${b} in ${loc}.`;
      case 'brawl':
        return `${a} and ${b} came to blows in ${loc}!`;
      case 'comfort':
        return `${a} comforted ${b}.`;
      case 'apology':
        return e.apology?.accepted
          ? `${a} apologised to ${b}, and ${b} accepted.`
          : `${a} tried to apologise to ${b}, but ${b} wasn't having it.`;
      case 'visit':
        return `${a} visited ${b} in ${loc}.`;
      case 'meal': {
        const eaters = list(e.targets.map(n));
        return e.meal?.cook
          ? `${n(e.meal.cook)} cooked ${quality(e.meal.quality)} meal in ${loc} for ${eaters}.`
          : `Cold leftovers in ${loc} for ${eaters}.`;
      }
      case 'sparring':
        return `${a} sparred with ${b}.`;
      case 'injury':
        return `${b || a} was injured (${e.injury?.cause ?? 'unknown'}) and is out for ${e.injury?.days ?? '?'} days.`;
      case 'recovery':
        return `${a} recovered and left ${loc}.`;
      case 'coach_spoke': {
        const u = e.utterance!;
        return `Coach said "${u.text}"${u.focus ? ` to ${n(u.focus)}` : ''}${u.misaddressed ? ' (wrong name!)' : ''}.`;
      }
      case 'speech':
        return `${a}: "${e.speech?.text ?? ''}"`;
      case 'match_result': {
        const m = e.match!;
        if (m.winningSide === null) return `${list(m.sides[0].map(n))} and ${list(m.sides[1].map(n))} fought to a draw.`;
        const win = m.sides[m.winningSide];
        const lose = m.sides[1 - m.winningSide]!;
        return `${list(win.map(n))} beat ${list(lose.map(n))} (${m.method}).`;
      }
      case 'knockout':
        return `${a} knocked out ${b}.`;
      case 'rescue':
        return `${a} came to ${b}'s rescue against ${e.rescue ? n(e.rescue.from) : 'their opponent'}.`;
      case 'reflection': {
        const r = e.reflection!;
        return `${n(r.owner)} has come to believe: "${beliefText(state, r.predicate, r.subject, r.object)}."`;
      }
    }
  }
}
