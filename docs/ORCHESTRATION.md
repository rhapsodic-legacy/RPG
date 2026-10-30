# Orchestration contract

How the optional LLM orchestrator talks to the game. Code: `src/core/orchestration/`.

## Flow
1. Core builds an `OrchestratorRequest(purpose, context, schema)`. Context is a compact structured slice (people involved, relevant Chronicle events, faction standings), never the raw save.
2. Core **submits ahead**: when entering a phase, during travel, while the player is in the bay. `OrchestratorPort.submit()` returns immediately.
3. When the decision is due, `Orchestration.decide(state, port, request, rules_fallback)`:
   - uses an answer already stored in the save for that request key (stable reloads), else
   - collects the answer if it has arrived (never waits), and stores it, else
   - calls the rules fallback.
4. Every proposal becomes a Command through `CommandRegistry` and is validated by the same rules a player action uses. Invalid ones are dropped and reported in `rejected`. If none survive, rules decide.

## Purposes and answer schemas

All state-changing purposes answer with:
```json
{"proposals": [{"kind": "<command kind>", "args": {}, "why": "optional, for logs"}]}
```

| Purpose | Asked when | Typical proposals |
|---|---|---|
| `universe_threads` | Start of turn / during travel | Faction moves, world events, jobs that tie threads together |
| `personality_review` | Every few turns per person | Small temperament shifts, new wants, arc triggers (size-capped by rules) |
| `battle_plan` | Before battle and between rounds | Side-level intent (targets, positions, retreat condition) that the TacticalBrain executes move by move |
| `dialogue` | Entering a conversation | Lines and branches (text is stored in state; branch effects are Commands) |

Schema ids (e.g. `proposals_v1`) are versioned so prompts and parsers can evolve without breaking old saves.

## Provider
The real port (`src/ai/`, M6) calls a fast cloud model (e.g. Claude Haiku) or any OpenAI-compatible local endpoint, with per-request timeouts and a per-session token budget. Tests use `tests/fakes/scripted_orchestrator.gd`.
