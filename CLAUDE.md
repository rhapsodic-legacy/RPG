# CLAUDE.md

Guidance for Claude (and humans) working in this repo.

## What this is
A turn-based crew campaign game in Godot 4 (GDScript). Read `docs/VISION.md` for the design, `docs/ARCHITECTURE.md` for structure, `docs/ROADMAP.md` for what is in scope now, `docs/DECISIONS.md` for why things are the way they are.

## Hard rules
1. **Originality.** The game is inspired by a genre. Never copy rules, tables, stat blocks, terminology, setting, names or text from any existing game (including Five Parsecs from Home). Design every system from first principles. If a mechanic looks like a known game's table, redesign it.
2. **Layering.** `src/core/` must not reference `src/game/`, `src/ai/`, scenes, or Nodes. Core classes extend `RefCounted` (or nothing), never `Node`.
3. **One mutation path.** Game state changes only through Commands in `src/core/rules/`. UI, rules AI and LLM AI all submit Commands.
4. **Determinism.** In core, all randomness comes from `SimRng` streams. Never call `randi()`, `randf()`, `Time` or `OS` from core.
5. **Rules first.** Every brain interface in `src/core/brains/` must have a working rules implementation before any LLM/advanced one. LLM code lives in `src/ai/`, returns structured proposals, and must time out to rules.
6. **Chronicle.** Anything narratively meaningful that happens gets a `ChronicleEvent`.
7. **Serialisable.** Every state class has `to_dict()` and `static from_dict()`; round-trip is tested.
8. **Stay in milestone.** Check `docs/ROADMAP.md`; don't build later-milestone features unless asked.

## Commands
```bash
# First run only: build the class cache so class_name globals resolve
godot --headless --path . --import

# Run all tests headless (Godot 4.4 on PATH as `godot`)
godot --headless --path . -s tests/run_tests.gd

# Open the editor
godot --path . -e
```

## Conventions
- GDScript with static typing everywhere (`var x: int`, typed arrays, return types).
- `class_name` for every core class. File names `snake_case.gd`, classes `PascalCase`.
- Content data in `data/*.json`; code reads ids, never hardcodes content text.
- Tests: one file per subject in `tests/core/`, extending `TestCase`, methods prefixed `test_`.
- Add a `docs/DECISIONS.md` entry when making a structural choice.
- Keep comments sparse; explain *why*, not *what*.

## Definition of done for a change
- Tests added/updated and passing headless.
- No core → game/ai imports.
- Docs updated if behaviour or structure changed.
