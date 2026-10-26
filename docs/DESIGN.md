# Design Document — 3v3 Personality Auto-Battler (working title)

Status: living document. Captures decisions made so far and the proposed architecture.

---

## 1. Vision

Players collect, house and train a stable of fighters who compete in 3v3 live-action
close-combat brawls (in the spirit of *The Bouncer*, PS2). Fighters are not bots with
movesets — they are **people with vectorised personalities, memories and relationships**.
Managing their minds is as much of the game as managing their power.

Two stages, one mind:

- **Home Base** — a Sims-like house where fighters live, eat, train, gossip, fall in love,
  fall out, and carry baggage.
- **Arena** — a stylised 2.5D brawler where those same minds decide how to fight.

### Pillars

1. **One mind, two stages.** The same personality, memory and relationship model drives
   behaviour at home and in the arena. A clingy fighter is clingy in both.
2. **Personality is the only randomness.** No hidden dice. If an attack lands, it lands;
   if it is blocked, it is blocked. Variance comes from who the fighters *are*.
3. **Emergent drama, not scripted drama.** Love triangles, feuds and redemption arcs fall
   out of the simulation rules.
4. **Matchups from geometry, not type charts.** Fighter A's punch works on Fighter B but
   not Fighter C because C is always crouched — not because of a rock-paper-scissors table.
5. **Legibility.** The player must be able to see *why* something happened.
6. **No invisible hand.** Nothing decays, heals, drifts or resets on a timer to keep
   fighters manageable. Resentment does not fade by itself, an ex is not forgotten by
   itself, beliefs do not expire, personalities do not drift. Every change has a cause in
   the world: an event, a conversation, a gift, a manipulation, a match. Relationships are
   *purposefully* hard to manage, and neglect has a real price: fighters can leave for good.
   (Physiology is the exception: hunger, fatigue, injuries healing, and momentary feelings
   settling. Lasting state never does.)

### Decisions so far

| Topic | Decision |
|---|---|
| Body plans | Humanoid only for now (petite → hulking brute). Quadrupeds etc. later. |
| View | Stylised 2.5D for the prototype; upgrade to 3D only if needed. |
| Modes | Both PvE and PvP. |
| In-fight intervention | Yes: standard (throw in the towel), unique (crowd/bandstand actions), and coach chat (limited effect). |
| Randomness | Deterministic. Personality provides all variance. |
| Chat with fighters | Post-MVP. LLM-driven, grounded in the memory system. |
| Substances (PEDs etc.) | Down the road. Hooks into state/temperament modifiers. |

---

## 1a. Management Philosophy

- **Difficult by design.** Unlike The Sims, the house is not self-balancing. Left alone,
  a feud escalates; it does not cool off.
- **Fighters can walk out permanently.** Neglect, mistreatment and a broken relationship
  with the manager end in departures.
- **Many levers, none guaranteed:** house layout, room assignments, schedules, gifts,
  talking (later: free-form chat), mediation, discipline, and manipulation.
- **Manipulation is a strategy, for both sides.** Fighters can lie and stir the pot
  (e.g. Sally, who likes Bob, feeds lies into the Bob–Jin feud). The player can uncover
  it through logs and by talking to people, and can respond however they choose — up to
  and including deliberately throwing a troublemaker into a brutal, outclassed match.
- **The house is watching the manager.** Fighters perceive the manager's actions and form
  their own (multi-axis) relationship with the manager: trust, affection, respect, fear.
  Sending fighters who don't obey into horrific matches lowers trust and affection
  house-wide, not just with the victim.
- **Roster economics.** Long-run incentive: nurture no-name street fighters who jive
  together. Short-run: hire big names as mercenaries for power, a matchup or a tournament
  — or cynically hire a talented jerk just to burn in a high-stakes match for the entry pay.
- **Match types and stakes.** Different match types with escalating brutality; higher
  stakes mean greater rewards and greater risk of severe injury or worse.

## 2. Core Loop

