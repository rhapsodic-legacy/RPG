class_name EvolveTraitCommand
extends Command
## Changes a trait's archetype along an authored edge. The target is kept, so the change stays in character.
## Used by TraitRules and by the orchestrator (personality_review); both are held to the same edges.

const KIND := "evolve_trait"

var person_id: String = ""
var trait_id: String = ""
var to_archetype: String = ""
var cause_event_id: int = 0


func _init(p_person_id: String = "", p_trait_id: String = "", p_to: String = "", p_cause: int = 0) -> void:
	kind = KIND
	person_id = p_person_id
	trait_id = p_trait_id
	to_archetype = p_to
	cause_event_id = p_cause


func validate(state: GameState, ctx: CampaignContext) -> String:
	if ctx == null:
		return "needs content"
	var person := state.get_person(person_id)
	if person == null:
		return "unknown person"
	var t := person.get_trait(trait_id)
	if t == null:
		return "unknown trait"
	if not TraitRules.allowed_targets(ctx.content, t.archetype).has(to_archetype):
		return "not an allowed evolution"
	if cause_event_id != 0 and state.chronicle.get_event(cause_event_id) == null:
		return "unknown cause event"
	return ""


func apply(state: GameState, _ctx: CampaignContext) -> void:
	var t := state.get_person(person_id).get_trait(trait_id)
	var from := t.archetype
	t.lineage.append(from)
	t.archetype = to_archetype
	t.since_turn = state.turn
	state.chronicle.record(state.turn, "trait_evolved", [person_id], "", ["trait"],
		{"trait_id": trait_id, "from": from, "to": to_archetype, "cause_event_id": cause_event_id})


func get_args() -> Dictionary:
	return {"person_id": person_id, "trait_id": trait_id, "to": to_archetype, "cause_event_id": cause_event_id}


func load_args(args: Dictionary) -> void:
	person_id = String(args.get("person_id", ""))
	trait_id = String(args.get("trait_id", ""))
	to_archetype = String(args.get("to", ""))
	cause_event_id = int(args.get("cause_event_id", 0))
