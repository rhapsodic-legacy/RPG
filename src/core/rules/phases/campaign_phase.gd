class_name CampaignPhase
extends RefCounted
## One step of a campaign turn. Automatic work happens in enter(); interactive phases then wait for
## player/AI Commands until is_done() is true. Rules-layer code, so it may change state directly.


func id() -> String:
	return ""


func enter(_state: GameState, _ctx: CampaignContext) -> void:
	pass


func is_done(_state: GameState) -> bool:
	return true
