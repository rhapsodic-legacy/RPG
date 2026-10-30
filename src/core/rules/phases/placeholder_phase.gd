class_name PlaceholderPhase
extends CampaignPhase
## Keeps a phase's slot in the turn so the flow is complete; replaced by a real phase in its milestone.

var _id: String


func _init(phase_id: String) -> void:
	_id = phase_id


func id() -> String:
	return _id
