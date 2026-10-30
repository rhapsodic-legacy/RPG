class_name HireCommand
extends Command

const KIND := "hire"

var person_id: String = ""
var fee: int = 0


func _init(p_person_id: String = "", p_fee: int = 0) -> void:
	kind = KIND
	person_id = p_person_id
	fee = p_fee


func validate(state: GameState, _ctx: CampaignContext) -> String:
	var person := state.get_person(person_id)
	if person == null:
		return "unknown person"
	if state.crew_ids.has(person_id):
		return "already crew"
	if person.status != Person.STATUS_ACTIVE:
		return "not available"
	if fee < 0:
		return "negative fee"
	if fee > state.credits:
		return "cannot afford"
	return ""


func apply(state: GameState, _ctx: CampaignContext) -> void:
	state.credits -= fee
	state.crew_ids.append(person_id)
	state.get_person(person_id).role = Person.ROLE_CREW
	state.chronicle.record(state.turn, "crew_joined", [person_id], "", ["recruitment"], {"fee": fee})


func get_args() -> Dictionary:
	return {"person_id": person_id, "fee": fee}


func load_args(args: Dictionary) -> void:
	person_id = String(args.get("person_id", ""))
	fee = int(args.get("fee", 0))
