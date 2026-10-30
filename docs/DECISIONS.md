# Decision Log

Short records of decisions that shape the codebase. Newest last. Add one when you make a choice someone might later question.

## D1 — Godot 4 + GDScript (2026-10-30)
Free/MIT, good 2D+3D, headless CI, desktop+mobile export. C# considered; GDScript chosen for faster iteration, no .NET export caveats, and lower barrier for modders. Hot paths (tactical search) may move to a GDExtension later if profiling demands it.

## D2 — Painted/pre-rendered environments + 3D characters (2026-10-30, revised)
Classic pre-rendered 2.5D gives high fidelity cheaply, but sprite characters multiply sheets per outfit/animation/facing and rule out a procedural generator. So environments are pre-rendered/painted (fidelity) and characters are modular 3D (procedural, any facing), under one isometric ortho camera. Confirm with an art test in M3.

## D3 — Pure simulation core, Commands as the only mutation path (2026-10-30)
Core has no Node dependencies, is deterministic from a seed, and is tested headless. UI, rules AI and LLM AI all submit Commands validated by the same rules.

## D4 — Chronicle as the source of truth for narrative (2026-10-30)
All meaningful happenings are structured events. Memory, news, rivals, legacy and LLM context all read from it.

## D5 — Rules first, LLM optional, never blocking (2026-10-30)
Every brain has a rules implementation. LLM brains propose structured actions, are validated, time out to rules, and their prose is stored for stable reloads.

## D6 — Text-only "paper campaign" before art (2026-10-30)
The biggest risk is whether emergent stories are fun. Prove it cheaply first.

## D7 — LLM as Orchestrator, cloud fast models first (2026-10-30)
The LLM sets intent and plans (battle plans, dialogue, personality drift, universe threads) rather than taking per-move actions. Primary target is cheap, fast cloud models (e.g. Claude Haiku); local OpenAI-compatible endpoints are supported too. Rules fallback on timeout stays mandatory.

## D8 — Name: Beyond the Edge (2026-10-30)
Replaces the working title "Outer Rim" (a Star Wars term). The Edge is the visible rim of the galaxy; the game happens in the systems beyond it.

## D9 — Full width, shallow depth (2026-10-30)
Every structural piece (people, state, commands, saves, phases, taxonomy, orchestration) exists and is wired end to end before gameplay depth. Later milestones add content and rule detail into existing slots instead of redesigning. Jesse's explicit priority: correct scaffolding over a quick MVP.

## D10 — One Person model for everyone (2026-10-30)
Crew, NPCs, rivals and legends share `Person`, distinguished by `role`/`status`. Legends are copies keyed by `origin_campaign/person_id`, so the legacy system needs no conversion code.