```
        ┌──────────────── HOME BASE (week) ────────────────┐
        │ needs · rooms · training · meals · gossip · drama │
        └───────────┬───────────────────────────▲───────────┘
   pre-fight state: │ mood, focus, fatigue,      │ fight memories: pride, shame,
   bonds, feuds,    │ confidence, open threads   │ trauma, debts, bonding under fire,
   injuries         ▼                            │ learned matchup knowledge
        ┌──────────────── ARENA (3v3 brawl) ───────────────┐
        │ personality-weighted decisions on real geometry   │
        │ + player interventions (towel, crowd, coach chat) │
        └───────────────────────────────────────────────────┘
```

Cadence: roughly one fight per in-game week; the home sim runs in coarse time blocks
(e.g. 30-minute slots) between fights.

---

## 3. Fighter Model

Each fighter is a stack of layers that change at different rates.

| Layer | Rate of change | Contents |
|---|---|---|
| **Body** | Rare (training, injury, age) | Height, mass, limb reach, hurtbox proportions, strength, speed, stamina, moveset |
| **Temperament** | Only through explicit causes (e.g. future substances) | The personality vector |
| **Disposition** | Slow (weeks) | Confidence, outlook, trust in the manager, learned fears/aversions |
| **Relationships** | Event-driven | Directed, multi-axis edges to every known person (see §4.6) |
| **Beliefs** | Nightly reflection | Structured conclusions drawn from memories (may be false) |
| **Memory stream** | Continuous | Subjective, appraised records of events (see §4) |
| **State** | Seconds / hours | Mood, fear, rage, fatigue, hunger, focus, morale, preoccupation |

### 3.1 Temperament vector (first pass)

Every axis must change decisions in **both** stages. Values in `[-1, 1]`.

| Axis | Home effect | Arena effect |
|---|---|---|
| Aggression | Starts arguments, competitive in training | Pressure, combo commitment, initiative |
| Courage | Confronts problems vs avoids | Retreat threshold, fear response |
| Discipline | Sticks to training/schedule | Obeys calls, cancels unsafe strings |
| Ego | Needs status, best bed, praise | Showboating, glory targeting, stubbornness |
| Loyalty | Takes sides, holds grudges for friends | Protects/rescues allies |
| Volatility | Mood swings, emotional reactivity | Rage/panic breakpoints, high variance style |
| Sociability | Needs company vs privacy | Fights near allies vs isolates |
| Curiosity | Tries new things, learns | Experiments, adapts to opponents faster |
| Sensuality / Romance* | Attraction, partnering | Distraction susceptibility around partner/ex |

\*Working axis; may be folded into Sociability once tested.

Players never see raw numbers. Vector regions map to readable **traits** ("Glory Hound",
"Mother Hen", "Cold Professional"); the rest is read from behaviour.

---

## 4. Memory & Social Cognition System

This is the heart of the game. Inspired by Stanford's *Generative Agents* ("Smallville",
Park et al. 2023), which used a **memory stream → retrieval → reflection → planning**
architecture. We keep that architecture but adapt it for a game:

| Smallville | This game | Why |
|---|---|---|
| Memories are natural-language strings | Memories are **structured records** with a natural-language gloss | Gameplay hooks need machine-readable facts ("Martha is dating Jin") |
| LLM rates importance | **Rule-based appraisal** weighted by temperament | Deterministic, cheap, tunable |
| Embedding similarity for relevance | **Entity/tag/emotion overlap** (embeddings only for chat) | Deterministic, explainable |
| LLM reflection | **Rule-based belief formation**, LLM optional for prose | Deterministic, testable |
| LLM call every step | **No LLM in the simulation loop** | Cost (Smallville cost thousands of $ for 25 agents/2 days), determinism, PvP integrity |

**The simulation is the source of truth. The LLM is a narrator and an interface, never
the authority.**

### 4.1 Pipeline

```
World Event ──► Perception ──► Appraisal ──► Memory Stream ──► Reflection ──► Beliefs
 (objective)    (who saw /      (subjective    (per fighter)    (nightly)      │
                 heard what)     emotion +                                       ▼
                                 importance)                     Relationships, Goals,
                                     ▲                           Open Threads, Disposition
                                     │                                           │
                         Retrieval ◄─┴─── cues (place, person, song, situation) ◄┘
                             │
                             ▼
                 Behaviour (home plans, arena decisions, chat)
```

