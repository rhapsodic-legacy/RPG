extends TestCase


func _state_with_crew() -> GameState:
	var s := GameState.create("camp_test", 1234)
	s.credits = 100
	var content := Content.load_default()
	for i in 3:
		var p := PersonGenerator.generate(s.new_id("p"), s.rng("people"), content)
		s.add_person(p)
		assert_eq(Rules.submit(s, HireCommand.new(p.id, 10)), "")
	return s


func test_ids_are_sequential_per_prefix() -> void:
	var s := GameState.create("c", 1)
	assert_eq(s.new_id("p"), "p_1")
	assert_eq(s.new_id("p"), "p_2")
	assert_eq(s.new_id("f"), "f_1")


func test_person_gets_origin_campaign() -> void:
	var s := _state_with_crew()
	assert_eq(s.get_person("p_1").origin_campaign_id, "camp_test")
	assert_eq(s.get_person("p_1").role, Person.ROLE_CREW)


func test_save_round_trip_preserves_everything_that_matters() -> void:
	var s := _state_with_crew()
	var back := SaveCodec.decode_campaign(SaveCodec.encode_campaign(s))
	assert_true(back != null, "decodes")
	assert_eq(back.credits, 70)
	assert_eq(back.crew_ids, s.crew_ids)
	assert_eq(back.chronicle.size(), s.chronicle.size())
	assert_eq(back.get_person("p_2").display_name(), s.get_person("p_2").display_name())
	assert_eq(back.new_id("p"), s.new_id("p"), "id counters survive")
	assert_eq(back.rng("people").range_int(0, 1_000_000), s.rng("people").range_int(0, 1_000_000), "rng streams survive")


func test_same_seed_same_campaign() -> void:
	var a := _state_with_crew()
	var b := _state_with_crew()
	assert_eq(SaveCodec.encode_campaign(a), SaveCodec.encode_campaign(b))


func test_garbage_save_is_rejected() -> void:
	assert_true(SaveCodec.decode_campaign("not json") == null)


func test_profile_enshrines_legends() -> void:
	var s := _state_with_crew()
	var profile := ProfileState.new()
	var legend := profile.enshrine(s.get_person("p_1"))
	assert_eq(legend.role, Person.ROLE_LEGEND)
	assert_eq(s.get_person("p_1").role, Person.ROLE_CREW, "campaign copy untouched")
	var back := SaveCodec.decode_profile(SaveCodec.encode_profile(profile))
	assert_true(back.legends.has("camp_test/p_1"))
	assert_eq((back.legends["camp_test/p_1"] as Person).display_name(), legend.display_name())
