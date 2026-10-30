class_name Content
extends RefCounted
## Read-only access to JSON content in data/. Loaded once and passed into systems, so tests can supply their own.

## What a trait can be about. "detail" targets are tags (e.g. confined_spaces); "any" accepts whatever it evolved from.
const TARGET_TYPES := ["faction", "person", "place", "detail", "none", "any"]
## Generic effect channels traits can feed. Systems read these; traits never carry bespoke perk logic.
## Plus "appraisal_tag:<tag>" for how events with that tag feel.
const CHANNELS := ["appraisal_when_referenced", "morale_when_present", "aggression_when_present"]

var values: Dictionary = {}
var names: Dictionary = {}
## archetype id -> definition. See the _doc in data/trait_archetypes.json.
var trait_archetypes: Dictionary = {}
## tag id -> description. Every tag used anywhere (events, values) must be listed here.
var tags: Dictionary = {}
## event kind -> {"doc": String, "tags": Array}. The event taxonomy; Chronicle kinds must be listed here.
var event_kinds: Dictionary = {}


static func load_default() -> Content:
	var c := Content.new()
	c.values = _strip_doc(_read_json("res://data/values.json"))
	c.names = _strip_doc(_read_json("res://data/names.json"))
	c.trait_archetypes = _strip_doc(_read_json("res://data/trait_archetypes.json"))
	c.tags = _strip_doc(_read_json("res://data/tags.json"))
	c.event_kinds = _strip_doc(_read_json("res://data/event_kinds.json"))
	return c


## Cross-file integrity problems, empty when content is consistent. Run by tests and at startup in debug builds.
func validate() -> Array[String]:
	var problems: Array[String] = []
	for value_id in values:
		for tag in values[value_id]:
			if not tags.has(tag):
				problems.append("values.json: '%s' uses unknown tag '%s'" % [value_id, tag])
	for kind in event_kinds:
		for tag in event_kinds[kind].get("tags", []):
			if not tags.has(tag):
				problems.append("event_kinds.json: '%s' uses unknown tag '%s'" % [kind, tag])
	for archetype_id in trait_archetypes:
		var a: Dictionary = trait_archetypes[archetype_id]
		if not TARGET_TYPES.has(a.get("target", "")):
			problems.append("trait '%s' has unknown target type '%s'" % [archetype_id, a.get("target", "")])
		for option in a.get("options", []):
			if not tags.has(option):
				problems.append("trait '%s' option '%s' is not a known tag" % [archetype_id, option])
		for edge in a.get("evolves", []):
			var to: String = edge.get("to", "")
			if not trait_archetypes.has(to):
				problems.append("trait '%s' evolves to unknown '%s'" % [archetype_id, to])
			elif not _targets_compatible(a.get("target", ""), trait_archetypes[to].get("target", "")):
				problems.append("trait '%s' -> '%s' changes target type" % [archetype_id, to])
			for tag in edge.get("when", {}).get("tags_any", []):
				if not tags.has(tag):
					problems.append("trait '%s' edge uses unknown tag '%s'" % [archetype_id, tag])
		for channel in a.get("channels", {}):
			if not (CHANNELS.has(channel) or (channel.begins_with("appraisal_tag:") and tags.has(channel.trim_prefix("appraisal_tag:")))):
				problems.append("trait '%s' has unknown channel '%s'" % [archetype_id, channel])
	return problems


func archetype(archetype_id: String) -> Dictionary:
	return trait_archetypes.get(archetype_id, {})


func archetypes_of_kind(kind: String) -> Array[String]:
	var out: Array[String] = []
	for archetype_id in trait_archetypes:
		if trait_archetypes[archetype_id].get("kind", "") == kind:
			out.append(archetype_id)
	return out


static func _targets_compatible(from_type: String, to_type: String) -> bool:
	return from_type == to_type or to_type == "any"


func is_known_event(kind: String) -> bool:
	return event_kinds.has(kind)


static func _read_json(path: String) -> Dictionary:
	var text := FileAccess.get_file_as_string(path)
	var parsed: Variant = JSON.parse_string(text)
	assert(parsed is Dictionary, "Content file is not a JSON object: " + path)
	return parsed


static func _strip_doc(d: Dictionary) -> Dictionary:
	d.erase("_doc")
	return d
