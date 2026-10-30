class_name TurnFlow
extends RefCounted
## The campaign turn as an ordered list of phases. state.phase holds the current phase id.

var _phases: Array[CampaignPhase] = []


func _init(phases: Array) -> void:
	_phases.assign(phases)


## Phase order for M1. Placeholders are replaced as each phase is built.
static func standard() -> TurnFlow:
	return TurnFlow.new([
		UpkeepPhase.new(),
		PlaceholderPhase.new("news"),
		PlaceholderPhase.new("bay"),
		PlaceholderPhase.new("job_select"),
		PlaceholderPhase.new("mission"),
		PlaceholderPhase.new("aftermath"),
		PlaceholderPhase.new("travel"),
	])


func phase_ids() -> Array[String]:
	var ids: Array[String] = []
	for p in _phases:
		ids.append(p.id())
	return ids


func current(state: GameState) -> CampaignPhase:
	var i := _index_of(state.phase)
	return null if i < 0 else _phases[i]


func start(state: GameState, ctx: CampaignContext) -> void:
	state.phase = _phases[0].id()
	state.chronicle.record(state.turn, "turn_began", [], "", ["turn"])
	_phases[0].enter(state, ctx)


## Moves to the next phase when the current one is done. Returns false if it is still waiting.
func advance(state: GameState, ctx: CampaignContext) -> bool:
	var i := _index_of(state.phase)
	assert(i >= 0, "Unknown phase: " + state.phase)
	if not _phases[i].is_done(state):
		return false
	var next := i + 1
	if next >= _phases.size():
		state.turn += 1
		start(state, ctx)
		return true
	state.phase = _phases[next].id()
	_phases[next].enter(state, ctx)
	return true


func _index_of(phase_id: String) -> int:
	for i in _phases.size():
		if _phases[i].id() == phase_id:
			return i
	return -1