### 4.2 World events (objective truth)

Everything that happens is logged once, objectively:

```ts
interface WorldEvent {
  id: EventId;
  tick: Tick;
  type: EventType;            // "meal_shared", "insult", "kiss", "breakup", "rescue_in_fight", ...
  actors: FighterId[];        // who did it
  targets: FighterId[];       // who it was done to
  location: LocationId;       // "kitchen_a", "arena", ...
  features: AppraisalFeatures;// humiliation, threat, betrayal, affection, achievement, loss, ...
  intensity: number;          // 0..1
  public: boolean;            // visible to anyone present
}
```

### 4.3 Perception & knowledge (who knows what)

Fighters only learn about events they **witness** or are **told about**. Knowledge is local.
This is where secrets, rumours and dramatic reveals come from.

- **Witnessed** — present at the location (and not asleep/distracted).
- **Told** — via a gossip interaction; carries the teller's slant and a confidence < 1.
- **Inferred** — via reflection ("they keep eating together… they're dating").

Gossip propagates through the social graph weighted by sociability and relationship
closeness. Information can be distorted (teller's resentment toward the subject raises
negative framing). **Beliefs can be false**, and false beliefs are as dramatic as true ones.

### 4.4 Memories (subjective)

```ts
interface Memory {
  id: MemoryId;
  eventId: EventId;
  owner: FighterId;
  source: "witnessed" | "told" | "inferred";
  toldBy?: FighterId;
  confidence: number;          // 0..1
  emotions: EmotionVector;     // joy, anger, fear, shame, jealousy, gratitude, grief, ...
  valence: number;             // -1..1
  importance: number;          // 0..1, see appraisal
  entities: EntityRef[];       // people, places, objects, songs, foods
  tags: Tag[];
  createdAt: Tick;
  lastRecalled: Tick;
  recallCount: number;
  core: boolean;               // defining memory; never pruned
  gloss: string;               // template-rendered NL: "Martha kissed Jin in Kitchen A."
}
```

**Appraisal** — the same event lands differently on different people:

```
emotion_e  = Σ_f  event.features[f] × sensitivity[f→e](temperament)
importance = event.intensity × involvement(owner, event) × |emotion|
```

- `involvement`: self > partner/ex/close friend > teammate > stranger.
- Ego amplifies humiliation; Loyalty amplifies betrayal; Volatility amplifies everything.

### 4.5 Retrieval

When a fighter needs context (making a plan, reacting to a person, being cheered, being
chatted with), memories are scored against a **cue**:

```
score = w_rec · recency + w_imp · importance + w_rel · relevance + w_mood · moodCongruence

recency        = 0.995 ^ (ticksSince(lastRecalled))
relevance      = overlap(cue.entities ∪ cue.tags, memory.entities ∪ memory.tags)
moodCongruence = cos(currentMood, memory.emotions)
```

Mood-congruent recall is intentional: sad fighters remember sad things, which can spiral.
That gives the player something to break (a good meal, a win, a favourite song, a talk).

Recalling a memory refreshes `lastRecalled` — rumination keeps wounds fresh.

### 4.6 Relationships

Directed and asymmetric (Bob's view of Jin ≠ Jin's view of Bob).

```ts
interface Relationship {
  from: FighterId; to: FighterId;
  affection: number;   // -1..1
  respect: number;
  trust: number;
  attraction: number;
  resentment: number;  // 0..1
  fear: number;        // 0..1
  familiarity: number; // 0..1, grows with time spent together
  labels: RelLabel[];  // friend, close_friend, rival, enemy, crush, dating, ex, mentor, mentee, sparring_partner
  history: MemoryId[]; // the memories that shaped this edge
}
```

- Axes move from appraised memories. Labels change through a state machine with
  thresholds + triggering events (e.g. `crush → dating` requires mutual attraction and a
  confession event; `dating → ex` requires a breakup event).
