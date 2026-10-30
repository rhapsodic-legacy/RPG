extends TestCase


func test_ids_are_sequential_and_lookup_works() -> void:
	var c := Chronicle.new()
	var e1 := c.record(1, "job_taken", ["crew_0"])
	var e2 := c.record(1, "firefight", ["crew_0", "crew_1"], "dock_9", ["violence"])
	assert_eq(e1.id, 1)
	assert_eq(e2.id, 2)
	assert_eq(c.get_event(2).kind, "firefight")
	assert_true(c.get_event(3) == null, "missing id returns null")


func test_queries() -> void:
	var c := Chronicle.new()
	c.record(1, "a", ["crew_0"], "", ["mercy"])
	c.record(2, "b", ["crew_1"], "", ["violence"])
	c.record(3, "c", ["crew_0", "crew_1"], "", ["violence"])
	assert_eq(c.involving("crew_0").size(), 2)
	assert_eq(c.with_tag("violence").size(), 2)
	assert_eq(c.recent(1)[0].kind, "c")
	assert_eq(c.recent(10).size(), 3)


func test_round_trip() -> void:
	var c := Chronicle.new()
	c.record(4, "rescue", ["crew_0"], "relay_station", ["rescue"], {"saved": 3})
	var back := Chronicle.from_dict(json_round_trip(c.to_dict()))
	assert_eq(back.size(), 1)
	var e := back.get_event(1)
	assert_eq(e.turn, 4)
	assert_eq(e.place, "relay_station")
	assert_true(e.has_tag("rescue"))
	assert_eq(int(e.data.saved), 3)
	assert_eq(back.record(5, "next").id, 2, "next id survives round trip")
