class_name PersonGenerator
extends RefCounted
## Rolls new people (crew or NPC) from content tables. Pure function of (rng, content).


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
	person.add_trait(archetype_id, target, rng.range_float(0.3, 0.8), turn)


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