- **Triadic rules** create the interesting stuff:
  - *Jealousy*: if A is attached (dating/ex/crush) to P and believes P is attached to B →
    A's resentment toward B grows; magnitude scales with A's ego and volatility.
  - *Caught in the middle*: if P has strong edges to A and B, and A and B are hostile →
    P gets an open thread (see §4.8).
  - *Taking sides*: friends of A inherit a fraction of A's resentment toward B, scaled by
    their loyalty. Factions form.
- Combat produces relationship events too: rescues, abandonment, kill-stealing, shared wins.

### 4.7 Reflection (nightly consolidation)

During "sleep", each fighter runs reflection rules over recent high-importance memories,
producing **beliefs** — structured, evidence-linked, possibly wrong:

```ts
interface Belief {
  subject: EntityRef;  predicate: Predicate;  object?: EntityRef;
  confidence: number;
  evidence: MemoryId[];
  formedAt: Tick;
}
// e.g. (Jin, betrayed, me)  (Martha, prefers, Jin)  (me, cannot_beat, crouchers)
```

- Rules pattern-match: "≥2 memories of P choosing B over me in 7 days → (P, prefers, B)".
- Contradicting evidence lowers confidence; beliefs below a floor are dropped.
- Reflections themselves become memories (source `inferred`) so they can be retrieved and
  gossiped — exactly like Smallville's reflection tree.
- High-importance memories are flagged `core` and are never pruned.

### 4.8 Goals, plans and open threads

