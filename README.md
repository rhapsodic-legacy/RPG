# Outer Rim (working title)

A turn-based crew campaign game where the universe remembers you. Random crew, battered ship, jobs, rivals, and crews who are people rather than job slots. Retired crews become part of the world later crews explore.

Built with Godot 4.4 (GDScript).

- Design: [docs/VISION.md](docs/VISION.md)
- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Roadmap: [docs/ROADMAP.md](docs/ROADMAP.md)
- Decisions: [docs/DECISIONS.md](docs/DECISIONS.md)
- Working on the code (humans and Claude): [CLAUDE.md](CLAUDE.md)

## Quick start
```bash
godot --headless --path . --import          # first run only: builds the class cache
godot --headless --path . -s tests/run_tests.gd
godot --path .                              # run the M0 placeholder scene
```
