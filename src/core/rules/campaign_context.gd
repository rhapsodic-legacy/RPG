class_name CampaignContext
extends RefCounted
## Services the rules need but that are not saved state: content, brains, the orchestrator port.

var content: Content
var crew_mind: CrewMind
var orchestrator: OrchestratorPort


func _init(p_content: Content, p_orchestrator: OrchestratorPort = null) -> void:
	content = p_content
	crew_mind = RulesCrewMind.new(p_content)
	orchestrator = p_orchestrator if p_orchestrator != null else OrchestratorPort.new()
