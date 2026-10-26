import { feel, zeroEmotions } from '../emotion';
import type { CognitionProviders } from '../cognition/providers';
import { ruleBasedProviders } from '../cognition/rules';
import { interactionCooldownKey } from '../cognition/rules/interaction';
import { pruneMemories, retrieve } from '../mind/memory';
import { computeFocus, computeThreads, preoccupation } from '../mind/threads';
import {
  dayOf,
  isSleepTime,
  mealKey,
  NIGHTLY_SLOT,
  slotOf,
  TICKS_PER_DAY,
  TICKS_PER_WEEK,
  type Tick,
} from '../time';
import type { FighterId, ScheduledFight, SimState, UtteranceInterpretation, WorldEvent } from '../types';
import { maxHp } from '../combat/body';
import { runTeamFight } from '../combat/fight';
import { recordFight } from '../combat/records';
import type { FightResult } from '../combat/types';
import { clamp01, fnv1a } from '../util/math';
import {
  applyRelDelta,
  fighterIds,
  fighterList,
  getFighter,
  isAsleep,
  isInjured,
  occupants,
  partnerOf,
  peekRel,
  touchCooldown,
  setLabel,
} from '../world';
import type { Input, JournalEntry } from './inputs';
import { perceive } from './perception';
import { createState, type Scenario } from './scenario';

export type EventDraft = Omit<WorldEvent, 'id' | 'tick' | 'witnesses' | 'gloss'> & { witnesses?: FighterId[] };

const MIN_BELIEF_CONFIDENCE = 0.3;
/** Comfort of a room when the layout doesn't say. */
const DEFAULT_ROOM_COMFORT = 0.5;
const REFLECTION_THRESHOLD = 0.5;

/**
 * The deterministic home simulation. `step()` advances one 30-minute slot.
 * Given the same scenario and journal it always produces the same state.
 */
export class Simulation {
  readonly state: SimState;
  readonly providers: CognitionProviders;
  readonly journal: JournalEntry[] = [];

  constructor(scenarioOrState: Scenario | SimState, providers: CognitionProviders = ruleBasedProviders()) {
    this.state = 'version' in scenarioOrState ? scenarioOrState : createState(scenarioOrState);
    this.providers = providers;
  }

  /** Re-run a recorded journal from a scenario. */
  static replay(
    scenario: Scenario,
    journal: readonly JournalEntry[],
    untilTick: Tick,
    providers?: CognitionProviders,
  ): Simulation {
    const sim = new Simulation(scenario, providers);
    const byTick = new Map<Tick, Input[]>();
    for (const entry of journal) byTick.set(entry.tick, [...(byTick.get(entry.tick) ?? []), entry.input]);
    while (sim.state.tick < untilTick) sim.step(byTick.get(sim.state.tick) ?? []);
    return sim;
  }

  hash(): string {
    return fnv1a(JSON.stringify(this.state));
  }

  /** Run whole days; `schedule` supplies inputs for a given tick. */
  runDays(days: number, schedule?: (tick: Tick) => Input[]): WorldEvent[] {
    const out: WorldEvent[] = [];
    const end = this.state.tick + days * TICKS_PER_DAY;
    while (this.state.tick < end) out.push(...this.step(schedule?.(this.state.tick) ?? []));
    return out;
  }

  step(inputs: Input[] = []): WorldEvent[] {
    const s = this.state;
    const emitted: WorldEvent[] = [];
    const emit = (draft: EventDraft) => {
      const e = this.emit(draft);
      emitted.push(e);
      return e;
    };

    for (const input of inputs) this.applyInput(input, emit);
    for (const fight of s.upcoming.filter((f) => f.tick === s.tick)) this.runScheduledFight(fight, emit);
    this.updateStatuses(emit);
    this.planAndMove(emit);
    this.updateNeeds();
    this.serveMeals(emit);
    this.spar(emit);
    this.socialize(emit);

    for (const e of emitted) perceive(s, this.providers, e);

    if (slotOf(s.tick) === NIGHTLY_SLOT) {
      const nightly: WorldEvent[] = [];
      this.nightly((d) => {
        const e = this.emit(d);
        nightly.push(e);
        return e;
      });
      for (const e of nightly) perceive(s, this.providers, e);
      for (const id of fighterIds(s)) {
        const f = getFighter(s, id);
        f.threads = computeThreads(s, id);
        f.state.focus = computeFocus(s, id);
      }
      this.afterThreads();
      emitted.push(...nightly);
    }

    s.tick++;
    return emitted;
  }

