import { describe, expect, it } from 'vitest';
import {
  ambition,
  appeal,
  createState,
  desire,
  generateFighter,
  peekRel,
  Simulation,
  suzieQ,
  suzieQSchedule,
  SUZIE_Q,
  type Input,
} from '../src';

describe('attraction is personal', () => {
  it("everyone has a type: Jin's eye goes to curly hair", () => {
    const s = createState(suzieQ());
    const curly = appeal(s, 'jin', 'martha');
    s.fighters.martha!.def.looks = { ...s.fighters.martha!.def.looks!, hair: 'short' };
    expect(appeal(s, 'jin', 'martha')).toBeLessThan(curly);
  });

  it('nobody is drawn to a gender they are not attracted to', () => {
    const s = createState(suzieQ());
    expect(appeal(s, 'bob', 'jin')).toBe(0);
  });

  it('needs come in order: Bob hungers for glory, Jin for romance', () => {
    const s = createState(suzieQ());
    const bob = s.fighters.bob!;
    const jin = s.fighters.jin!;
    for (const f of [bob, jin]) f.state.needs = { ...f.state.needs, intimacy: 0.5, esteem: 0.3, social: 0.8 };
    expect(ambition(bob)).toBeGreaterThan(desire(bob));
    expect(desire(jin)).toBeGreaterThan(ambition(jin));
    // Starving bodies don't chase anything.
    bob.state.needs.fullness = 0;
    expect(ambition(bob)).toBe(0);
  });

  it('recruits off the gym board are random but reproducible', () => {
    expect(generateFighter('x', { id: 'a', bedroomId: 'b' })).toEqual(generateFighter('x', { id: 'a', bedroomId: 'b' }));
    expect(generateFighter('x', { id: 'a', bedroomId: 'b' })).not.toEqual(generateFighter('y', { id: 'a', bedroomId: 'b' }));
  });
});

describe('Suzie Q moves in', () => {
  const run = (extra: (tick: number) => Input[] = () => []) => {
    const sim = new Simulation(suzieQ());
    const events = sim.runDays(7, (t) => [...suzieQSchedule(t), ...extra(t)]);
    return { sim, events };
  };
  const { sim, events } = run();
  const diary = (id: string) => sim.state.fighters[id]!.diary.map((d) => d.text).join('\n');

  it('the men notice her the moment she walks in', () => {
    expect(diary('kai')).toContain(`Met ${SUZIE_Q.name} today. Wow.`);
    expect(peekRel(sim.state, 'jin', 'suzie').attraction).toBeGreaterThan(0.4);
  });

  it('she soaks up the attention, and turns Kai down', () => {
    expect(diary('suzie')).toMatch(/were all over me today\. I love it here\./);
    expect(events.some((e) => e.type === 'romance_start' && e.actors[0] === 'kai' && e.targets[0] === 'suzie' && e.romance?.accepted === false)).toBe(true);
  });

  it('Martha comes to hate her', () => {
    expect(peekRel(sim.state, 'martha', 'suzie').resentment).toBeGreaterThan(0.4);
  });

  it("she won't step into a fight she's outclassed in", () => {
    expect(sim.state.inbox.some((m) => m.from === 'suzie' && m.topic.startsWith('refuse-fight:'))).toBe(true);
    expect(events.some((e) => e.type === 'refused_fight' && e.actors[0] === 'suzie')).toBe(true);
  });

  it('putting her in Kai\'s room gets a complaint', () => {
    const moved = run((t) => (t === 2 * 48 + 20 ? [{ kind: 'assign_bedroom', fighter: 'suzie', room: 'bed_kai' }] : []));
    expect(moved.sim.state.inbox.some((m) => m.from === 'suzie' && m.topic.startsWith('roommate:kai'))).toBe(true);
  });
});
