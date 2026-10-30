# Roadmap

Each milestone ends with a playable or testable gate. Do not start the next milestone's art until the current gate passes.

## M0 — Foundation (this commit)
- Docs: vision, architecture, roadmap, decisions, CLAUDE.md
- Godot project skeleton, layered folders, headless test runner, CI
- Core primitives: `SimRng`, `Chronicle`, `Person` + `Temperament`, `Relationship`, brain interfaces with rules stubs
- Full-width foundation: unified `Person`, `GameState`/`ProfileState`, Command pipeline + registry, versioned saves, turn phase machine, tag/event taxonomy, orchestration contract with test double
- **Gate:** `godot --headless -s tests/run_tests.gd` passes in CI.

## M1 — Paper Campaign (text-only)
Prove that emergent stories are interesting before any art.
- Campaign turn loop in core: news → bay → job choice → abstract mission resolution → aftermath → travel
- Crew generation (temperament, values, wants/fears, backstory hooks)
- Memory + relationship updates from Chronicle events; mood
- Factions, regions, renown and per-faction standing; universe tick
- Rules `UniverseDirector` generating jobs from faction goals
- Template "bark" dialogue referencing real memories
- Save/load campaign
- Minimal Godot UI: text panels and buttons
- **Gate:** a 20-turn rules-only campaign produces at least three stories a playtester can retell.

## M2 — Tactical Prototype (grey-box)
- Square grid, isometric ortho camera, placeholder capsules
- AP-based movement/actions, cover, LOS, elevation, morale
- Rules `TacticalBrain` (utility AI)
- Non-combat exits: retreat, parley hook
- Mission result feeds back into the campaign Chronicle
- **Gate:** five mission templates feel tactically distinct.

## M3 — Vertical Slice
- Bay scene (2.5D) with clickable crew and stations
- Modular character v1 + "randomise" generator + 20 presets
- Portrait library v1 (tag matching) + player upload
- Dialogue-driven mission with combat and non-combat solutions
- Crew personal arc (one full arc end-to-end)
- **Gate:** 30-minute session that shows every pillar once.

## M4 — Living Universe
- Rivals and allies emerging from Chronicle
- Faction conflicts that change regions over time; news feed
- Reputation tags and renown effects on jobs/encounters
- More arcs, relationship events (friendship, romance, feuds, departures)

## M5 — Legacy and Outpost
- Main Objectives, campaign end, continue/retire
- Legacy Registry: retired crews appear in later campaigns
- Inheritances
- Outpost (moon base) hub with facilities and memorial wall

## M6 — Advanced Brains (optional layer)
- LLM client (OpenAI-compatible, local or cloud), settings UI, budgets
- LLM `CrewMind` dialogue grounded in memories; LLM `UniverseDirector` proposals
- Search-based `TacticalBrain` (expectimax/MCTS) with difficulty scaling
- AI-art portrait source (plugin)

## M7 — Content, Polish, Ship
- Content breadth, balance, accessibility, localisation-ready strings
- Steam (desktop) first; evaluate mobile/tablet after
