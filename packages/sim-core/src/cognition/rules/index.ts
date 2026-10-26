import { overlapRelevance } from '../../mind/memory';
import type { CognitionProviders } from '../providers';
import { RuleActivityPolicy } from './activity';
import { RuleAppraiser } from './appraiser';
import { RuleInteractionPolicy } from './interaction';
import { TemplateNarrator } from './narrator';
import { RuleReflector } from './reflector';
import { KeywordUtteranceInterpreter } from './utterance';
import { RuleCorrespondent, RuleDiarist } from './voice';

/** The default, fully rule-based mind. Swap any member for a richer provider. */
export function ruleBasedProviders(): CognitionProviders {
  return {
    appraiser: new RuleAppraiser(),
    activity: new RuleActivityPolicy(),
    interaction: new RuleInteractionPolicy(),
    reflector: new RuleReflector(),
    utterance: new KeywordUtteranceInterpreter(),
    relevance: overlapRelevance,
    narrator: new TemplateNarrator(),
    diarist: new RuleDiarist(),
    correspondent: new RuleCorrespondent(),
  };
}
