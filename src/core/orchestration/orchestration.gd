class_name Orchestration
extends RefCounted
## Turns an orchestrator answer into validated Commands, or falls back to rules.
## Answer shape for every purpose that changes state: {"proposals": [{"kind": ..., "args": {...}}, ...]}.

const SOURCE_STORED := "stored"
const SOURCE_ORCHESTRATOR := "orchestrator"
const SOURCE_RULES := "rules"


## fallback: Callable returning Array of Commands from the rules brain.
## Returns {"source": String, "commands": Array[Command], "rejected": Array[String]}. Commands are validated, not applied.
static func decide(state: GameState, ctx: CampaignContext, request: OrchestratorRequest, fallback: Callable) -> Dictionary:
	var key := request.key()
	var source := SOURCE_STORED
	var answer: Variant = state.orchestrator_results.get(key)
	if answer == null:
		answer = ctx.orchestrator.collect(key)
		source = SOURCE_ORCHESTRATOR
		if answer is Dictionary:
			state.orchestrator_results[key] = answer
	var commands: Array[Command] = []
	var rejected: Array[String] = []
	if answer is Dictionary:
		for proposal in answer.get("proposals", []):
			var cmd := CommandRegistry.from_dict(proposal)
			var reason: String = "unknown command" if cmd == null else cmd.validate(state, ctx)
			if reason.is_empty():
				commands.append(cmd)
			else:
				rejected.append("%s: %s" % [str(proposal), reason])
	if commands.is_empty():
		commands.assign(fallback.call())
		source = SOURCE_RULES
	return {"source": source, "commands": commands, "rejected": rejected}
