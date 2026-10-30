class_name AnnotateTraitCommand
extends Command
## Adds a short specific detail to a trait ("won't take jobs on Corvan Station"). This is how an LLM
## deepens a character without changing who they are; the archetype and target stay fixed.

const KIND := "annotate_trait"
const MAX_NOTE_LENGTH := 160
const MAX_NOTES := 8

var person_id: String = ""
var trait_id: String = ""
var note: String = ""


func _init(p_person_id: String = "", p_trait_id: String = "", p_note: String = "") -> void:
	kind = KIND
	person_id = p_person_id
	trait_id = p_trait_id
	note = p_note


func validate(state: GameState, _ctx: CampaignContext) -> String:
	var person := state.get_person(person_id)
	if person == null:
		return "unknown person"
	var t := person.get_trait(trait_id)
	if t == null:
		return "unknown trait"
	if note.strip_edges().is_empty():
		return "empty note"
	if note.length() > MAX_NOTE_LENGTH:
		return "note too long"
	if t.notes.size() >= MAX_NOTES:
		return "too many notes"
	return ""


func apply(state: GameState, _ctx: CampaignContext) -> void:
	state.get_person(person_id).get_trait(trait_id).notes.append(note.strip_edges())
	state.chronicle.record(state.turn, "trait_annotated", [person_id], "", ["trait"], {"trait_id": trait_id})


func get_args() -> Dictionary:
	return {"person_id": person_id, "trait_id": trait_id, "note": note}


func load_args(args: Dictionary) -> void:
	person_id = String(args.get("person_id", ""))
	trait_id = String(args.get("trait_id", ""))
	note = String(args.get("note", ""))
