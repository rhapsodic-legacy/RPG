extends TestCase


func test_same_seed_same_sequence() -> void:
	var a := SimRng.new(42)
	var b := SimRng.new(42)
	for i in 20:
		assert_eq(a.range_int(0, 1000), b.range_int(0, 1000), "roll %d" % i)


func test_derived_streams_are_independent_of_parent_usage() -> void:
	var a := SimRng.new(7)
	var b := SimRng.new(7)
	b.range_int(0, 100)
	assert_eq(a.derive("crew").range_int(0, 1_000_000), b.derive("crew").range_int(0, 1_000_000))


func test_round_trip_continues_sequence() -> void:
	var a := SimRng.new(99)
	a.range_int(0, 10)
	var b := SimRng.from_dict(json_round_trip(a.to_dict()))
	for i in 10:
		assert_eq(b.range_float(0.0, 1.0), a.range_float(0.0, 1.0), "roll %d" % i)


func test_weighted_pick_never_picks_zero_weight() -> void:
	var rng := SimRng.new(3)
	for i in 200:
		assert_true(rng.weighted_pick({"never": 0.0, "always": 1.0}) == "always")
