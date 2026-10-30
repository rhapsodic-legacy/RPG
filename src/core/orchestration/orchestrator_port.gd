class_name OrchestratorPort
extends RefCounted
## Core's only view of the LLM orchestrator. Core submits requests ahead of time and collects answers
## later; it never waits. This base class is the "no LLM" port: it never answers, so rules decide.
## Real implementations live in src/ai/ and do their network work asynchronously.


func is_available() -> bool:
	return false


## Fire and forget. Implementations should dedupe by request.key().
func submit(_request: OrchestratorRequest) -> void:
	pass


## The parsed JSON answer if it has arrived, otherwise null. Never blocks.
func collect(_request_key: String) -> Variant:
	return null