  // ------------------------------------------------------------ events

  private emit(draft: EventDraft): WorldEvent {
    const s = this.state;
    const participants = [...draft.actors, ...draft.targets];
    const witnesses =
      draft.witnesses ??
      (draft.public
        ? [...new Set([...participants, ...occupants(s, draft.location).map((f) => f.def.id)])].sort()
        : [...new Set(participants)].sort());
    const base = { ...draft, id: `e${s.nextEventId}`, tick: s.tick, witnesses };
    const event: WorldEvent = { ...base, gloss: this.providers.narrator.describe(base, s) };
    s.nextEventId++;
    s.events.push(event);
    this.applyEffects(event);
    return event;
  }

  /** Objective consequences (labels, statuses). Subjective ones come from perception. */
  private applyEffects(e: WorldEvent): void {
    const s = this.state;
    const [a, b] = [...e.actors, ...e.targets];
    switch (e.type) {
      case 'romance_start':
        if (a && b) {
          for (const [x, y] of [[a, b], [b, a]] as const) {
            setLabel(s, x, y, 'dating', true);
            setLabel(s, x, y, 'ex', false);
            setLabel(s, x, y, 'crush', false);
          }
        }
        break;
      case 'breakup':
        if (a && b) {
          for (const [x, y] of [[a, b], [b, a]] as const) {
            setLabel(s, x, y, 'dating', false);
            setLabel(s, x, y, 'ex', true);
          }
        }
        break;
      case 'apology':
        // An accepted apology settles the apologiser's guilt up to now.
        if (e.apology?.accepted && a && b) s.cooldowns[`apology_ok:${a}>${b}`] = s.tick;
        break;
      case 'brawl':
        for (const id of [...e.actors, ...e.targets]) {
          getFighter(s, id).state.shakenUntil = s.tick + TICKS_PER_WEEK;
        }
        break;
      case 'injury':
        for (const id of e.targets) {
          if (e.injury) getFighter(s, id).state.injuredUntil = s.tick + e.injury.days * TICKS_PER_DAY;
        }
        break;
      default:
        break;
    }
  }

  // ------------------------------------------------------------ inputs

  private applyInput(input: Input, emit: (d: EventDraft) => WorldEvent): void {
    const s = this.state;
    switch (input.kind) {
      case 'injure': {
        const f = getFighter(s, input.fighter);
        emit({
          type: 'injury',
          actors: [],
          targets: [input.fighter],
          location: f.state.location,
          intensity: 0.7,
          public: true,
          injury: { days: input.days, cause: input.cause },
        });
        break;
      }
      case 'coach_utterance': {
        const audience = input.audience
          ? [...input.audience].sort()
          : input.location
            ? occupants(s, input.location).map((f) => f.def.id)
            : [];
        const focus = input.focus ?? null;
        const interpretation: UtteranceInterpretation =
          input.interpretation ??
          this.providers.utterance.interpret(input.text, { state: s, speaker: 'coach', audience, focus });
        const misaddressed =
          focus !== null && interpretation.addressee !== null && interpretation.addressee !== focus &&
          !audience.includes(interpretation.addressee);
        const location = input.location ?? (audience[0] ? getFighter(s, audience[0]).state.location : 'unknown');
        emit({
          type: 'coach_spoke',
          actors: [],
          targets: [],
          location,
          intensity: 0.5,
          public: false,
          witnesses: audience,
          utterance: { text: input.text, focus, misaddressed, interpretation },
        });
        // Journal the interpretation so replays never re-run the interpreter (or an LLM).
        this.journal.push({ tick: s.tick, input: { ...input, interpretation } });
        return;
      }
      case 'intent':
        getFighter(s, input.fighter).state.intents.push({ ...input.intent });
        break;
      case 'set_cooks':
        s.kitchens[input.kitchen] = { cooks: [...input.cooks] };
        break;
      case 'schedule_fight':
        s.upcoming.push(structuredClone(input.fight));
        break;
      case 'set_leader': {
        const fight = s.upcoming.find((f) => f.id === input.fightId);
        if (fight) fight.leaders[input.side] = input.leader;
        break;
      }
    }
    this.journal.push({ tick: s.tick, input });
  }

