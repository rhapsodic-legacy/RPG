class_name TacticalBrain
extends RefCounted
## Decision interface: chooses one unit's next action in battle.
## Tiers: rules utility AI (default) -> search-based (expectimax/MCTS, strong hardware) -> LLM for commander intent only.
## Rules implementation arrives in M2.


func choose_action(_unit_id: String, _battle: Dictionary, _rng: SimRng) -> Dictionary:
	push_error("TacticalBrain.choose_action not implemented")
	return {}
