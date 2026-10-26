// Who a fighter will and won't stand beside in the arena.

import type { FighterId, SimState } from '../types';
import { unit } from '../util/math';
import { fighterIds, getFighter, peekRel } from '../world';
import { perceivedEdge } from '../combat/records';

export interface Refusal {
  fighter: FighterId;
  reason: 'heartbreak' | 'feud';
}

/**
 * Teammates this fighter refuses to fight alongside. Comes purely from how they
 * feel; pragmatic fighters swallow more for the team's sake.
 */
export function teammateRefusals(state: SimState, id: FighterId, candidates?: FighterId[]): Refusal[] {
  const f = getFighter(state, id);
  const tolerance = 0.45 + 0.3 * unit(f.temperament.pragmatism) + 0.15 * unit(f.temperament.discipline);
  const out: Refusal[] = [];
  const heartbreaks = f.threads.filter((t) => t.kind === 'heartbreak' && t.weight >= tolerance - 0.2);

  for (const other of candidates ?? fighterIds(state)) {
    if (other === id) continue;
    // My ex, or the person my ex left me for: it hurts too much.
    const heartbreak = heartbreaks.some((t) => {
      const ex = t.about[0]!;
      return other === ex || peekRel(state, ex, other).labels.includes('dating');
    });
    if (heartbreak) out.push({ fighter: other, reason: 'heartbreak' });
    else if (peekRel(state, id, other).resentment >= tolerance) out.push({ fighter: other, reason: 'feud' });
  }
  return out;
}

/** The opponent this fighter fears most, and how badly they rate their chances, -1..1. */
export function worstMatchup(state: SimState, id: FighterId, opponents: FighterId[]): { opponent: FighterId; edge: number } | null {
  let worst: { opponent: FighterId; edge: number } | null = null;
  for (const o of opponents) {
    const edge = perceivedEdge(state, id, o);
    if (!worst || edge < worst.edge) worst = { opponent: o, edge };
  }
  return worst;
}

/** Why a fighter won't step into this fight, if they won't. */
export function refusesFight(state: SimState, id: FighterId, team: FighterId[], opponents: FighterId[]): 'outclassed' | 'teammates' | null {
  if (teammateRefusals(state, id, team).length) return 'teammates';
  const worst = worstMatchup(state, id, opponents);
  const t = getFighter(state, id).temperament;
  // Fear of being hurt, against nerve and the knowledge that the team needs you.
  if (worst && -worst.edge * (1.2 - unit(t.courage)) * (1.2 - unit(t.pragmatism)) > 0.3) return 'outclassed';
  return null;
}
