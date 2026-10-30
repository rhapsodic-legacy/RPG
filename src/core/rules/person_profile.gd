class_name PersonProfile
extends RefCounted
## A person described in two layers: short general statements on top, granular specifics underneath,
## plus the only directions each trait may grow in. Used by dialogue templates, debug UI, and as the
## orchestrator's context so an LLM stays true to who someone is.


static func describe(person: Person, state: GameState, content: Content) -> Dictionary:
	var name_of := func(id: String) -> String: return state.name_of(id)
	var traits_out := []
	for t in person.traits:
		var origin := state.chronicle.get_event(t.origin_event_id)
		traits_out.append({
			"id": t.id,
			"kind": content.archetype(t.archetype).get("kind", ""),
			"general": TraitRules.general_text(t, content),
			"specific": TraitRules.specific_text(t, content, name_of),
			"intensity": snappedf(t.intensity, 0.01),
			"since_turn": t.since_turn,
			"origin": "backstory" if origin == null else origin.kind,
			"history": t.lineage.map(func(a: String) -> String: return content.archetype(a).get("general", a)),
			"notes": Array(t.notes),
			"may_become": TraitRules.allowed_targets(content, t.archetype),
		})
	var temperament := {}
	for axis in Temperament.AXES:
		temperament[axis] = snappedf(person.temperament.get_axis(axis), 0.01)
	return {
		"id": person.id,
		"name": person.display_name(),
		"role": person.role,
		"summary": summary_line(person, state, content),
		"values": Array(person.values),
		"temperament": temperament,
		"mood": snappedf(person.mood, 0.01),
		"traits": traits_out,
	}


## One sentence, general layer only: "Ilse Varrow values loyalty and justice; fears a powerful group; owes a dangerous debt."
static func summary_line(person: Person, _state: GameState, content: Content) -> String:
	var parts: Array[String] = []
	if not person.values.is_empty():
		parts.append("values " + " and ".join(PackedStringArray(person.values)))
	for t in person.traits:
		parts.append(TraitRules.general_text(t, content))
	return "%s %s." % [person.display_name(), "; ".join(PackedStringArray(parts))]
