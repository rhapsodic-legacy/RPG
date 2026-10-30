class_name Content
extends RefCounted
## Read-only access to JSON content in data/. Loaded once and passed into systems, so tests can supply their own.

var values: Dictionary = {}
var names: Dictionary = {}
var wants_fears: Dictionary = {}


static func load_default() -> Content:
	var c := Content.new()
	c.values = _strip_doc(_read_json("res://data/values.json"))
	c.names = _strip_doc(_read_json("res://data/names.json"))
	c.wants_fears = _strip_doc(_read_json("res://data/wants_fears.json"))
	return c


static func _read_json(path: String) -> Dictionary:
	var text := FileAccess.get_file_as_string(path)
	var parsed: Variant = JSON.parse_string(text)
	assert(parsed is Dictionary, "Content file is not a JSON object: " + path)
	return parsed


static func _strip_doc(d: Dictionary) -> Dictionary:
	d.erase("_doc")
	return d
