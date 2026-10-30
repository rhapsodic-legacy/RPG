class_name UniverseDirector
extends RefCounted
## Decision interface: what the wider universe does each campaign turn (faction moves, world events, jobs offered).
## Returns Command dictionaries {"kind": String, "args": Dictionary}; the rules layer validates and applies them.
## Rules implementation arrives in M1.


func propose(_state: Dictionary, _chronicle: Chronicle, _rng: SimRng) -> Array[Dictionary]:
	push_error("UniverseDirector.propose not implemented")
	return []
