extends Control
## M0 placeholder: starts a campaign from a fixed seed, hires a rolled crew through the Command pipeline,
## steps through one full turn, and shows the result.

const CREW_SIZE := 4
const SEED := 20261030


func _ready() -> void:
	var content := Content.load_default()
	for problem in content.validate():
		push_warning(problem)
	var state := GameState.create("demo", SEED)
	state.credits = 200
	var ctx := CampaignContext.new(content)
	var flow := TurnFlow.standard()
	flow.start(state, ctx)

	var lines: Array[String] = ["BEYOND THE EDGE: crew roll (seed %d)" % SEED, ""]
	for i in CREW_SIZE:
		var person := PersonGenerator.generate(state.new_id("p"), state.rng("people"), content)
		state.add_person(person)
		var rejected := Rules.submit(state, HireCommand.new(person.id, 25))
		lines.append("%s  values: %s  wants: %s  fears: %s%s" % [
			person.display_name(), ", ".join(PackedStringArray(person.values)), person.wants[0], person.fears[0],
			"" if rejected.is_empty() else "  (not hired: %s)" % rejected])

	while state.turn == 1:
		flow.advance(state, ctx)
	lines.append("")
	lines.append("Turn %d, phase '%s', credits %d, chronicle events %d" % [state.turn, state.phase, state.credits, state.chronicle.size()])

	var label := Label.new()
	label.text = "\n".join(PackedStringArray(lines))
	label.position = Vector2(24, 24)
	add_child(label)
