extends TestCase

const ScriptedOrchestrator := preload("res://tests/fakes/scripted_orchestrator.gd")


func _state() -> GameState:
	var s := GameState.create("c", 3)
	s.credits = 100
	return s


func _ctx(port: OrchestratorPort) -> CampaignContext:
	return CampaignContext.new(Content.load_default(), port)


func _request() -> OrchestratorRequest:
	return OrchestratorRequest.new(OrchestratorRequest.PURPOSE_UNIVERSE_THREADS, {"turn": 1}, "proposals_v1")


func _rules_fallback() -> Array:
	return [ChangeCreditsCommand.new(5, "rules")]


func test_no_llm_uses_rules() -> void:
	var result := Orchestration.decide(_state(), _ctx(OrchestratorPort.new()), _request(), _rules_fallback)
	assert_eq(result.source, Orchestration.SOURCE_RULES)
	assert_eq((result.commands[0] as ChangeCreditsCommand).reason, "rules")


func test_valid_proposal_is_used_and_stored() -> void:
	var s := _state()
	var port := ScriptedOrchestrator.new()
	port.answers_by_purpose[OrchestratorRequest.PURPOSE_UNIVERSE_THREADS] = {"proposals": [{"kind": "change_credits", "args": {"amount": -40, "reason": "toll"}}]}
	port.submit(_request())
	var result := Orchestration.decide(s, _ctx(port), _request(), _rules_fallback)
	assert_eq(result.source, Orchestration.SOURCE_ORCHESTRATOR)
	assert_eq((result.commands[0] as ChangeCreditsCommand).reason, "toll")
	assert_true(s.orchestrator_results.has(_request().key()), "answer stored in state")


func test_stored_answer_replays_after_reload_without_llm() -> void:
	var s := _state()
	var port := ScriptedOrchestrator.new()
	port.answers_by_purpose[OrchestratorRequest.PURPOSE_UNIVERSE_THREADS] = {"proposals": [{"kind": "change_credits", "args": {"amount": -40, "reason": "toll"}}]}
	port.submit(_request())
	Orchestration.decide(s, _ctx(port), _request(), _rules_fallback)
	var reloaded := SaveCodec.decode_campaign(SaveCodec.encode_campaign(s))
	var result := Orchestration.decide(reloaded, _ctx(OrchestratorPort.new()), _request(), _rules_fallback)
	assert_eq(result.source, Orchestration.SOURCE_STORED)
	assert_eq((result.commands[0] as ChangeCreditsCommand).reason, "toll")


func test_invalid_proposals_fall_back_to_rules() -> void:
	var port := ScriptedOrchestrator.new()
	port.answers_by_purpose[OrchestratorRequest.PURPOSE_UNIVERSE_THREADS] = {"proposals": [
		{"kind": "change_credits", "args": {"amount": -9999}},
		{"kind": "summon_dragon"},
	]}
	port.submit(_request())
	var result := Orchestration.decide(_state(), _ctx(port), _request(), _rules_fallback)
	assert_eq(result.source, Orchestration.SOURCE_RULES)
	assert_eq(result.rejected.size(), 2)


func test_request_key_is_stable_for_equal_context() -> void:
	var a := OrchestratorRequest.new("dialogue", {"b": 2, "a": 1})
	var b := OrchestratorRequest.new("dialogue", {"a": 1, "b": 2})
	assert_eq(a.key(), b.key())
