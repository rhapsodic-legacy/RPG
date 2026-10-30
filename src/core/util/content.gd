class_name Content
extends RefCounted
## Read-only access to JSON content in data/. Loaded once and passed into systems, so tests can supply their own.

## What a trait can be about. "detail" targets are tags (e.g. confined_spaces); "any" accepts whatever it evolved from.
const TARGET_TYPES := ["faction", "person", "place", "detail", "none", "any"]
## Where traits come from. Ship-life and relationship traits are earned aboard, between missions.
const TRAIT_SOURCES := ["birth", "backstory", "world", "battle", "ship_life", "relationship"]
## Strength budget per trait weight: max total |channel value|, and max per entry.
const TRAIT_BUDGET := {"minor": {"total": 0.3, "entry": 0.15}, "major": {"total": 1.0, "entry": 0.8}}

var values: Dictionary = {}
var names: Dictionary = {}
## archetype id -> definition. See the _doc in data/trait_archetypes.json.
var trait_archetypes: Dictionary = {}
## tag id -> description. Every tag used anywhere (events, values) must be listed here.
var tags: Dictionary = {}
## event kind -> {"doc": String, "tags": Array}. The event taxonomy; Chronicle kinds must be listed here.
var event_kinds: Dictionary = {}
## dial id -> {"domain", "cap", "doc"}. The shared dials traits feed; see data/channels.json.
var channels: Dictionary = {}


static func load_default() -> Content:
	var c := Content.new()
	c.values = _strip_doc(_read_json("res://data/values.json"))
	c.names = _strip_doc(_read_json("res://data/names.json"))
	c.trait_archetypes = _strip_doc(_read_json("res://data/trait_archetypes.json"))
	c.tags = _strip_doc(_read_json("res://data/tags.json"))
	c.event_kinds = _strip_doc(_read_json("res://data/event_kinds.json"))
	c.channels = _strip_doc(_read_json("res://data/channels.json"))
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
		problems.append_array(_validate_trait_channels(archetype_id, a))
		var weight: String = a.get("weight", "")
		if not TRAIT_BUDGET.has(weight):
			problems.append("trait '%s' has unknown weight '%s'" % [archetype_id, weight])
		var sources: Array = a.get("sources", [])
		if sources.is_empty() or not sources.all(func(s: Variant) -> bool: return TRAIT_SOURCES.has(s)):
			problems.append("trait '%s' has missing or unknown sources %s" % [archetype_id, str(sources)])
	return problems


func _validate_trait_channels(archetype_id: String, a: Dictionary) -> Array[String]:
	var problems: Array[String] = []
	var total := 0.0
	var budget: Dictionary = TRAIT_BUDGET.get(a.get("weight", ""), TRAIT_BUDGET.major)
	var entries: Dictionary = a.get("channels", {})
	for key in entries:
		var parsed := parse_channel_key(key)
		if not channels.has(parsed.dial):
			problems.append("trait '%s' uses unknown dial '%s'" % [archetype_id, parsed.dial])
		var condition: String = parsed.condition
		if condition == "target" and a.get("target", "") == "none":
			problems.append("trait '%s' conditions on a target it doesn't have" % archetype_id)
		elif not condition.is_empty() and condition != "target" and not tags.has(condition):
			problems.append("trait '%s' conditions on unknown tag '%s'" % [archetype_id, condition])
		var magnitude := absf(float(entries[key]))
		total += magnitude
		if magnitude > float(budget.entry) + 0.0001:
			problems.append("trait '%s' entry '%s' exceeds its weight's per-entry budget" % [archetype_id, key])
	if total > float(budget.total) + 0.0001:
		problems.append("trait '%s' exceeds its weight's total budget (%.2f)" % [archetype_id, total])
	return problems


## "composure@confined_spaces" -> {"dial": "composure", "condition": "confined_spaces"}; "tech" -> condition "".
static func parse_channel_key(key: String) -> Dictionary:
	var at := key.find("@")
	if at < 0:
		return {"dial": key, "condition": ""}
	return {"dial": key.substr(0, at), "condition": key.substr(at + 1)}


func dial_cap(dial: String) -> float:
	return float(channels.get(dial, {}).get("cap", 1.0))


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
