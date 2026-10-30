extends TestCase


class WaitingPhase:
	extends CampaignPhase
	var done := false
	func id() -> String:
		return "waiting"
	func is_done(_state: GameState) -> bool:
		return done


func _ctx() -> CampaignContext:
	return CampaignContext.new(Content.load_default())


func test_full_turn_cycles_and_increments() -> void:
	var s := GameState.create("c", 1)
	var flow := TurnFlow.standard()
	var ctx := _ctx()
	flow.start(s, ctx)
	assert_eq(s.phase, "upkeep")
	var visited: Array[String] = [s.phase]
	for i in flow.phase_ids().size() - 1:
		assert_true(flow.advance(s, ctx))
		visited.append(s.phase)
	assert_eq(visited, flow.phase_ids())
	assert_eq(s.turn, 1)
	flow.advance(s, ctx)
	assert_eq(s.turn, 2)
	assert_eq(s.phase, "upkeep")
	assert_eq(s.chronicle.with_tag("turn").size(), 2)


func test_unfinished_phase_blocks() -> void:
	var s := GameState.create("c", 1)
	var waiting := WaitingPhase.new()
	var flow := TurnFlow.new([waiting, PlaceholderPhase.new("next")])
	var ctx := _ctx()
	flow.start(s, ctx)
	assert_true(not flow.advance(s, ctx))
	assert_eq(s.phase, "waiting")
	waiting.done = true
	assert_true(flow.advance(s, ctx))
	assert_eq(s.phase, "next")
