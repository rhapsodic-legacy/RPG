// Keyword-based utterance interpreter. Deliberately simple: it is the fallback
// for when no language model is available. It still understands who was named,
// which is enough for "You can do it, Bob!" to hurt Jin.

import type { FighterId, UtteranceIntent, UtteranceInterpretation } from '../../types';
import { clampSigned } from '../../util/math';
import { fighterList } from '../../world';
import type { UtteranceContext, UtteranceInterpreter } from '../providers';

const LEXICON: Record<UtteranceIntent['kind'], string[]> = {
  encourage: ['you can do it', 'come on', 'keep going', 'go go', "let's go", 'believe', 'you got this', 'fight', 'get up'],
  praise: ['well done', 'good job', 'great', 'amazing', 'proud', 'brilliant', 'best', 'nice', 'beautiful'],
  criticize: ['terrible', 'awful', 'lazy', 'pathetic', 'useless', 'disappointing', 'sloppy', 'weak', 'what are you doing'],
  command: ['focus', 'guard up', 'fall back', 'back off', 'attack', 'move', 'stop', 'rest', 'train', 'eat'],
  reassure: ["it's okay", 'its okay', "don't worry", 'dont worry', "it's fine", 'breathe', 'relax'],
  question: ['?'],
};

const SENTIMENT: Record<UtteranceIntent['kind'], number> = {
  encourage: 0.6,
  praise: 0.8,
  criticize: -0.8,
  command: 0,
  reassure: 0.5,
  question: 0,
};

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class KeywordUtteranceInterpreter implements UtteranceInterpreter {
  readonly id = 'rules.keyword-utterance';

  interpret(text: string, ctx: UtteranceContext): UtteranceInterpretation {
    const lower = text.toLowerCase();

    const mentions: FighterId[] = [];
    for (const f of fighterList(ctx.state)) {
      if (new RegExp(`\\b${escape(f.def.name.toLowerCase())}\\b`).test(lower)) mentions.push(f.def.id);
    }

    // A named person is the addressee; otherwise whoever the speaker is facing.
    const addressee = mentions.length === 1 ? mentions[0]! : (mentions[0] ?? ctx.focus);

    const intents: UtteranceIntent[] = [];
    let sentiment = 0;
    for (const kind of Object.keys(LEXICON) as UtteranceIntent['kind'][]) {
      if (LEXICON[kind].some((phrase) => lower.includes(phrase))) {
        intents.push({ kind, target: addressee });
        sentiment += SENTIMENT[kind];
      }
    }

    return {
      mentions,
      addressee,
      intents,
      sentiment: clampSigned(sentiment),
      confidence: intents.length > 0 ? 0.6 : 0.2,
      interpreter: this.id,
    };
  }
}
