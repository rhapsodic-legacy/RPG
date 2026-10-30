extends TestCase


func _content() -> Content:
	return Content.load_default()


func test_temperament_clamps() -> void:
	var t := Temperament.new()
	t.set_axis("nerve", 5.0)
	assert_almost(t.get_axis("nerve"), 1.0)
	t.shift("nerve", -3.0)
	assert_almost(t.get_axis("nerve"), -1.0)


func test_relationship_clamps_and_tension_floor() -> void:
	var r := Relationship.new()
	r.apply({"trust": 500.0, "tension": -50.0})
	assert_almost(r.trust, 100.0)
	assert_almost(r.tension, 0.0)


func test_generation_is_deterministic() -> void:
	var a := PersonGenerator.generate("c", SimRng.new(5), _content())
	var b := PersonGenerator.generate("c", SimRng.new(5), _content())
	assert_eq(a.display_name(), b.display_name())
	assert_eq(a.values, b.values)
	assert_true(a.values.size() >= 2 and a.values.size() <= 3)


func test_person_round_trip() -> void:
	var m := PersonGenerator.generate("crew_0", SimRng.new(11), _content())
	var c := Chronicle.new()
	m.remember(c.record(1, "rescue", ["crew_1"], "", ["rescue"]), 0.6)
	m.relationship_with("crew_1").apply({"trust": 12.0})
	var back := Person.from_dict(json_round_trip(m.to_dict()))
	assert_eq(back.display_name(), m.display_name())
	assert_eq(back.values, m.values)
	assert_almost(back.temperament.get_axis("drive"), m.temperament.get_axis("drive"))
	assert_eq(back.memories.size(), 1)
	assert_eq(int(back.memories[0].event_id), 1)
	assert_almost(back.relationship_with("crew_1").trust, 12.0)
	assert_eq(back.role, m.role)


func test_memories_fade_and_strong_ones_last_longer() -> void:
	var m := Person.new()
	var c := Chronicle.new()
	m.remember(c.record(1, "mild"), 0.1)
	m.remember(c.record(1, "trauma"), -1.0)
	for i in 30:
		m.decay_memories(0.2)
	assert_eq(m.memories.size(), 1, "mild memory forgotten")
	assert_eq(int(m.memories[0].event_id), 2, "trauma remembered")


func test_rules_mind_judges_by_values() -> void:
	var mind := RulesCrewMind.new(_content())
	var loyal := Person.new()
	loyal.values.assign(["loyalty"])
	var mercenary := Person.new()
	mercenary.values.assign(["wealth"])
	var c := Chronicle.new()
	var betrayal := c.record(3, "sold_out_contact", ["captain"], "", ["betrayal", "big_payday"])
	assert_true(mind.appraise(loyal, betrayal) < 0.0, "loyal member hates betrayal")
	assert_true(mind.appraise(mercenary, betrayal) > 0.0, "mercenary likes the payday")
	var shift := mind.relationship_shift(loyal, "captain", betrayal)
	assert_true(float(shift.trust) < 0.0, "loyal member trusts the captain less")
	assert_true(float(shift.tension) > 0.0, "and tension rises")
