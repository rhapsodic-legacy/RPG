class_name PersonGenerator
extends RefCounted
## Rolls new people (crew or NPC) from content tables. Pure function of (rng, content).

## Small quirks rolled at creation. More are earned later aboard ship, in battle and from the world.
const STARTING_QUIRKS_MIN := 2
const STARTING_QUIRKS_MAX := 4
const CREATION_SOURCES := ["birth", "backstory", "battle"]


## refs: candidate targets for traits by type, e.g. {"faction": ["f_1", "f_2"], "person": ["p_7"]}.
## Archetypes whose target type has no candidates are skipped, so early campaigns still roll valid people.
static func generate(member_id: String, rng: SimRng, content: Content, refs: Dictionary = {}, turn: int = 0) -> Person:
	var c := Person.new()
	c.id = member_id
	c.given_name = rng.pick(content.names.given)
	c.family_name = rng.pick(content.names.family)
	c.temperament = Temperament.rolled(rng)
	c.values.assign(_pick_distinct(content.values.keys(), rng.range_int(2, 3), rng))
	for kind in ["want", "fear"]:
		_add_backstory_trait(c, kind, rng, content, refs, turn)
	_add_starting_quirks(c, rng, content, turn)
	c.mood = c.mood_baseline()
	return c


static func _add_backstory_trait(person: Person, kind: String, rng: SimRng, content: Content, refs: Dictionary, turn: int) -> void:
	var candidates: Array[String] = []
	for archetype_id in content.archetypes_of_kind(kind):
		if not _targets_for(content.archetype(archetype_id), refs).is_empty() or content.archetype(archetype_id).get("target") == "none":
			candidates.append(archetype_id)
	if candidates.is_empty():
		return
	var archetype_id: String = rng.pick(candidates)
	var a := content.archetype(archetype_id)
	var target: String = "" if a.get("target") == "none" else String(rng.pick(_targets_for(a, refs)))
	person.add_trait(archetype_id, target, rng.range_float(0.3, 0.8), turn, 0, "backstory")


static func _add_starting_quirks(person: Person, rng: SimRng, content: Content, turn: int) -> void:
	var pool: Array[String] = []
	for archetype_id in content.archetypes_of_kind("quirk"):
		var sources: Array = content.archetype(archetype_id).get("sources", [])
		if sources.any(func(s: Variant) -> bool: return CREATION_SOURCES.has(s)):
			pool.append(archetype_id)
	for archetype_id in _pick_distinct(pool, rng.range_int(STARTING_QUIRKS_MIN, STARTING_QUIRKS_MAX), rng):
		var sources: Array = content.archetype(archetype_id).get("sources", [])
		person.add_trait(archetype_id, "", rng.range_float(0.6, 1.0), turn, 0, String(sources[0]))


static func _targets_for(a: Dictionary, refs: Dictionary) -> Array:
	if a.get("target") == "detail":
		return a.get("options", [])
	return refs.get(a.get("target", ""), [])


static func _pick_distinct(pool: Array, count: int, rng: SimRng) -> Array:
	var remaining := pool.duplicate()
	var out := []
	for i in mini(count, remaining.size()):
		var item: Variant = rng.pick(remaining)
		remaining.erase(item)
		out.append(item)
	return out
