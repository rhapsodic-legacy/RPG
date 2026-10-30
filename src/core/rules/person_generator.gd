class_name PersonGenerator
extends RefCounted
## Rolls new people (crew or NPC) from content tables. Pure function of (rng, content).


static func generate(member_id: String, rng: SimRng, content: Content) -> Person:
	var c := Person.new()
	c.id = member_id
	c.given_name = rng.pick(content.names.given)
	c.family_name = rng.pick(content.names.family)
	c.temperament = Temperament.rolled(rng)
	c.values.assign(_pick_distinct(content.values.keys(), rng.range_int(2, 3), rng))
	c.wants.assign(_pick_distinct(content.wants_fears.wants, 1, rng))
	c.fears.assign(_pick_distinct(content.wants_fears.fears, 1, rng))
	c.mood = c.mood_baseline()
	return c


static func _pick_distinct(pool: Array, count: int, rng: SimRng) -> Array:
	var remaining := pool.duplicate()
	var out := []
	for i in mini(count, remaining.size()):
		var item: Variant = rng.pick(remaining)
		remaining.erase(item)
		out.append(item)
	return out