  // ------------------------------------------------------------ the arena

  /** Run a fight that has come due, and bring what happened home. */
  private runScheduledFight(fight: ScheduledFight, emit: (d: EventDraft) => WorldEvent): void {
    const s = this.state;
    s.upcoming = s.upcoming.filter((f) => f.id !== fight.id);
    // The injured can't fight.
    const sides = fight.sides.map((side) => side.filter((id) => !isInjured(getFighter(s, id), s.tick))) as [FighterId[], FighterId[]];
    if (sides[0].length === 0 || sides[1].length === 0) return;
    const result = runTeamFight(s, sides, { leaders: fight.leaders });
    this.lastFight = { fight, result };
    recordFight(s, fight.id, sides, result.winningSide, result.damage);

    const participants = [...sides[0], ...sides[1]];
    const watchers = [...new Set([...participants, ...fighterIds(s)])].sort();
    for (const act of result.speech) {
      if (!act.text) continue;
      emit({
        type: 'speech',
        actors: [act.speaker],
        targets: act.about && act.kind === 'taunt' ? [act.about] : [],
        location: 'arena',
        intensity: act.kind === 'taunt' ? 0.5 : 0.3,
        public: false,
        witnesses: [...new Set([act.speaker, ...act.audience])].sort(),
        speech: { kind: act.kind, text: act.text, ...(act.about ? { about: act.about } : {}), ...(act.to ? { to: act.to } : {}) },
      });
    }
    for (const r of result.rescues) {
      emit({ type: 'rescue', actors: [r.by], targets: [r.of], location: 'arena', intensity: 0.6, public: false, witnesses: participants, rescue: { from: r.from } });
    }
    for (const ko of result.kos) {
      emit({ type: 'knockout', actors: [ko.by], targets: [ko.of], location: 'arena', intensity: 0.8, public: false, witnesses: watchers });
    }
    const winners = result.winningSide === null ? [] : sides[result.winningSide];
    const losers = result.winningSide === null ? [...sides[0], ...sides[1]] : sides[1 - result.winningSide]!;
    emit({
      type: 'match_result',
      actors: winners,
      targets: losers,
      location: 'arena',
      intensity: 0.8,
      public: false,
      witnesses: watchers,
      match: { sides, winningSide: result.winningSide, method: result.method, fightId: fight.id },
    });
    // Bodies pay: knockouts and beatings put people in the infirmary.
    for (const id of participants) {
      const f = getFighter(s, id);
      const severity = result.stats[id]!.damageTaken / maxHp(f.def.body);
      const knockedOut = result.kos.some((k) => k.of === id);
      const days = knockedOut ? 2 + Math.round(10 * severity) : severity > 0.6 ? Math.round(5 * severity) : 0;
      if (days > 0) {
        emit({
          type: 'injury',
          actors: [],
          targets: [id],
          location: f.state.location,
          intensity: 0.7,
          public: false,
          witnesses: [id],
          injury: { days, cause: knockedOut ? 'knocked out in the arena' : 'beaten up in the arena' },
        });
      }
    }
  }

  /** The most recent fight's full result (for play-by-play tooling). */
  lastFight: { fight: ScheduledFight; result: FightResult } | null = null;

  // ------------------------------------------------------------ home loop

  private updateStatuses(emit: (d: EventDraft) => WorldEvent): void {
    const s = this.state;
    for (const f of fighterList(s)) {
      if (f.state.injuredUntil !== null && s.tick >= f.state.injuredUntil) {
        f.state.injuredUntil = null;
        emit({ type: 'recovery', actors: [f.def.id], targets: [], location: f.state.location, intensity: 0.4, public: true });
      }
      if (f.state.shakenUntil !== null && s.tick >= f.state.shakenUntil) f.state.shakenUntil = null;
      f.state.intents = f.state.intents.filter((i) => i.untilTick > s.tick);
    }
  }