- **Daily plan**: built from needs (eat, sleep, train, socialise, privacy), goals, and
  beliefs. Includes **avoidance constraints** ("avoid Jin") and **seeking** ("be near
  Martha").
- **Open threads**: unresolved emotionally-charged situations (a feud, a breakup, being
  caught in the middle, an unpaid debt, a broken promise). Each has a weight.
- **Preoccupation** = `Σ thread.weight × (1 − composure)`, where composure derives from
  discipline and low volatility.
- **Focus** = `baseFocus − preoccupation − fatigue`. Focus feeds the arena: reaction time,
  read accuracy, and how much attention is left for the coach.

So Martha's **Distracted** status isn't hand-scripted — it is high preoccupation from
being caught between two hostile men, and the UI surfaces it as "Distracted".

Threads resolve only through events: apologies, conversations, catharsis (winning a fight
side by side), player intervention, or escalation (a blow-up that ends it, for better or
worse). **Never through the mere passage of time** (see pillar 6).

### 4.9 Encounters & shared spaces

When two fighters with a hostile edge co-locate, an **encounter check** runs
(deterministic):

```
pressure = resentment(A→B) × (0.5 + volatility_A) + jealousy_A − discipline_A × k
if pressure > threshold_argument → argument event
if pressure > threshold_brawl    → brawl event (injury / suspension / "Shaken")
```

Avoidance goals make fighters route around each other — until a **contested shared
resource** (one kitchen at dinner time) forces them together. Hence the player's lever:
**the house layout is a social-engineering tool.** Two kitchens, staggered meal times,
room assignments and training schedules all change who meets whom.

### 4.10 Worked example: Bob, Jin and Martha

1. *Weeks 1–4*: Bob and Jin spar daily → familiarity + respect up → label `friend`.
   Martha and Bob share meals, confession event → `dating`.
2. *Week 5*: Bob is injured in a fight → he's in the infirmary. Jin covers cooking.
   Martha and Jin spend evenings in Kitchen A → attraction rises both ways.
3. *Week 6*: Breakup event (Martha → Bob). Kiss event (Martha, Jin) in Kitchen A —
   witnessed by Rosa.
4. Bob wasn't present. Rosa (sociable, dislikes Jin) **gossips** to Bob with negative slant.
   Bob forms memory `source: told`, high importance (ego + attraction to Martha), emotions:
   jealousy, anger, grief.
5. *Night*: Bob's reflection → beliefs `(Jin, betrayed, me)`, `(Martha, prefers, Jin)`.
   Bob → Jin resentment spikes; `friend` → `enemy`. Rosa's friends take Bob's side.
6. Bob's plan gains `avoid Jin`; Jin (who feels guilty → shame memory) also avoids Bob.
   With one kitchen, dinner forces an encounter → brawl → both "Shaken", out that week.
   **With two kitchens**, the encounter is avoided.
7. Martha: strong edges to both, they're hostile → *caught-in-the-middle* thread →
   preoccupation → **Distracted** in her next fight (slower reactions, misreads, may
   glance at Jin when he's hit).
8. In the arena, if Bob and Jin are on the same team: no tag-team moves, possible
   abandonment ("lets him get hit"), but a rescue event could start repairing the edge.

None of this is scripted — it falls out of the rules.

### 4.11 Where LLMs fit (post-MVP)

- **Chat with fighters** (see §7.3, §10): the LLM is given the fighter's temperament,
  current state, top retrieved memories for the player's message, relevant beliefs, and
  relationship summaries. It **may only reference facts present in that context**.
- **Output is parsed into structured intents** (reassure, demand, promise, question, threat…)
  which become `WorldEvent`s. The simulation applies the effects deterministically.
  Fighters remember what the coach said; kept or broken promises move trust.
- Fighters may **lie or withhold** based on trust in the coach and temperament. Martha
  won't tell you she's distracted unless she trusts you.
- Optional: LLM-written prose for reflections and diary entries (cosmetic only).

### 4.12 LLM-ready by design (the long-term goal)

The goal is for fighters to feel close to sentient once models and hardware allow —
coaching should become about *what is actually said*, not numbers. Example: shouting
"You can do it, Bob!" while **Jin** is the one fighting should hurt, especially given
their history. So the hooks are built in from day one, not retrofitted:

1. **Every cognitive act is a swappable provider** (`packages/sim-core/src/cognition/providers.ts`):
   `Appraiser` (how an event feels), `ActivityPolicy` (what to do), `InteractionPolicy`
   (whom to engage and how), `Reflector` (what to conclude), `UtteranceInterpreter`
   (what words mean), `RelevanceScorer` (what to recall), `Narrator` (how to say it).
   Each ships with a rule-based implementation; any of them can be replaced by a
   richer mind without touching the rest of the simulation.
2. **Language is first-class data.** Raw text is never discarded: utterances keep their
   exact words next to their interpretation; every memory has a natural-language gloss.
3. **Determinism contract.** Providers inside `Simulation.step` must be pure.
   Non-deterministic minds (LLMs, remote services) run *outside* the step and act through
   journaled `Input`s — e.g. a `coach_utterance` carrying an LLM's interpretation, or an
   `intent` ("seek Martha", "avoid Jin"). The in-sim interpreter's output is journaled
   too, so replays never re-run any interpreter. Result: LLM-driven runs replay bit-for-bit,
   which keeps PvP verifiable.
4. **Grounded context export.** `buildMindContext()` / `renderMindContext()` produce exactly
   what an LLM needs to speak or act as a fighter: traits, current state, relationships,
   beliefs, open threads, and memories retrieved against a cue. The LLM may only reference
   facts present in that context.
5. **Upgrade path.** Today: keyword interpreter → tomorrow: LLM interpreter (same
   interface) → later: LLM-driven deliberation pushing `intent`s, LLM appraisal for
   free-form events, embedding-based `RelevanceScorer` for chat. The simulation remains the
   source of truth throughout.

---

## 5. Home Base

- **Needs**: rest, food, social, privacy, stimulation, status. Temperament weights them.
- **Rooms**: bedrooms (shared or private), kitchens, gym/training rooms, infirmary,
  common room. Rooms have capacity, quality and adjacency.
- **Roles/jobs**: cook, cleaner, sparring partner, mentor. Skill matters — a bad cook lowers
  everyone's food satisfaction (Jin's terrible cooking is a morale problem).
- **Training**: player sets regimens; fighters negotiate. Over-pushing low-discipline fighters
  costs trust. Curious fighters learn faster from variety.
- **Player levers**: layout/building, room assignments, schedules, roles, team selection,
  one-on-one talks (chat, later), events (parties, team dinners), discipline.
- **Output**: pre-fight state per fighter (mood, focus, fatigue, confidence, injuries,
  relationships with teammates).

---

## 6. Arena (2.5D Brawler)

### 6.1 Geometry-driven combat

- Stylised 2.5D: side-ish camera with a depth plane (belt-scroller space), so fighters can
  circle, flank and gang up.
- **Hurtboxes are derived from body proportions and current stance.** A crouched guard
  shrinks and lowers the high/mid hurtboxes.
- **Hitboxes are real geometry over real frames.** A straight punch travels at the
  attacker's shoulder height and reach.
- **Contact quality** is computed, not rolled: `clean`, `glancing`, `blocked`, `whiff`,
  based on hitbox/hurtbox overlap, guard orientation and timing.
- That gives the *Bouncer* effect directly: A's straight punch is clean against upright B,
  glancing or whiffing against always-crouched C.
- **Mass and size** matter: knockback, grab/throw eligibility (a petite fighter can't
  suplex a brute; a brute can throw a petite fighter across the ring), stagger resistance.
- Petite ↔ brute is a continuum of height, mass, reach, speed, recovery — not classes.

### 6.2 Personality-weighted decisions (utility AI)

Each decision tick, candidate actions are scored:

```
utility(action) = base(action, situation)
                × temperamentWeights(action)
                × stateModifiers(fear, rage, focus, fatigue)
                × relationshipModifiers(ally/enemy edges)
                × matchupKnowledge(opponent)
```

- **Stance preference** comes from personality: cautious fighters crouch-guard; aggressive
  fighters stand tall and press; this feeds straight back into geometry.
- **Commitment**: actions in progress resist re-evaluation in proportion to aggression/ego
  (the berserker finishes the punishable combo).
- **Breakpoints**: rage, panic, freeze, second wind — triggered by state thresholds.
- **Team behaviour**: protect, rescue, tag-team moves (require mutual trust), kill-steal
  (rival + ego), abandonment (resentment).
- **Showboating**: high ego taunts; can rattle low-courage opponents.

### 6.3 Procedural (matchup) memory

Separate from episodic memory: fighters learn what works.

- Track per-move outcome stats per opponent and per opponent *profile* (crouchers, big
  reach, fast dashers).
- Curious/disciplined fighters update quickly; high-ego fighters update slowly and keep
  throwing the punch that doesn't land — a visible flaw the player can coach.
- Repeated defeats by a technique can unlock learning a counter (signature moves come from
  personal history).

### 6.4 Combat → memory

Fights emit `WorldEvent`s: rescues, abandonments, humiliations, comebacks, knockouts, the
towel being thrown. They go into the same memory pipeline, so the arena changes the house.

---

## 7. Player Interventions During Fights

All interventions are **inputs** to the deterministic sim (logged with tick), never dice.

### 7.1 Standard
- **Throw in the towel** — ends the fight. Memory appraised per fighter: gratitude (low ego,
  hurt) or humiliation/resentment (high ego, "I had him").

### 7.2 Unique / crowd actions
- **Bandstand plays a song**, **start a cheer**, etc. These work as **retrieval cues**: the
  song pulls Jin's associated memories into working memory, and their emotions apply to
  his state. A song tied to a happy memory boosts morale; the same song tied to a loss
  could backfire. Limited uses per fight (crowd-favour resource).

### 7.3 Coach chat (post-MVP, LLM)
- Like a coach yelling at a boxer: limited bandwidth.
- **Attention gate**: does the fighter even hear it? (focus, distance, current intensity)
- **Trust gate**: do they accept it? (trust in coach, discipline)
- **Interpretation**: volatile fighters may overreact; high ego may do the opposite.
- Parsed into a structured intent at the moment it's sent and logged, so replays reproduce.

---

## 8. Determinism, Replays, PvE and PvP

- The simulation (home and arena) is **deterministic**: seeded PRNG used only for
  world-generation and tie-breaking that is itself a pure function of state; fixed timestep;
  no wall-clock or frame-rate dependence; careful math (avoid platform-variable
  transcendental functions in sim code, or use fixed-point/lookup tables).
- A fight is fully reproducible from: **team snapshots + seed + input log**. Replays and
  "why did that happen" explanations come free.
- **PvE**: campaign opponents are full fighters with their own memories. Rival teams
  remember you; grudges persist across matches.
- **PvP (async first)**: your team vs a snapshot of the opponent's team (their state at
  snapshot time, plus their pre-set "corner plan"). Server re-simulates to verify results.
