import { describe, expect, it } from 'vitest';
import {
  createState,
  expectedValue,
  geometricContact,
  guardCovers,
  learningRate,
  makeTemperament,
  MOVES,
  preferredStance,
  reactionDelay,
  runFight,
  sparringGym,
  type Body,
} from '../src';

const tall: Body = { heightCm: 188, massKg: 95 };
const mid: Body = { heightCm: 175, massKg: 75 };
const petite: Body = { heightCm: 150, massKg: 50 };
const brute: Body = { heightCm: 198, massKg: 130 };
const close = 70;

describe('geometry decides contact (no dice)', () => {
  it("a straight punch lands on someone standing but sails over someone crouched", () => {
    expect(geometricContact(tall, 'upright', mid, 'upright', MOVES.cross, close).quality).toBe('clean');
    const vsCrouch = geometricContact(tall, 'upright', mid, 'crouched', MOVES.cross, close);
    expect(vsCrouch.quality).toBe('whiff');
    expect(vsCrouch.whiff).toBe('over');
  });

  it('an uppercut comes up into a crouch', () => {
    expect(geometricContact(tall, 'upright', mid, 'crouched', MOVES.uppercut, close).quality).not.toBe('whiff');
  });

  it("a tall fighter's jab only grazes a petite one", () => {
    expect(geometricContact(tall, 'upright', petite, 'upright', MOVES.jab, close).quality).toBe('glancing');
  });

  it('the tip of a strike only grazes; beyond it, nothing', () => {
    const reach = MOVES.cross.reach * tall.heightCm;
    expect(geometricContact(tall, 'upright', mid, 'upright', MOVES.cross, reach + 10).quality).toBe('glancing');
    expect(geometricContact(tall, 'upright', mid, 'upright', MOVES.cross, reach + 200).whiff).toBe('short');
  });

  it("you can't throw someone far heavier than you, or someone braced low", () => {
    expect(geometricContact(petite, 'upright', brute, 'upright', MOVES.throw, 40).whiff).toBe('too_heavy');
    expect(geometricContact(brute, 'upright', mid, 'crouched', MOVES.throw, 40).whiff).toBe('braced');
    expect(geometricContact(brute, 'upright', petite, 'upright', MOVES.throw, 40).quality).toBe('clean');
  });

  it('standing guards miss low kicks; crouching guards miss overheads', () => {
    expect(guardCovers('upright', 'legs', MOVES.low_kick)).toBe(false);
    expect(guardCovers('crouched', 'legs', MOVES.low_kick)).toBe(true);
    expect(guardCovers('crouched', 'head', MOVES.overhead)).toBe(false);
    expect(guardCovers('upright', 'head', MOVES.overhead)).toBe(true);
  });
});

describe('fights', () => {
  it('are deterministic', () => {
    const a = runFight(createState(sparringGym()), 'brick', 'wren');
    const b = runFight(createState(sparringGym()), 'brick', 'wren');
    expect(a).toEqual(b);
  });

  it('personality shapes how someone fights', () => {
    const turtle = makeTemperament({ discipline: 0.8, courage: -0.3, aggression: -0.3 });
    const brawler = makeTemperament({ discipline: -0.3, courage: 0.7, aggression: 0.8 });
    expect(preferredStance(turtle)).toBe('crouched');
    expect(preferredStance(brawler)).toBe('upright');

    const attempts = (temperament: typeof turtle) => {
      const s = createState(sparringGym());
      s.fighters.duke!.temperament = temperament;
      const r = runFight(s, 'duke', 'wren', { maxFrames: 30 * 30 });
      return Object.values(r.stats.duke!.attempts).reduce((x, y) => x + (y ?? 0), 0);
    };
    expect(attempts(brawler)).toBeGreaterThan(attempts(turtle));
  });

  it('a crouching turtle makes a stubborn big hitter whiff', () => {
    const r = runFight(createState(sparringGym()), 'brick', 'shell');
    expect(r.stats.brick!.outcomes.whiff).toBeGreaterThan(r.stats.brick!.outcomes.clean);
    expect(r.stats.shell!.framesCrouched).toBeGreaterThan(r.frames * 0.9);
  });

  it('distraction at home costs you in the arena', () => {
    expect(reactionDelay(0.2, 0)).toBeGreaterThan(reactionDelay(1, 0));
    const ids = ['brick', 'shell', 'wren', 'duke'];
    // Net damage (dealt minus taken) across every matchup.
    const net = (focus: number) => {
      let total = 0;
      for (const me of ids) {
        for (const opp of ids) {
          if (me === opp) continue;
          const s = createState(sparringGym());
          s.fighters[me]!.state.focus = focus;
          const st = runFight(s, opp, me).stats[me]!;
          total += st.damageDealt - st.damageTaken;
        }
      }
      return total;
    };
    expect(net(0.2)).toBeLessThan(net(1) - 50);
  });

  it('the curious learn from their misses faster than the stubborn', () => {
    const curious = makeTemperament({ curiosity: 0.9, ego: -0.5 });
    const stubborn = makeTemperament({ curiosity: -0.9, ego: 0.9 });
    expect(learningRate(curious)).toBeGreaterThan(learningRate(stubborn) * 3);

    const afterOneFight = (t: typeof curious) => {
      const s = createState(sparringGym());
      s.fighters.duke!.temperament = { ...s.fighters.duke!.temperament, curiosity: t.curiosity, ego: t.ego };
      runFight(s, 'duke', 'shell');
      return expectedValue(s.fighters.duke!.combat, 'hook', 'crouched');
    };
    expect(afterOneFight(curious)).toBeLessThan(afterOneFight(stubborn));
  });
});
