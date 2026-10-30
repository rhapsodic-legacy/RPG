class_name Chronicle
extends RefCounted
## Append-only log of everything narratively meaningful. Source of truth for memory, news, rivals, legacy and LLM context.

var _events: Array[ChronicleEvent] = []
var _next_id: int = 1


func record(turn: int, kind: String, actors: Array = [], place: String = "", tags: Array = [], data: Dictionary = {}) -> ChronicleEvent:
	var e := ChronicleEvent.new()
	e.id = _next_id
	_next_id += 1
	e.turn = turn
	e.kind = kind
	e.actors.assign(actors)
	e.place = place
	e.tags.assign(tags)
	e.data = data.duplicate(true)
	_events.append(e)
	return e


func size() -> int:
	return _events.size()


func get_event(event_id: int) -> ChronicleEvent:
	# Ids are dense and start at 1, so index lookup is valid while nothing is ever removed.
	var index := event_id - 1
	if index < 0 or index >= _events.size():
		return null
	return _events[index]


func involving(actor_id: String) -> Array[ChronicleEvent]:
	return _typed(_events.filter(func(e: ChronicleEvent) -> bool: return e.involves(actor_id)))


func with_tag(tag: String) -> Array[ChronicleEvent]:
	return _typed(_events.filter(func(e: ChronicleEvent) -> bool: return e.has_tag(tag)))


func recent(count: int) -> Array[ChronicleEvent]:
	return _typed(_events.slice(maxi(0, _events.size() - count)))


# Array.filter/slice return untyped arrays; typed returns need an explicit assign.
static func _typed(items: Array) -> Array[ChronicleEvent]:
	var out: Array[ChronicleEvent] = []
	out.assign(items)
	return out


func to_dict() -> Dictionary:
	return {"next_id": _next_id, "events": _events.map(func(e: ChronicleEvent) -> Dictionary: return e.to_dict())}


static func from_dict(d: Dictionary) -> Chronicle:
	var c := Chronicle.new()
	c._next_id = int(d.get("next_id", 1))
	for raw in d.get("events", []):
		c._events.append(ChronicleEvent.from_dict(raw))
	return c
