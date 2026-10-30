class_name OrchestratorRequest
extends RefCounted
## A question for the optional LLM orchestrator: a purpose, a compact structured context, and the
## shape the answer must take. Built by core; never contains the raw save.

const PURPOSE_BATTLE_PLAN := "battle_plan"
const PURPOSE_DIALOGUE := "dialogue"
const PURPOSE_PERSONALITY_REVIEW := "personality_review"
const PURPOSE_UNIVERSE_THREADS := "universe_threads"

var purpose: String = ""
var context: Dictionary = {}
## Id of the expected answer shape, documented in docs/ORCHESTRATION.md.
var schema: String = ""


func _init(p_purpose: String = "", p_context: Dictionary = {}, p_schema: String = "") -> void:
	purpose = p_purpose
	context = p_context
	schema = p_schema


## Same purpose + same context = same key, so answers can be cached and replayed from saves.
func key() -> String:
	return "%s:%d" % [purpose, JSON.stringify(context, "", true).hash()]


func to_dict() -> Dictionary:
	return {"purpose": purpose, "context": context.duplicate(true), "schema": schema, "key": key()}