- **PvP (live, later)**: lockstep — both players' interventions are inputs to the same
  deterministic sim.
- LLM output never enters the sim directly — only the parsed, logged intent does.

---

## 9. Technical Architecture (proposed)

Engine-agnostic simulation core, separated from rendering:

```
packages/
  sim-core/       deterministic: fighters, memory, social, home sim, (combat next), events
    src/cognition/  provider interfaces + rule-based minds + mind-context export
    src/mind/       memory stream, retrieval, threads/focus/readiness
    src/sim/        Simulation (step loop), perception, inputs/journal, scenarios
  sim-headless/   CLI harness: narrated runs, layout comparisons, mind inspection
apps/             (later)
  client/         2.5D renderer + UI (consumes sim-core)
  server/         PvP verification, matchmaking
```

**Stack:** TypeScript throughout (Node 22, npm workspaces, Vitest).
- One language for sim, headless harness, browser client and server.
- Client rendered with **Three.js using an orthographic / stylised camera** for 2.5D —
  upgrading to full 3D later is a camera and asset change, not a rewrite.
- Easy LLM integration for chat later.

Alternative: Godot 4 (strong animation tooling) with the sim in C#. More tooling, less
web-native, harder to share code with a PvP server.

### Debugging tools (essential)
- Event log viewer and per-fighter memory/belief inspector.
- Relationship graph view.
- "Why?" explainer: for any decision, show the top utility contributors and retrieved memories.
- Headless metrics: does changing a temperament axis measurably change behaviour and
  outcomes? If not, the axis is cosmetic.

