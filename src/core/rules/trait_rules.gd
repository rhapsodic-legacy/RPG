class_name TraitRules
extends RefCounted
## How traits read and change. Effects go through generic channels; change goes through authored edges.

## How much intensity rises when an event touches a trait's target, scaled by how strongly it was felt.
const INTENSITY_GAIN := 0.25


## A dial's total for this person in a situation, soft-capped: cap * tanh(sum / cap).
## Many small traits add up, but no stack runs away, and no single trait decides the outcome.
## situation: entity ids and tags present (a mission map, a conversation, a bay event).
static func channel(person: Person, dial: String, content: Content, situation: Array = []) -> float:
	var raw := raw_channel(person, dial, content, func(id: String) -> bool: return situation.has(id))
	var cap := content.dial_cap(dial)
	return cap * tanh(raw / cap)


## Uncapped sum. is_present: Callable(id_or_tag) -> bool decides conditional entries.
static func raw_channel(person: Person, dial: String, content: Content, is_present: Callable) -> float:
	var total := 0.0
	for t in person.traits:
		var entries: Dictionary = content.archetype(t.archetype).get("channels", {})
		for key in entries:
			var parsed := Content.parse_channel_key(key)
			if parsed.dial != dial:
				continue
			var condition: String = parsed.condition
			if condition == "target":
				condition = t.target
				if condition.is_empty():
					continue
			if not condition.is_empty() and not is_present.call(condition):
				continue
			total += float(entries[key]) * t.intensity
	return total


## How the person's traits colour an event. Conditions match what the event references. Caller clamps.
static func appraise(person: Person, event: ChronicleEvent, content: Content) -> float:
	return raw_channel(person, "appraisal", content, event.references)


## Sum of a dial across a group, e.g. crew_morale aboard the ship, soft-capped once for the group.
static func group_channel(people: Array, dial: String, content: Content, situation: Array = []) -> float:
	var raw := 0.0
	for p in people:
		raw += raw_channel(p, dial, content, func(id: String) -> bool: return situation.has(id))
	var cap := content.dial_cap(dial)
	return cap * tanh(raw / cap)


## Rules-layer reaction: events that touch a trait's target make it felt more strongly.
static func intensify(person: Person, event: ChronicleEvent, feeling: float) -> void:
	for t in person.traits:
		if event.references(t.target):
			t.intensity = clampf(t.intensity + absf(feeling) * INTENSITY_GAIN, 0.0, 1.0)


## Edges whose conditions this event satisfies, as Commands for Rules.submit. Rules never pick randomly
## between valid edges: the first authored edge wins, so the same history gives the same person.
static func propose_evolutions(person: Person, event: ChronicleEvent, content: Content) -> Array[Command]:
	var out: Array[Command] = []
	for t in person.traits:
		for edge in content.archetype(t.archetype).get("evolves", []):
			if _edge_matches(t, edge.get("when", {}), event):
				out.append(EvolveTraitCommand.new(person.id, t.id, String(edge.get("to", "")), event.id))
				break
	return out


static func allowed_targets(content: Content, archetype_id: String) -> Array[String]:
	var out: Array[String] = []
	for edge in content.archetype(archetype_id).get("evolves", []):
		out.append(String(edge.get("to", "")))
	return out


static func _edge_matches(t: PersonTrait, when: Dictionary, event: ChronicleEvent) -> bool:
	if when.get("references_target", false) and not event.references(t.target):
		return false
	if t.intensity < float(when.get("min_intensity", 0.0)):
		return false
	var tags_any: Array = when.get("tags_any", [])
	if not tags_any.is_empty() and not tags_any.any(func(tag: Variant) -> bool: return event.has_tag(String(tag))):
		return false
	return true


## Renders "fears {target}" with a display name. name_of: Callable(id) -> String.
static func specific_text(t: PersonTrait, content: Content, name_of: Callable) -> String:
	var template: String = content.archetype(t.archetype).get("specific", t.archetype)
	if t.target.is_empty():
		return template
	return template.replace("{target}", String(name_of.call(t.target)))


static func general_text(t: PersonTrait, content: Content) -> String:
	return String(content.archetype(t.archetype).get("general", t.archetype))
