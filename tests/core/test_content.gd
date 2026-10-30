extends TestCase


func test_content_is_consistent() -> void:
	var problems := Content.load_default().validate()
	assert_eq(problems.size(), 0, "content problems: %s" % str(problems))


func test_rules_only_record_known_event_kinds() -> void:
	# Keep in sync with every kind recorded in src/core. A missing kind here means event_kinds.json is behind.
	var content := Content.load_default()
	for kind in ["turn_began", "crew_joined", "credits_changed", "trait_evolved", "trait_annotated"]:
		assert_true(content.is_known_event(kind), "event kind not in taxonomy: " + kind)
