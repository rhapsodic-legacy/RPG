# Beyond the Edge — Game Design Vision

> The Edge is the visible rim of the galaxy. Seen from far enough away to take in the whole galaxy, thousands of systems beyond it can't be seen at all. That is where the crews work.

## One-line pitch

A turn-based crew campaign game where the universe remembers you. You start with a random crew and a battered ship, take jobs, make enemies and friends, and over many campaigns your retired crews become legends that later crews meet in the world.

## Genre and originality

We are inspired by the *genre* of solo crew-campaign skirmish games (random crew, ship, jobs, loot, rivals, campaign turns) and by late-90s isometric CRPGs (turn-based grid combat, dialogue-driven missions with non-combat solutions).

We do **not** reproduce any existing game's rules, tables, terminology, stat blocks, setting or text. Every system here is designed from first principles for this game. When in doubt, design it differently. See `CLAUDE.md` for the hard rule.

## Design pillars

1. **The universe is alive and holistic.** Factions, markets, regions and characters change between and because of your turns. Nothing is a static mission board.
2. **Crew are people, not job slots.** Each crew member has temperament, values, wants, fears, memories and relationships. They grow, change their minds, fall out, fall in love, leave, come back.
3. **Reputation is a relationship with the world.** As your name grows, factions and people form opinions about you, and those opinions shape what the world offers and demands.
4. **Legacy, not reset.** Finishing a campaign is a beginning. Retired crews persist into the shared universe; their deeds echo into future crews.
5. **Rules first, AI optional.** Every system works fully with hand-authored rules. LLM and advanced AI hooks deepen it; they never become a requirement.

## Core loops

### Campaign turn (out of battle)
1. **Arrive / news** — the universe ticks; you read the local feed (generated from real simulation events).
2. **Bay phase** — your ship in its docking bay, rendered 2.5D. Talk to crew, see relationships play out, resolve personal events, repair, upgrade, trade.
3. **Choose work** — jobs come from factions, contacts, rivals and crew personal arcs. Jobs have stakes beyond pay (who it helps, who it hurts).
4. **Mission** — tactical map. May be combat, dialogue, stealth, negotiation, or all of them.
5. **Aftermath** — injuries, loot, consequences written into the Chronicle; the universe and crew react.
6. **Travel** — choose next destination; travel events.

### Tactical mission (in battle)
- Turn-based, square grid, isometric presentation.
- Action points per unit; cover, line of sight, elevation, morale.
- Crew act with *some* personality: a terrified recruit might hesitate; a vengeful one might ignore orders near their rival. Player always keeps final control unless a clearly signposted trait says otherwise.
- Missions can end without combat: talking, sneaking, bribing, retreating.

### Meta loop (across campaigns)
- Each campaign has a **Main Objective** chosen at crew creation (driven by crew backstories).
- On completion: **continue** or **retire**.
- Retired crews enter the **Legacy Registry**: they become NPC crews/characters, factions, or locations in future campaigns, and pass on **Inheritances** (contacts, a ship part, a reputation tag, a story hook).
- **Outpost** (moon base, unlocked): persistent hub shared by all crews on the profile. Build facilities, store heirlooms, host retired crew members as mentors/vendors, and see a memorial wall of your history.

## Systems overview (original designs)

### Crew personality model
- **Temperament** — five continuous axes, each -1..+1: *Warmth* (cold ↔ warm), *Nerve* (anxious ↔ steady), *Drive* (content ↔ ambitious), *Order* (chaotic ↔ disciplined), *Candor* (guarded ↔ open).
- **Values** — 2–3 from a list (loyalty, freedom, wealth, justice, faith, family, knowledge, glory...). Values decide how they judge your choices.
- **Wants and fears** — concrete, story-generating goals ("pay off my debt to the Halvard syndicate", "never be left behind again").
- **Mood** — short-term state, decays toward temperament baseline.
- **Memories** — Chronicle events this person witnessed or heard about, with emotional weight and salience that decays. Memories drive dialogue and opinion.
- **Relationships** — per pair: *Trust*, *Affection*, *Respect*, *Tension*. Changed by shared events, value conflicts and conversation.
- **Arcs** — data-driven story arcs triggered when conditions in state are met (thresholds, memories, locations). Arcs can end in change: a trait shifts, a value is replaced, someone leaves.

### Universe simulation
- **Factions** with goals, resources, territory, attitudes to each other and to the crew.
- **Regions/worlds** with stability, prosperity, law level, controlling faction.
- **Notable people** (named NPCs, rivals, contacts, legacy crews) with simplified personality models.
- Simulated at coarse granularity each campaign turn; local detail generated on visit.
- **Reputation** is per faction (standing) plus overall **Renown** (how known you are) and **Reputation tags** (e.g. *merciful*, *ruthless*, *unreliable*). Renown raises stakes: bigger jobs, bigger enemies, being recognised.

### Rivals and allies
- Emerge from the Chronicle, not from random rolls alone: the person you humiliated, the officer whose ship you stole.
- They have their own goals and act in the universe sim.

### Chronicle
- The single source of truth for "what happened": append-only, structured events.
- Feeds news, crew memory, rival creation, legacy, and LLM context.

## Presentation

Hybrid: **painted / pre-rendered environments, real-time 3D characters**, all viewed through a fixed isometric orthographic camera. This is the approach of modern isometric CRPGs that pair painted backdrops with 3D characters.

- **Why not pure 2.5D sprites (classic 90s isometric):** pre-rendered sprites look great per frame, but every outfit × weapon × animation × facing is another sprite sheet. That makes a procedural "randomise" character generator impractical.
- **Why not pure real-time 3D:** environments take far more art effort to reach the same fidelity as a painted or offline-rendered backdrop.
- **Bay (out of battle):** high-fidelity pre-rendered/painted backdrop of the ship in its bay, with depth and collision layers so 3D crew walk behind and in front of things. Clickable crew, stations and ship parts.
- **Tactical:** square grid. Handcrafted maps use pre-rendered backdrops; procedurally assembled maps use pre-rendered tile/prop pieces (or 3D tiles if that tests better).
- **Characters:** modular 3D models (body, head, hair, clothing, gear slots; morph targets; palette tints), lit and shaded to match the backdrops → procedural "randomise" generator plus hundreds of saved presets. Any facing direction, any outfit, same model in bay and battle.
- Settle the environment technique with an art test in M3 before producing content.
- **Portraits:** high-res 2D. Library of pre-rendered portraits tagged by species/age/look so the generator can pick a fitting one; player upload; optional AI-art plugin.

## Biggest risks (and mitigations)

| Risk | Mitigation |
|---|---|
| Scope is enormous | Ship a "paper campaign" first (text UI) to prove emergent stories are fun before art. Strict milestone gates. |
| LLM output breaks game state or saves | LLMs only *propose* structured actions; rules validate and apply. All state changes go through the same code path. Narration text is stored, not regenerated. |
| LLM latency/cost | Never block a turn on an LLM. Prefetch between turns; fall back to rules on timeout. Support local (OpenAI-compatible) and cloud endpoints, user-supplied keys. |
| Rules-based personalities feel flat | Invest in the memory + relationship model and a template/grammar dialogue system with many small "barks" referencing real events. |
| Procedural characters look bad | Constrain the generator with curated presets and palettes; art direction over realism. |
| Originality / IP | Hard rule in CLAUDE.md; design reviews check for borrowed tables/terms. |