  private planAndMove(emit: (d: EventDraft) => WorldEvent): void {
    const s = this.state;
    const expected: Record<FighterId, string> = {};
    for (const f of fighterList(s)) expected[f.def.id] = f.state.location;

    for (const f of fighterList(s)) {
      const choice = this.providers.activity.choose({ state: s, fighter: f.def.id, expected });
      f.state.activity = choice.activity;
      f.state.location = choice.location;
      expected[f.def.id] = choice.location;
      if (choice.activity === 'visit' && choice.visitTarget) {
        f.state.lastVisit[choice.visitTarget] = dayOf(s.tick);
        emit({ type: 'visit', actors: [f.def.id], targets: [choice.visitTarget], location: choice.location, intensity: 0.45, public: false });
      }
    }

    for (const f of fighterList(s)) {
      if (isAsleep(f, s.tick)) continue;
      for (const o of occupants(s, f.state.location)) {
        if (o.def.id !== f.def.id) f.state.lastSeen[o.def.id] = s.tick;
      }
    }
  }

  private updateNeeds(): void {
    const s = this.state;
    for (const f of fighterList(s)) {
      const n = f.state.needs;
      const company = occupants(s, f.state.location).length > 1;
      switch (f.state.activity) {
        case 'sleep':
          n.energy += 0.05;
          n.comfort += 0.02;
          n.fullness -= 0.008;
          break;
        case 'recover':
          n.energy += 0.02;
          n.fullness -= 0.012;
          break;
        case 'train':
          n.energy -= 0.04;
          n.fullness -= 0.025;
          n.comfort -= 0.005;
          break;
        case 'relax':
          n.energy += 0.01;
          n.comfort += 0.04;
          n.fullness -= 0.012;
          break;
        default:
          n.energy -= 0.012;
          n.fullness -= 0.015;
      }
      if (f.state.activity !== 'sleep') n.social += company ? 0.03 : -0.01;
      n.energy = clamp01(n.energy);
      n.comfort = clamp01(n.comfort);
      n.fullness = clamp01(n.fullness);
      n.social = clamp01(n.social);
    }
  }

  private serveMeals(emit: (d: EventDraft) => WorldEvent): void {
    const s = this.state;
    const key = mealKey(s.tick);
    if (!key) return;
    for (const kitchenId of Object.keys(s.kitchens).sort()) {
      const here = occupants(s, kitchenId);
      const cook = here.find((f) => f.state.activity === 'cook');
      const eaters = here.filter((f) => f.state.activity === 'eat' && f.state.lastMeal !== key);
      if (eaters.length === 0) continue;
      const quality = cook ? cook.def.skills.cooking : 0.3;
      emit({
        type: 'meal',
        actors: cook ? [cook.def.id] : [],
        targets: eaters.map((f) => f.def.id),
        location: kitchenId,
        intensity: 0.25 + Math.abs(quality - 0.5) * 0.6,
        public: true,
        meal: { cook: cook?.def.id ?? null, quality },
      });
      for (const f of cook ? [...eaters, cook] : eaters) {
        f.state.lastMeal = key;
        f.state.needs.fullness = clamp01(f.state.needs.fullness + 0.55);
        f.state.needs.comfort = clamp01(f.state.needs.comfort + (quality - 0.5) * 0.15);
      }
    }
  }

  private spar(emit: (d: EventDraft) => WorldEvent): void {
    const s = this.state;
    for (const room of s.layout.rooms.filter((r) => r.kind === 'gym')) {
      const trainees = occupants(s, room.id).filter((f) => f.state.activity === 'train');
      for (let i = 0; i < trainees.length; i++) {
        for (let j = i + 1; j < trainees.length; j++) {
          const a = trainees[i]!.def.id;
          const b = trainees[j]!.def.id;
          if (peekRel(s, a, b).resentment >= 0.4 || peekRel(s, b, a).resentment >= 0.4) continue;
          // PACING LIMIT DISABLED (once a day per pair) — see interaction.ts.
          // const key = `spar:${pairKey(a, b)}`;
          // if (!cooldownReady(s, key, TICKS_PER_DAY)) continue;
          // touchCooldown(s, key);
          emit({ type: 'sparring', actors: [a], targets: [b], location: room.id, intensity: 0.25, public: true });
        }
      }
    }
  }


