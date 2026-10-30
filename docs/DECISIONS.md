# Decision Log

Short records of decisions that shape the codebase. Newest last. Add one when you make a choice someone might later question.

## D1 — Godot 4 + GDScript (2026-10-30)
Free/MIT, good 2D+3D, headless CI, desktop+mobile export. C# considered; GDScript chosen for faster iteration, no .NET export caveats, and lower barrier for modders. Hot paths (tactical search) may move to a GDExtension later if profiling demands it.

## D2 — 3D with orthographic camera for "2.5D" (2026-10-30)
Modular 3D characters make the procedural generator and 8-direction facing tractable, and bay + battle share one pipeline. Pre-rendered 2D sprites rejected: every new outfit would multiply sprite sheets.

## D3 — Pure simulation core, Commands as the only mutation path (2026-10-30)
Core has no Node dependencies, is deterministic from a seed, and is tested headless. UI, rules AI and LLM AI all submit Commands validated by the same rules.

## D4 — Chronicle as the source of truth for narrative (2026-10-30)
All meaningful happenings are structured events. Memory, news, rivals, legacy and LLM context all read from it.

## D5 — Rules first, LLM optional, never blocking (2026-10-30)
Every brain has a rules implementation. LLM brains propose structured actions, are validated, time out to rules, and their prose is stored for stable reloads.

## D6 — Text-only "paper campaign" before art (2026-10-30)
The biggest risk is whether emergent stories are fun. Prove it cheaply first.
