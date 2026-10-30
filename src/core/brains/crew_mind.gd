class_name CrewMind
extends RefCounted
## Decision interface: how a person feels about and reacts to what happens.
## RulesCrewMind is the always-available implementation; LLM-backed minds live in src/ai/ and fall back to it.


## Emotional weight of an event for this person, -1 (hated it) .. +1 (loved it).
func appraise(_member: CrewMember, _event: ChronicleEvent) -> float:
	push_error("CrewMind.appraise not implemented")
	return 0.0


## Relationship deltas toward another person who caused/shared the event. Keys as in Relationship.apply().
func relationship_shift(_member: CrewMember, _other_id: String, _event: ChronicleEvent) -> Dictionary:
	push_error("CrewMind.relationship_shift not implemented")
	return {}
