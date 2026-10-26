import { addScaled, scaleEmotions, EMOTIONS } from '../emotion';
import type { CognitionProviders } from '../cognition/providers';
import { ruleBasedProviders } from '../cognition/rules';
import { acceptsApology, interactionCooldownKey } from '../cognition/rules/interaction';
import { pruneMemories, retrieve } from '../mind/memory';
import { computeFocus, computeThreads } from '../mind/threads';
import type { TemperamentAxis } from '../temperament';
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
import type { Emotion } from '../emotion';
import type { FighterId, SimState, UtteranceInterpretation, WorldEvent } from '../types';
import { clamp01, clampSigned, fnv1a, unit } from '../util/math';
import {
  applyRelDelta,
  attachment,
  fighterIds,
  fighterList,
  getFighter,
  isAsleep,
  occupants,
  pairKey,
  partnerOf,
  peekRel,
  cooldownReady,
  touchCooldown,
  setLabel,
} from '../world';
import type { Input, JournalEntry } from './inputs';
import { perceive } from './perception';
import { createState, type Scenario } from './scenario';

export type EventDraft = Omit<WorldEvent, 'id' | 'tick' | 'witnesses' | 'gloss'> & { witnesses?: FighterId[] };

const ARGUMENT_PRESSURE = 0.6;
const BRAWL_PRESSURE = 0.95;
const BRAWL_COOLDOWN = 3 * TICKS_PER_DAY;
/** Cooling-off period after an accepted apology. */
const TRUCE_TICKS = 2 * TICKS_PER_DAY;
const MIN_BELIEF_CONFIDENCE = 0.3;
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
    this.updateStatuses(emit);
    this.planAndMove(emit);
    this.updateNeeds();
    this.serveMeals(emit);
    this.spar(emit);
    this.socialize(emit);
    this.encounters(emit);

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
      emitted.push(...nightly);
    }

    for (const f of fighterList(s)) {
      const asleep = f.state.activity === 'sleep';
      for (const e of EMOTIONS) f.state.mood[e] *= asleep ? 0.95 : 0.97;
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
        if (e.apology?.accepted && a && b) {
          // Clearing the air buys a cooling-off period and settles the guilt.
          const pair = pairKey(a, b);
          touchCooldown(s, `argument:${pair}`);
          s.cooldowns[`argument:${pair}`] = s.tick + TRUCE_TICKS;
          s.cooldowns[`brawl:${pair}`] = s.tick + TRUCE_TICKS;
          s.cooldowns[`apology_ok:${a}>${b}`] = s.tick;
          getFighter(s, b).state.mood.anger *= 0.5;
        }
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
    }
    this.journal.push({ tick: s.tick, input });
  }

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
          const key = `spar:${pairKey(a, b)}`;
          if (!cooldownReady(s, key, TICKS_PER_DAY)) continue;
          touchCooldown(s, key);
          emit({ type: 'sparring', actors: [a], targets: [b], location: room.id, intensity: 0.25, public: true });
        }
      }
    }
  }

  /** How close `a` is to snapping at `b`. */
  pressure(a: FighterId, b: FighterId): number {
    const s = this.state;
    const f = getFighter(s, a);
    const t = f.temperament;
    const r = peekRel(s, a, b);
    if (r.resentment < 0.2) return 0;
    return (
      r.resentment * (0.6 + 0.6 * unit(t.volatility)) +
      0.2 * unit(t.aggression) +
      0.3 * f.state.mood.anger -
      0.35 * unit(t.discipline) -
      // Hard to go all-out at someone you still have feelings for.
      0.3 * attachment(s, a, b)
    );
  }

  private encounters(emit: (d: EventDraft) => WorldEvent): void {
    const s = this.state;
    for (const room of s.layout.rooms) {
      const here = occupants(s, room.id).filter((f) => f.state.activity !== 'recover');
      for (let i = 0; i < here.length; i++) {
        for (let j = i + 1; j < here.length; j++) {
          const a = here[i]!.def.id;
          const b = here[j]!.def.id;
          const pa = this.pressure(a, b);
          const pb = this.pressure(b, a);
          const [initiator, other, p] = pa >= pb ? [a, b, pa] : [b, a, pb];
          const pair = pairKey(a, b);
          if (p >= BRAWL_PRESSURE && cooldownReady(s, `brawl:${pair}`, BRAWL_COOLDOWN)) {
            touchCooldown(s, `brawl:${pair}`);
            touchCooldown(s, `argument:${pair}`);
            emit({ type: 'brawl', actors: [initiator], targets: [other], location: room.id, intensity: 0.9, public: true });
          } else if (p >= ARGUMENT_PRESSURE && cooldownReady(s, `argument:${pair}`, 12)) {
            touchCooldown(s, `argument:${pair}`);
            emit({ type: 'argument', actors: [initiator], targets: [other], location: room.id, intensity: 0.6, public: true });
          }
        }
      }
    }
  }

  private socialize(emit: (d: EventDraft) => WorldEvent): void {
    const s = this.state;
    for (const f of fighterList(s)) {
      if (isAsleep(f, s.tick) || isSleepTime(s.tick)) continue;
      const present = occupants(s, f.state.location).map((o) => o.def.id);
      const choice = this.providers.interaction.choose(s, f.def.id, present);
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
        case 'apologize': {
          const accepted = acceptsApology(s, choice.target, f.def.id);
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
      this.fadeAbsence(id);
      this.heal(id);
      this.deriveLabels(id);
      this.ruminate(id);
      this.drift(id);
      pruneMemories(getFighter(s, id), s.tick);
    }
  }

  private reflect(id: FighterId, emit: (d: EventDraft) => WorldEvent): void {
    const s = this.state;
    const f = getFighter(s, id);
    // Old beliefs fade without fresh evidence.
    for (const b of f.beliefs) if (s.tick - b.updatedAt > TICKS_PER_WEEK) b.confidence -= 0.03;
    f.beliefs = f.beliefs.filter((b) => b.confidence >= 0.2);

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

  /** Out of sight, out of mind — slower for the loyal. */
  private fadeAbsence(id: FighterId): void {
    const s = this.state;
    const f = getFighter(s, id);
    const loyalty = unit(f.temperament.loyalty);
    for (const [other, r] of Object.entries(f.relationships)) {
      const seen = f.state.lastSeen[other];
      if (seen !== undefined && s.tick - seen < TICKS_PER_DAY) continue;
      r.attraction = clamp01(r.attraction - 0.03 * (1 - 0.5 * loyalty));
    }
  }

  /** Time heals — faster for the disciplined and even-tempered, slower for big egos. */
  private heal(id: FighterId): void {
    const s = this.state;
    const f = getFighter(s, id);
    const t = f.temperament;
    const rate = 0.02 * (0.5 + unit(t.discipline) + (1 - unit(t.volatility)) - unit(t.ego));
    for (const [other, r] of Object.entries(f.relationships)) {
      if (r.resentment > 0) r.resentment = clamp01(r.resentment - Math.max(0.005, rate));
      // Lingering feelings for an ex fade once they've moved on.
      if (r.labels.includes('ex') && partnerOf(s, other) !== null) {
        r.attraction = clamp01(r.attraction - 0.015 * (1 - 0.5 * unit(t.loyalty)));
      }
    }
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

  /** Unresolved threads keep pulling painful memories back up. */
  private ruminate(id: FighterId): void {
    const s = this.state;
    const f = getFighter(s, id);
    for (const t of f.threads) {
      const recalled = retrieve(f, { entities: t.about }, this.providers.relevance, s.tick, 2, { touch: true });
      for (const r of recalled) addScaled(f.state.mood, scaleEmotions(r.memory.emotions, 0.25 * t.weight), 1);
    }
  }

  /** Defining memories slowly reshape temperament. */
  private drift(id: FighterId): void {
    const s = this.state;
    const f = getFighter(s, id);
    const DRIFT: Partial<Record<Emotion, Partial<Record<TemperamentAxis, number>>>> = {
      anger: { volatility: 0.02, aggression: 0.01 },
      fear: { courage: -0.02 },
      shame: { ego: -0.01, courage: -0.01 },
      jealousy: { loyalty: -0.01, volatility: 0.01 },
      sadness: { sociability: -0.01 },
      joy: { sociability: 0.01 },
      affection: { loyalty: 0.01 },
      gratitude: { loyalty: 0.01 },
    };
    for (const m of f.memories) {
      if (!m.core || s.tick - m.createdAt >= TICKS_PER_DAY) continue;
      let dominant: Emotion = 'joy';
      for (const e of EMOTIONS) if (m.emotions[e] > m.emotions[dominant]) dominant = e;
      for (const [axis, d] of Object.entries(DRIFT[dominant] ?? {})) {
        const a = axis as TemperamentAxis;
        f.temperament[a] = clampSigned(f.temperament[a] + d!);
      }
    }
  }
}

