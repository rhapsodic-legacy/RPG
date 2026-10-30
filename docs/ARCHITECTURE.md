# Architecture

## Stack

| Concern | Choice | Why |
|---|---|---|
| Engine | **Godot 4.4** (GDScript) | Free, MIT, no royalties; great 2D/3D mix; strong UI; exports to Windows/macOS/Linux and mobile; headless mode for tests and CI. |
| Rendering style | 3D scenes, orthographic camera | One pipeline for bay and battle; procedural modular characters; 8+ facings for free. |
| Simulation core | Pure GDScript classes (`RefCounted`), no scene/Node dependencies | Deterministic, unit-testable headless, serialisable. |
| Content | JSON in `data/` | Moddable, diff-able, editable without code. |
| Saves | JSON (versioned) | Human-readable, migratable. Profile save (legacy, outpost) separate from campaign saves. |
| Tests | Built-in minimal runner (`tests/run_tests.gd`) | Zero dependencies; runs in CI with `godot --headless`. |
| LLM | HTTP to any OpenAI-compatible endpoint (Ollama, llama.cpp, LM Studio) or a cloud API, user-configured | Local-first for privacy/cost; optional. |

Engine alternatives considered: Unity (licensing churn, heavier), Unreal (overkill for ortho 2.5D), Bevy (immature tooling/UI), web stack (weak for 3D-ish tactical + desktop distribution). Revisit only if a hard blocker appears.

## Layers

```
┌────────────────────────────────────────────────────────┐
│  src/game/      Presentation (scenes, UI, camera, VFX) │  reads state, sends Commands
├────────────────────────────────────────────────────────┤
│  src/core/      Simulation (pure data + rules)         │  no Node, no rendering, deterministic
│    state/       GameState, Crew, Universe, Chronicle   │
│    rules/       Command validation + application       │
│    brains/      Decision interfaces (+ rules impls)    │
├────────────────────────────────────────────────────────┤
│  src/ai/        Optional advanced brains (LLM, search) │  plug into core/brains interfaces
└────────────────────────────────────────────────────────┘
```

Rules:
- `src/core` never imports from `src/game` or `src/ai`.
- Presentation never mutates state directly; it submits **Commands**. Brains (AI or LLM) also submit Commands. One path for every change.
- All randomness comes from `SimRng` streams seeded from the campaign seed. No `randi()` in core.

## The Chronicle

Append-only list of `ChronicleEvent { id, turn, kind, actors[], place, tags[], data{} }`.

Everything that "happened" is written here by the rules layer. Consumers:
- Crew memory (who witnessed what, emotional weight)
- Universe sim (faction reactions)
- News feed and dialogue templates
- Rival / ally emergence
- Legacy export when a crew retires
- Context for LLM prompts (retrieval by actor/tag/recency)

## Brains: the pluggable decision layer

Every place the game needs a judgement is behind an interface in `src/core/brains/`. Each has a rules implementation that is always available. Advanced implementations wrap or replace it.

| Brain | Decides | Rules impl | Advanced options |
|---|---|---|---|
| `UniverseDirector` | Faction moves, world events, job generation, pacing | Weighted utility over faction goals | LLM "story director" proposing events from Chronicle |
| `CrewMind` | Reactions, opinions, dialogue lines, arc triggers | Trait/value scoring + template barks | LLM dialogue in-character, grounded in memories |
| `TacticalBrain` | Enemy (and optionally ally) unit actions | Utility AI with considerations (cover, threat, objective) | Heuristic search (expectimax/MCTS) for strong hardware; LLM for *commander intent* only, never per-move |

### Contract for any LLM-backed brain
1. Input: a compact, structured **context packet** built by core (state slice + relevant Chronicle events). No raw save dumps.
2. Output: JSON matching a schema for that brain (e.g. `{"proposals":[{"command":"faction_attack","args":{...},"why":"..."}]}`).
3. Core **validates** each proposal with the same rules a player command uses. Invalid → dropped.
4. **Timeout/fallback**: if no valid answer in budget, use the rules brain's answer. The game never waits on the network to advance a turn.
5. Generated prose is **stored** in the Chronicle/state so reloading a save is stable.
6. Requests run between turns where possible (prefetch), cached by context hash.

### Determinism note
Rules-only campaigns are fully deterministic from a seed (good for tests and bug reports). LLM campaigns are deterministic *on replay of stored results*, not on regeneration.

## Saves

- `user://profile.json` — legacy registry, outpost, unlocks, settings. Shared across campaigns.
- `user://campaigns/<id>.json` — one campaign: state, chronicle, RNG stream positions, schema version.
- Every save has `schema_version`; migrations live in `src/core/save/migrations/`.

## Characters and art pipeline (planned)

- Modular rig: base body (several builds) + head + hair + outfit + gear sockets. Morph targets for face/body shape; palette textures for skin/hair/cloth.
- `CharacterAppearance` is pure data (part ids, morph values, palette ids). The generator in core produces it from RNG + constraints (species, age, role, culture); presentation builds the model.
- Portrait selection matches tags from the appearance; uploads and AI-art are alternative `PortraitSource`s.

## Directory map

```
src/core/state/      data classes (crew, universe, chronicle, game state)
src/core/rules/      commands, validation, campaign turn steps
src/core/brains/     brain interfaces + rules implementations
src/core/util/       SimRng and helpers
src/ai/              optional LLM client + LLM brains
src/game/            Godot scenes and UI
data/                JSON content (traits, values, factions, names, jobs)
tests/               headless test runner + test suites
docs/                vision, architecture, roadmap, decisions
```
