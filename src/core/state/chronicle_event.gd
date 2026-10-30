class_name ChronicleEvent
extends RefCounted
## One structured fact about something that happened. Immutable once recorded.

var id: int = 0
var turn: int = 0
var kind: String = ""
var actors: Array[String] = []
var place: String = ""
var tags: Array[String] = []
var data: Dictionary = {}


func involves(actor_id: String) -> bool:
	return actors.has(actor_id)


## True if this event is about the given entity id or detail tag: as an actor, the place, a tag, or in data.refs.
func references(id_or_tag: String) -> bool:
	if id_or_tag.is_empty():
		return false
	return actors.has(id_or_tag) or place == id_or_tag or tags.has(id_or_tag) or Array(data.get("refs", [])).has(id_or_tag)


func has_tag(tag: String) -> bool:
	return tags.has(tag)


func to_dict() -> Dictionary:
	return {
		"id": id,
		"turn": turn,
		"kind": kind,
		"actors": Array(actors),
		"place": place,
		"tags": Array(tags),
		"data": data.duplicate(true),
	}


static func from_dict(d: Dictionary) -> ChronicleEvent:
	var e := ChronicleEvent.new()
	e.id = int(d.get("id", 0))
	e.turn = int(d.get("turn", 0))
	e.kind = String(d.get("kind", ""))
	e.actors.assign(d.get("actors", []))
	e.place = String(d.get("place", ""))
	e.tags.assign(d.get("tags", []))
	e.data = Dictionary(d.get("data", {})).duplicate(true)
	return e