  private socialize(emit: (d: EventDraft) => WorldEvent): void {
    const s = this.state;
    const policy = this.providers.interaction;
    // People already caught up in a confrontation this half hour.
    const embroiled = new Set<FighterId>();
    for (const f of fighterList(s)) {
      if (isAsleep(f, s.tick) || isSleepTime(s.tick) || embroiled.has(f.def.id)) continue;
      const present = occupants(s, f.state.location).map((o) => o.def.id);
      const choice = policy.choose(s, f.def.id, present);
      if (!choice) continue;
      touchCooldown(s, interactionCooldownKey(choice.kind, f.def.id, choice.target));
      const base = { actors: [f.def.id], targets: [choice.target], location: f.state.location };
      switch (choice.kind) {
        case 'chat':
          emit({ ...base, type: 'chat', intensity: 0.2, public: false });
          break;
        case 'flirt':
          emit({ ...base, type: 'flirt', intensity: 0.35, public: true });
          break;
        case 'ask_out':
          emit({ ...base, type: 'romance_start', intensity: 0.8, public: true });
          break;
        case 'affection_display':
          emit({ ...base, type: 'affection_display', intensity: 0.5, public: true });
          break;
        case 'comfort':
          emit({ ...base, type: 'comfort', intensity: 0.4, public: false });
          break;
        case 'confront': {
          if (embroiled.has(choice.target)) break;
          embroiled.add(f.def.id);
          embroiled.add(choice.target);
          if (policy.strikesFirst(s, f.def.id, choice.target)) {
            emit({ ...base, type: 'brawl', intensity: 0.9, public: true, confrontation: { response: 'struck_first' } });
            break;
          }
          const response = policy.respondToConfrontation(s, choice.target, f.def.id);
          if (response === 'fought_back') {
            emit({ ...base, type: 'brawl', intensity: 0.9, public: true, confrontation: { response } });
          } else {
            emit({ ...base, type: 'argument', intensity: response === 'walked_away' ? 0.45 : 0.6, public: true, confrontation: { response } });
          }
          break;
        }
        case 'apologize': {
          const accepted = policy.acceptsApology(s, choice.target, f.def.id);
          emit({ ...base, type: 'apology', intensity: 0.6, public: false, apology: { accepted } });
          break;
        }
        case 'gossip':
          emit({ ...base, type: 'gossip', intensity: 0.3, public: false, gossip: { aboutEventId: choice.aboutEventId! } });
          break;
      }
    }
  }

  // ------------------------------------------------------------ nightly

  private nightly(emit: (d: EventDraft) => WorldEvent): void {
    const s = this.state;
    for (const id of fighterIds(s)) {
      this.reflect(id, emit);
      this.considerBreakup(id, emit);
      this.deriveLabels(id);
      pruneMemories(getFighter(s, id), s.tick);
    }
  }

  /**
   * After the night's threads are known: worries come back, and a good night's sleep
   * in a decent room counteracts sadness and fear (not anger — that takes people).
   * Then fighters write in their journals and, if they choose, to the manager.
   */
  private afterThreads(): void {
    const s = this.state;
    const dayStart = s.tick - TICKS_PER_DAY;
    for (const id of fighterIds(s)) {
      const f = getFighter(s, id);
      // Unresolved problems keep pulling their memories back up.
      for (const t of f.threads) {
        const recalled = retrieve(f, { entities: t.about }, this.providers.relevance, s.tick, 2, { touch: true });
        for (const r of recalled) feel(f.state.mood, r.memory.emotions, 0.25 * t.weight);
      }
      if (f.state.activity === 'sleep') {
        const room = s.layout.rooms.find((r) => r.id === f.state.location);
        const rest = (room?.comfort ?? DEFAULT_ROOM_COMFORT) * f.state.needs.comfort * (1 - preoccupation(s, id));
        const contentment = zeroEmotions();
        contentment.joy = 0.3 * rest;
        feel(f.state.mood, contentment, 1);
      }

      const entry = this.providers.diarist.write(s, id, dayStart);
      // Written in the small hours about the day before.
      if (entry) f.diary.push({ tick: dayStart + TICKS_PER_DAY - NIGHTLY_SLOT - 1, text: entry });

      for (const draft of this.providers.correspondent.compose(s, id)) {
        if (f.state.raisedTopics.includes(draft.topic)) continue;
        f.state.raisedTopics.push(draft.topic);
        s.inbox.push({ ...draft, id: `msg${s.inbox.length}`, tick: s.tick, from: id });
      }
    }
  }

