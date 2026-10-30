class_name CommandRegistry
extends RefCounted
## Builds Commands from {"kind", "args"} dictionaries (LLM proposals, replays). Register every Command here.

const KINDS := {
	"hire": preload("res://src/core/rules/commands/hire_command.gd"),
	"change_credits": preload("res://src/core/rules/commands/change_credits_command.gd"),
	"evolve_trait": preload("res://src/core/rules/commands/evolve_trait_command.gd"),
	"annotate_trait": preload("res://src/core/rules/commands/annotate_trait_command.gd"),
}


## Null for unknown kinds or malformed input; callers treat that as a rejected proposal.
static func from_dict(d: Variant) -> Command:
	if not d is Dictionary:
		return null
	var script: Variant = KINDS.get(String(d.get("kind", "")))
	if script == null:
		return null
	var cmd: Command = script.new()
	var args: Variant = d.get("args", {})
	cmd.load_args(args if args is Dictionary else {})
	return cmd