---

## 10. Roadmap

Milestones 1 and 2 are independent and can be built in parallel.

| # | Milestone | Proves |
|---|---|---|
| 1 | **Headless 1v1 combat** — geometry, stances, contact quality, 3 temperament axes | Personality + body produce visibly different fights (the crouch-vs-punch effect) |
| 2 | **Headless social sim** — events, perception, appraisal, memory, retrieval, reflection, relationships, gossip, encounters, apologies; text log output; LLM seams ✅ *first pass done* | Bob/Jin/Martha-style drama emerges unscripted |
| 2b | **Lies & manipulation, gifts, mediation** — fabricated gossip with provenance the player can trace; player social actions | Pot-stirring is discoverable and counterable |
| 3 | **3v3 combat** + team behaviour + combat → memory events | Relationships change fights |
| 4 | **Close the loop** — home week → fight → home week; match types & stakes; manager perception (multi-axis); departures | The core loop is fun in text |
| 5 | **2.5D client** — arena rendering, house view, inspectors | Readability; does 2.5D look good enough? |
| 6 | **In-fight interventions** — towel, crowd actions as retrieval cues | Player agency during auto-battles |
| 7 | **LLM chat** — grounded in memory, intents → events | "Get a feel" for the team |
| 8 | **PvE campaign / async PvP** | Retention, competition |
| — | Later: substances (volatility/performance modifiers + memories), non-humanoid body plans, live PvP | |

---

## 11. Open Questions

- Tech stack confirmation (TypeScript + Three.js recommended).
- Roster size target (affects memory budget; Smallville ran 25 agents). Proposal: 6–12
  fighters plus a handful of staff NPCs.
- Can fighters leave/quit, retire, die? (Strong stakes vs player frustration.)
- How visible is the memory system to the player? Full inspector, diary entries, or only
  inferred from behaviour and chat?
- Romance content boundaries and tone.