  private reflect(id: FighterId, emit: (d: EventDraft) => WorldEvent): void {
    const s = this.state;
    const f = getFighter(s, id);
    if (f.state.importanceSinceReflection < REFLECTION_THRESHOLD) return;
    f.state.importanceSinceReflection = 0;

    for (const c of this.providers.reflector.reflect(s, id)) {
      const existing = f.beliefs.find((b) => b.subject === c.subject && b.predicate === c.predicate && b.object === c.object);
      if (existing) {
        const fresh = c.evidence.filter((e) => !existing.evidence.includes(e));
        if (fresh.length === 0) continue;
        existing.evidence = [...existing.evidence, ...fresh];
        existing.confidence = clamp01(Math.max(existing.confidence, c.confidence) + 0.05);
        existing.updatedAt = s.tick;
        continue;
      }
      if (c.confidence < MIN_BELIEF_CONFIDENCE) continue;
      f.beliefs.push({ ...c, formedAt: s.tick, updatedAt: s.tick });
      this.applyBeliefEffects(id, c.predicate, c.subject, c.object);
      emit({
        type: 'reflection',
        actors: [id],
        targets: [],
        location: f.state.location,
        intensity: 0.6,
        public: false,
        reflection: { owner: id, subject: c.subject, predicate: c.predicate, ...(c.object ? { object: c.object } : {}) },
      });
    }
  }

  private applyBeliefEffects(id: FighterId, predicate: string, subject: string, object?: string): void {
    const s = this.state;
    switch (predicate) {
      case 'betrayed_me':
        applyRelDelta(s, id, { toward: subject, trust: -0.2, resentment: 0.15, affection: -0.1 });
        break;
      case 'is_hostile_to_me':
        applyRelDelta(s, id, { toward: subject, resentment: 0.05, trust: -0.05 });
        break;
      case 'is_kind_to_me':
        applyRelDelta(s, id, { toward: subject, affection: 0.05, trust: 0.05 });
        break;
      case 'is_bad_cook':
        applyRelDelta(s, id, { toward: subject, respect: -0.03 });
        break;
      case 'favours':
        applyRelDelta(s, id, { toward: subject, trust: -0.1 });
        if (object) applyRelDelta(s, id, { toward: object, resentment: 0.05 });
        break;
    }
  }

  /** Leave a partner when someone else has clearly taken their place. */
  private considerBreakup(id: FighterId, emit: (d: EventDraft) => WorldEvent): void {
    const s = this.state;
    const partner = partnerOf(s, id);
    if (!partner) return;
    const toPartner = peekRel(s, id, partner).attraction;
    let best: FighterId | null = null;
    let bestAttraction = 0;
    for (const o of fighterIds(s)) {
      if (o === id || o === partner) continue;
      const a = peekRel(s, id, o).attraction;
      if (a > bestAttraction) {
        best = o;
        bestAttraction = a;
      }
    }
    if (!best || bestAttraction < 0.5 || bestAttraction < toPartner + 0.1) return;
    if (peekRel(s, best, id).attraction < 0.4) return;
    emit({
      type: 'breakup',
      actors: [id],
      targets: [partner],
      location: getFighter(s, id).state.location,
      intensity: 0.85,
      public: false,
    });
  }

  private deriveLabels(id: FighterId): void {
    const s = this.state;
    const f = getFighter(s, id);
    for (const [other, r] of Object.entries(f.relationships)) {
      if (!s.fighters[other]) continue;
      setLabel(s, id, other, 'close_friend', r.affection >= 0.7 && r.resentment < 0.3);
      setLabel(s, id, other, 'friend', r.affection >= 0.4 && r.resentment < 0.3);
      setLabel(s, id, other, 'enemy', r.resentment >= 0.6);
      setLabel(s, id, other, 'rival', r.resentment >= 0.35 && r.resentment < 0.6 && r.respect >= 0.2);
      setLabel(s, id, other, 'crush', r.attraction >= 0.5 && !r.labels.includes('dating'));
    }
  }
}

