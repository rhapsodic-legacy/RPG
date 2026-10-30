class_name UpkeepPhase
extends CampaignPhase
## Start of turn: time passes for everyone aboard.

const MEMORY_DECAY := 0.1
const MOOD_SETTLE := 0.2


func id() -> String:
	return "upkeep"


func enter(state: GameState, _ctx: CampaignContext) -> void:
	for person in state.crew():
		person.decay_memories(MEMORY_DECAY)
		person.settle_mood(MOOD_SETTLE)
