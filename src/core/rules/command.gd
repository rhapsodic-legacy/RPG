class_name Command
extends RefCounted
## A request to change game state. UI, rules AI and the LLM orchestrator all express intent as Commands;
## Rules.submit validates and applies them. Subclasses register in CommandRegistry.

var kind: String = ""


## Empty string when allowed, otherwise a short reason it was rejected.
func validate(_state: GameState) -> String:
	return ""


## Only called after validate() passed. Record a ChronicleEvent for anything narratively meaningful.
func apply(_state: GameState) -> void:
	pass


func get_args() -> Dictionary:
	return {}


## Inverse of get_args(). Input may come from JSON (an LLM or a save), so coerce types.
func load_args(_args: Dictionary) -> void:
	pass


func to_dict() -> Dictionary:
	return {"kind": kind, "args": get_args()}
