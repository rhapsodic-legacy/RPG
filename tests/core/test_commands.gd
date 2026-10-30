extends TestCase


func _state() -> GameState:
	var s := GameState.create("c", 9)
	s.credits = 50
	var p := Person.new()
	p.id = s.new_id("p")
	s.add_person(p)
	return s


func test_hire_rejections_leave_state_unchanged() -> void:
	var s := _state()
	assert_eq(Rules.submit(s, HireCommand.new("nobody")), "unknown person")
	assert_eq(Rules.submit(s, HireCommand.new("p_1", 999)), "cannot afford")
	assert_eq(Rules.submit(s, HireCommand.new("p_1", -5)), "negative fee")
	assert_eq(s.credits, 50)
	assert_eq(s.crew_ids.size(), 0)
	assert_eq(s.chronicle.size(), 0)


func test_hire_applies_and_records() -> void:
	var s := _state()
	assert_eq(Rules.submit(s, HireCommand.new("p_1", 20)), "")
	assert_eq(s.credits, 30)
	assert_eq(Array(s.crew_ids), ["p_1"])
	assert_eq(s.chronicle.recent(1)[0].kind, "crew_joined")
	assert_eq(Rules.submit(s, HireCommand.new("p_1")), "already crew")


func test_registry_round_trips_commands() -> void:
	var original := ChangeCreditsCommand.new(-15, "fuel")
	var rebuilt := CommandRegistry.from_dict(JSON.parse_string(JSON.stringify(original.to_dict())))
	assert_true(rebuilt is ChangeCreditsCommand)
	assert_eq((rebuilt as ChangeCreditsCommand).amount, -15)
	assert_eq((rebuilt as ChangeCreditsCommand).reason, "fuel")


func test_registry_rejects_garbage() -> void:
	assert_true(CommandRegistry.from_dict({"kind": "launch_nukes"}) == null)
	assert_true(CommandRegistry.from_dict("hire") == null)
	var cmd := CommandRegistry.from_dict({"kind": "hire", "args": "oops"})
	assert_true(cmd != null and cmd.validate(_state(), null) == "unknown person", "bad args become an invalid command, not a crash")
