class_name Rules
extends RefCounted
## The single entry point for state changes from outside the rules layer.


## Empty string on success, otherwise the rejection reason. Nothing is changed when rejected.
static func submit(state: GameState, cmd: Command) -> String:
	if cmd == null:
		return "unknown command"
	var reason := cmd.validate(state)
	if reason.is_empty():
		cmd.apply(state)
	return reason
