class_name ChangeCreditsCommand
extends Command

const KIND := "change_credits"

var amount: int = 0
var reason: String = ""


func _init(p_amount: int = 0, p_reason: String = "") -> void:
	kind = KIND
	amount = p_amount
	reason = p_reason


func validate(state: GameState) -> String:
	if amount == 0:
		return "no change"
	if state.credits + amount < 0:
		return "insufficient credits"
	return ""


func apply(state: GameState) -> void:
	state.credits += amount
	state.chronicle.record(state.turn, "credits_changed", [], "", ["money"], {"amount": amount, "reason": reason})


func get_args() -> Dictionary:
	return {"amount": amount, "reason": reason}


func load_args(args: Dictionary) -> void:
	amount = int(args.get("amount", 0))
	reason = String(args.get("reason", ""))
