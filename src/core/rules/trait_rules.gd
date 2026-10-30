class_name TraitRules
extends RefCounted
## How traits read and change. Effects go through generic channels; change goes through authored edges.

## How much intensity rises when an event touches a trait's target, scaled by how strongly it was felt.
const INTENSITY_GAIN := 0.25


## Sum of a channel across the person's traits, each scaled by intensity.
## present_ids: entity ids/tags present in the situation (for *_when_present channels).
static func channel(person: Person, channel_id: String, content: Content, present_ids: Array = []) -> float:
	var total := 0.0
	for t in person.traits:
		var channels: Dictionary = content.archetype(t.archetype).get("channels", {})
		if not channels.has(channel_id):
			continue
		if channel_id.ends_with("_when_present") and not present_ids.has(t.target):
			continue
		total += float(channels[channel_id]) * t.intensity
	return total


## How the person's traits colour an event, -1..1 before clamping by the caller.
static func appraise(person: Person, event: ChronicleEvent, content: Content) -> float:
	var total := 0.0
	for t in person.traits:
		var channels: Dictionary = content.archetype(t.archetype).get("channels", {})
		if event.references(t.target):
			total += float(channels.get("appraisal_when_referenced", 0.0)) * t.intensity
		for tag in event.tags:
			total += float(channels.get("appraisal_tag:" + tag, 0.0)) * t.intensity
	return total


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
