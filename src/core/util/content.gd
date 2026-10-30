class_name Content
extends RefCounted
## Read-only access to JSON content in data/. Loaded once and passed into systems, so tests can supply their own.

var values: Dictionary = {}
var names: Dictionary = {}
var wants_fears: Dictionary = {}
## tag id -> description. Every tag used anywhere (events, values) must be listed here.
var tags: Dictionary = {}
## event kind -> {"doc": String, "tags": Array}. The event taxonomy; Chronicle kinds must be listed here.
var event_kinds: Dictionary = {}


static func load_default() -> Content:
	var c := Content.new()
	c.values = _strip_doc(_read_json("res://data/values.json"))
	c.names = _strip_doc(_read_json("res://data/names.json"))
	c.wants_fears = _strip_doc(_read_json("res://data/wants_fears.json"))
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
	return problems


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
