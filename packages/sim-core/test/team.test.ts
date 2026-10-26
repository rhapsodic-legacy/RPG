import { describe, expect, it } from 'vitest';
import {
  createState,
  heed,
  leadershipStyle,
  makeTemperament,
  RIVAL_NIGHT_FIGHT_ID,
  rivalNight,
  RuleCombatVoice,
  RuleTactics,
  runTeamFight,
  Simulation,
  type Combatant,
} from '../src';

const sides: [string[], string[]] = [
  ['bob', 'jin', 'martha'],
  ['sting', 'ox', 'vex'],
];

describe('leaders lead the way they are', () => {
  it('styles come from personality', () => {
    const s = createState(rivalNight());
    expect(leadershipStyle(s, 'bob')).toBe('dictate');
    expect(leadershipStyle(s, 'martha')).toBe('strategize');
    s.fighters.martha!.temperament = makeTemperament({ sociability: 0.9, ego: -0.6, loyalty: 0.6, discipline: 0.2, curiosity: 0, pragmatism: 0 });
    expect(leadershipStyle(s, 'martha')).toBe('inspire');
    s.fighters.martha!.temperament = makeTemperament({ discipline: -0.9, pragmatism: -0.9, curiosity: -0.9 });
    expect(leadershipStyle(s, 'martha')).toBe('ramble');
  });

  it("Bob hands out orders and claims Sting; Sting runs his mouth at Bob", () => {
    const s = createState(rivalNight());
    const acts = new RuleCombatVoice().pregame({ state: s, sides, leaders: ['bob', 'sting'] });
    expect(acts.some((a) => a.speaker === 'bob' && a.kind === 'claim' && a.about === 'sting')).toBe(true);
    expect(acts.filter((a) => a.speaker === 'bob' && a.kind === 'assign').length).toBe(2);
    expect(acts.some((a) => a.speaker === 'sting' && a.kind === 'taunt' && a.about === 'bob')).toBe(true);
  });

  it('nobody has to listen: heed comes from how you feel about the speaker', () => {
    const s = createState(rivalNight());
    const respected = heed(s, 'jin', 'bob', true);
    s.fighters.jin!.relationships.bob = { ...s.fighters.jin!.relationships.bob!, resentment: 0.8, trust: -0.5, respect: -0.3 };
    expect(heed(s, 'jin', 'bob', true)).toBeLessThan(respected / 2);
  });
});

describe('competing pulls', () => {
  const combatant = (id: string, side: 0 | 1, x: number, extra: Partial<Combatant> = {}): Combatant => ({
    id, side, out: false, target: null, mode: 'engage', influences: [], x, z: 0, stance: 'upright',
    action: { kind: 'idle', startFrame: 0, endFrame: 0 }, hp: 220, maxHp: 220, stamina: 100, balance: 100,
    rage: 0, fear: 0, impatience: 0, reactionDelay: 8, nextThink: 0, reactedTo: -1,
    stats: { attempts: {}, byMove: {}, outcomes: { clean: 0, glancing: 0, blocked: 0, whiff: 0 }, damageDealt: 0, damageTaken: 0, blocks: 0, knockdowns: 0, framesCrouched: 0, taunts: 0 },
    ...extra,
  });

  it("Jin respects Bob's claim on Sting — hanging back near him — until Bob is going down", () => {
    const s = createState(rivalNight());
    const choose = (bobHp: number, bobTaken: number) => {
      const jin = combatant('jin', 0, -100, { influences: [{ from: 'bob', kind: 'avoid', target: 'sting', weight: 0.8 }] });
      const bob = combatant('bob', 0, -100, { hp: bobHp, target: 'sting' });
      const sting = combatant('sting', 1, 100, { target: 'bob' });
      const ox = combatant('ox', 1, 120, { target: 'martha' });
      return new RuleTactics().choose({
        state: s, frame: 600, me: jin, allies: [jin, bob], opponents: [sting, ox],
        damage: { sting: { bob: bobTaken }, bob: { sting: 20 } },
      });
    };
    // Bob's fine: Jin wants Sting but holds back, shadowing him and keeping his strength.
    const early = choose(210, 10);
    expect(early?.target).toBe('sting');
    expect(early?.mode).toBe('hover');
    const late = choose(30, 190);
    expect(late?.target).toBe('sting');
    expect(late?.mode).toBe('engage');
  });
});

describe('the arena and the house are one world', () => {
  it('team fights are deterministic', () => {
    const a = runTeamFight(createState(rivalNight()), sides, { leaders: ['bob', 'sting'] });
    const b = runTeamFight(createState(rivalNight()), sides, { leaders: ['bob', 'sting'] });
    expect(a).toEqual(b);
  });

  it('Jin asks to lead; the fight happens; everyone carries it home', () => {
    const sim = new Simulation(rivalNight());
    const fight = sim.state.upcoming[0]!;
    while (sim.state.tick <= fight.tick) sim.step();

    expect(sim.state.inbox.some((m) => m.from === 'jin' && m.topic === `lead:${RIVAL_NIGHT_FIGHT_ID}`)).toBe(true);
    expect(sim.state.fightRecords.some((r) => r.id === RIVAL_NIGHT_FIGHT_ID)).toBe(true);
    expect(sim.state.upcoming).toHaveLength(0);

    const result = sim.lastFight!.result;
    for (const ko of result.kos) {
      const victim = sim.state.fighters[ko.of] ?? sim.state.outsiders[ko.of]!;
      expect(victim.memories.some((m) => m.tags.includes('knockout'))).toBe(true);
      expect(victim.state.injuredUntil).not.toBeNull();
    }
    // Sting's taunt is something Bob remembers — and resents.
    expect(sim.state.fighters.bob!.memories.some((m) => m.tags.includes('speech') && m.tags.includes('grievance:sting'))).toBe(true);
  });
});
