class_name RulesCrewMind
extends CrewMind
## Appraisal from personal values (data/values.json) plus temperament colouring.

var _value_table: Dictionary


func _init(value_table: Dictionary) -> void:
	_value_table = value_table


func appraise(member: Person, event: ChronicleEvent) -> float:
	var total := 0.0
	for value_id in member.values:
		var cares: Dictionary = _value_table.get(value_id, {})
		for tag in event.tags:
			total += float(cares.get(tag, 0.0))
	# Anxious people feel bad news harder; steady people shrug a little more.
	if total < 0.0:
		total *= 1.0 - member.temperament.get_axis("nerve") * 0.3
	return clampf(total, -1.0, 1.0)


func relationship_shift(member: Person, other_id: String, event: ChronicleEvent) -> Dictionary:
	if not event.involves(other_id):
		return {}
	var feeling := appraise(member, event)
	var warmth := member.temperament.get_axis("warmth")
	return {
		"trust": feeling * 10.0,
		"affection": feeling * (6.0 + warmth * 4.0),
		"respect": feeling * 5.0,
		"tension": maxf(0.0, -feeling) * 12.0 - maxf(0.0, feeling) * 4.0,
	}
