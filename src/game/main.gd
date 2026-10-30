extends Control
## M0 placeholder: rolls a crew from the seed and shows them. Proves game -> core wiring.

const CREW_SIZE := 4


func _ready() -> void:
	var content := Content.load_default()
	var rng := SimRng.new(20261030).derive("crew")
	var lines: Array[String] = ["BEYOND THE EDGE: crew roll (seed 20261030)", ""]
	for i in CREW_SIZE:
		var member := CrewGenerator.generate("crew_%d" % i, rng, content)
		lines.append("%s  values: %s  wants: %s  fears: %s" % [
			member.display_name(), ", ".join(PackedStringArray(member.values)), member.wants[0], member.fears[0]])
	var label := Label.new()
	label.text = "\n".join(PackedStringArray(lines))
	label.position = Vector2(24, 24)
	add_child(label)
