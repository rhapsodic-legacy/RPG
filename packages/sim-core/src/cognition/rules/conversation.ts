// Template lines for conversations. Deliberately plain: the structure (who says
// what, about what, when) is the simulation's; the words are where an LLM shines.

import { dominantEmotion } from '../../emotion';
import { getFighter, nameOf } from '../../world';
import type { Conversationalist, LineContext } from '../providers';

const pick = (options: string[], seed: number) => options[seed % options.length]!;

const SMALL_TALK: Record<string, string[]> = {
  tv: ['Did you catch the fight on TV last night?', 'Anything good on tonight?'],
  reading: ['What are you reading at the moment?', 'Finish that book yet?'],
  billiards: ['Rack them up later?', 'You still owe me a rematch on the table.'],
  music: ['Heard anything good lately?', "What's that song you keep humming?"],
  gaming: ['Rematch tonight?', 'Did you beat that level yet?'],
  golf: ["How's your swing coming along?", 'The simulator says I hit it 280. The simulator lies.'],
  none: ['Long day, huh?', 'Training wiped me out today.', "What's for dinner?"],
};

const FEELING: Record<string, string> = {
  anger: "I'm so angry about it.",
  sadness: 'It really got to me.',
  fear: "Honestly, it scared me.",
  shame: "I'm a bit embarrassed, to be honest.",
  jealousy: "I hate how jealous it made me.",
  joy: "I'm still buzzing about it.",
  affection: 'It meant a lot to me.',
  gratitude: "I'm really grateful.",
};

export class TemplateConversationalist implements Conversationalist {
  readonly id = 'rules.template-conversationalist';

  line(ctx: LineContext): string {
    const { state, conversation: c, speaker, listener, topic } = ctx;
    const L = nameOf(state, listener);
    let seed = c.turns.length + state.tick;
    for (let i = 0; i < speaker.length; i++) seed += speaker.charCodeAt(i) * (i + 1);
    switch (ctx.moment) {
      case 'open':
        switch (c.kind) {
          case 'flirt':
            return pick([`${L}! You look good today.`, `Hey you. Sit with me?`], seed);
          case 'comfort':
            return pick(['Hey. You okay?', `${L}, talk to me. What's wrong?`], seed);
          case 'gossip':
            return `${L}, you won't believe what I heard.`;
          default:
            return pick([`Hey ${L}, got a minute?`, `${L}! How's it going?`, `Mind if I sit here?`], seed);
        }
      case 'share': {
        if (topic?.kind === 'news' && topic.eventId) {
          const e = state.events[Number(topic.eventId.slice(1))];
          return `Did you hear? ${e?.gloss ?? 'Something happened.'}`;
        }
        if (topic?.kind === 'feelings' && topic.memoryId) {
          const m = getFighter(state, speaker).memories.find((x) => x.id === topic.memoryId);
          const feeling = m ? dominantEmotion(m.emotions) : null;
          return `I keep thinking about it. ${m?.gloss ?? ''} ${feeling ? FEELING[feeling] : ''}`.replace(/\s+/g, ' ').trim();
        }
        return 'So, anyway.';
      }
      case 'reply': {
        const mood = dominantEmotion(getFighter(state, speaker).state.mood);
        if (topic?.kind === 'feelings') {
          const m = topic.memoryId ? getFighter(state, listener).memories.find((x) => x.id === topic.memoryId) : undefined;
          if (m && m.valence > 0.2) return pick(["That's great!", 'Good for you.', 'Ha, I bet.'], seed);
          return pick(["I'm sorry. That's rough.", "I didn't know. Thanks for telling me.", 'Yeah. I get it.'], seed);
        }
        if (mood === 'anger') return "That's unbelievable.";
        if (mood === 'sadness') return "That's hard to hear.";
        return pick(['No way.', 'Seriously?', 'Huh. I had no idea.'], seed);
      }
      case 'small_talk':
        if (c.kind === 'flirt') return pick(['I like talking to you.', "You're easy to be around, you know that?", 'Stay a bit longer.'], seed);
        return pick(SMALL_TALK[ctx.pastime ?? 'none'] ?? SMALL_TALK.none!, seed);
      case 'small_reply':
        if (c.kind === 'flirt') return pick(['Me too.', 'Yeah?', "I'm not going anywhere."], seed);
        return pick(['Ha, yeah.', 'Tell me about it.', 'Maybe later.', 'Definitely.'], seed);
      case 'close':
        return pick(['I should get going.', 'Anyway, catch you later.', 'Right, I need to eat something.'], seed);
      case 'brush_off':
        return pick([`Not now, ${nameOf(state, listener)}.`, "Sorry, I'm in the middle of something.", 'Maybe later, okay?'], seed);
    }
  }
}
