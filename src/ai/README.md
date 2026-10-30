# src/ai — optional advanced brains

Nothing in `src/core` may depend on this folder. Implementations here extend the interfaces in `src/core/brains/`.

Planned (M6). The LLM acts as an Orchestrator above the brains (see docs/ARCHITECTURE.md). Cloud fast models such as Claude Haiku are the primary target.

- `llm_client.gd` — HTTP client for any OpenAI-compatible endpoint (Ollama, llama.cpp, LM Studio) or a cloud API. User-configured URL, model, key. Hard timeouts and token budgets.
- `llm_crew_mind.gd` — in-character dialogue and appraisal grounded in the member's memories. Falls back to `RulesCrewMind`.
- `llm_universe_director.gd` — proposes world events as structured Commands. Falls back to the rules director.
- `search_tactical_brain.gd` — expectimax/MCTS over the rules battle model.

Contract (see docs/ARCHITECTURE.md, "Brains"): structured context in, schema-checked JSON out, validated by rules, never blocks a turn, generated prose is stored.
