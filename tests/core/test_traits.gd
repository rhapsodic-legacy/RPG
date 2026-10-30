extends TestCase


func _ctx() -> CampaignContext:
	return CampaignContext.new(Content.load_default())


func _state_with_fearful_person(intensity: float) -> GameState:
	var s := GameState.create("c", 1)
	var p := Person.new()
	p.id = s.new_id("p")
	p.given_name = "Ilse"
	p.family_name = "Varrow"
	p.add_trait("fear_of_faction", "halvard_syndicate", intensity, 1)
	s.add_person(p)
	return s


func test_two_layer_text() -> void:
	var s := _state_with_fearful_person(0.5)
	var content := Content.load_default()
	var t := s.get_person("p_1").traits[0]
	assert_eq(TraitRules.general_text(t, content), "fears a powerful group")
	assert_eq(TraitRules.specific_text(t, content, s.name_of), "fears halvard syndicate")


func test_trait_colours_appraisal_only_when_target_involved() -> void:
	var s := _state_with_fearful_person(1.0)
	var content := Content.load_default()
	var person := s.get_person("p_1")
	var about_them := s.chronicle.record(1, "arrived", [], "", ["travel"], {"refs": ["halvard_syndicate"]})
	var unrelated := s.chronicle.record(1, "arrived", [], "", ["travel"], {"refs": ["corvan_compact"]})
	assert_true(TraitRules.appraise(person, about_them, content) < 0.0)
	assert_almost(TraitRules.appraise(person, unrelated, content), 0.0)


func test_present_channels_need_target_present() -> void:
	var s := _state_with_fearful_person(1.0)
	var person := s.get_person("p_1")
	var content := Content.load_default()
	assert_almost(TraitRules.channel(person, "morale_when_present", content, ["halvard_syndicate"]), -0.2)
	assert_almost(TraitRules.channel(person, "morale_when_present", content, ["someone_else"]), 0.0)


func test_evolution_follows_edges_and_keeps_target() -> void:
	var s := _state_with_fearful_person(0.9)
	var ctx := _ctx()
	var person := s.get_person("p_1")
	var raid := s.chronicle.record(2, "arrived", [], "", ["violence"], {"refs": ["halvard_syndicate"]})
	var proposals := TraitRules.propose_evolutions(person, raid, ctx.content)
	assert_eq(proposals.size(), 1)
	assert_eq(Rules.submit(s, proposals[0], ctx), "")
	var t := person.traits[0]
	assert_eq(t.archetype, "hatred_of_faction")
	assert_eq(t.target, "halvard_syndicate", "target kept")
	assert_eq(Array(t.lineage), ["fear_of_faction"])
	assert_eq(s.chronicle.recent(1)[0].kind, "trait_evolved")


func test_weak_fear_does_not_harden_into_hatred() -> void:
	var s := _state_with_fearful_person(0.3)
	var raid := s.chronicle.record(2, "arrived", [], "", ["violence"], {"refs": ["halvard_syndicate"]})
	assert_eq(TraitRules.propose_evolutions(s.get_person("p_1"), raid, Content.load_default()).size(), 0)


func test_unrelated_evolution_is_rejected() -> void:
	# An LLM (or a bug) can't turn "fears the syndicate" into something unrelated.
	var s := _state_with_fearful_person(0.9)
	var cmd := CommandRegistry.from_dict({"kind": "evolve_trait", "args": {"person_id": "p_1", "trait_id": "t1", "to": "want_own_ship"}})
	assert_eq(Rules.submit(s, cmd, _ctx()), "not an allowed evolution")
	assert_eq(s.get_person("p_1").traits[0].archetype, "fear_of_faction")


func test_annotation_adds_detail_with_limits() -> void:
	var s := _state_with_fearful_person(0.5)
	var ctx := _ctx()
	assert_eq(Rules.submit(s, AnnotateTraitCommand.new("p_1", "t1", "Won't dock at Corvan Station."), ctx), "")
	assert_eq(Array(s.get_person("p_1").traits[0].notes), ["Won't dock at Corvan Station."])
	assert_eq(Rules.submit(s, AnnotateTraitCommand.new("p_1", "t1", "x".repeat(500)), ctx), "note too long")


func test_profile_has_both_layers_and_allowed_growth() -> void:
	var s := _state_with_fearful_person(0.5)
	var d := PersonProfile.describe(s.get_person("p_1"), s, Content.load_default())
	assert_eq(d.traits[0].general, "fears a powerful group")
	assert_eq(d.traits[0].specific, "fears halvard syndicate")
	assert_true(Array(d.traits[0].may_become).has("hatred_of_faction"))
	assert_true(String(d.summary).contains("fears a powerful group"))


func test_traits_round_trip() -> void:
	var s := _state_with_fearful_person(0.5)
	s.get_person("p_1").traits[0].notes.append("detail")
	var back := SaveCodec.decode_campaign(SaveCodec.encode_campaign(s))
	var t := back.get_person("p_1").traits[0]
	assert_eq(t.archetype, "fear_of_faction")
	assert_eq(t.target, "halvard_syndicate")
	assert_almost(t.intensity, 0.5)
	assert_eq(Array(t.notes), ["detail"])
	assert_eq(back.get_person("p_1").add_trait("want_own_ship", "", 0.5, 1).id, "t2", "trait ids continue")


func test_generator_only_uses_available_targets() -> void:
	var content := Content.load_default()
	for seed_value in 20:
		var p := PersonGenerator.generate("p", SimRng.new(seed_value), content, {}, 0)
		for t in p.traits:
			var target_type: String = content.archetype(t.archetype).get("target")
			assert_true(target_type == "detail" or target_type == "none", "no factions/people given, got " + t.archetype)
