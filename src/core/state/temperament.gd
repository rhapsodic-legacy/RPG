class_name Temperament
extends RefCounted
## Stable personality axes, each -1..+1. Changes slowly, mostly through arcs.

const AXES := ["warmth", "nerve", "drive", "order", "candor"]

var _values: Dictionary = {}


func _init() -> void:
	for axis in AXES:
		_values[axis] = 0.0


func get_axis(axis: String) -> float:
	assert(_values.has(axis), "Unknown temperament axis: " + axis)
	return _values[axis]


func set_axis(axis: String, value: float) -> void:
	assert(_values.has(axis), "Unknown temperament axis: " + axis)
	_values[axis] = clampf(value, -1.0, 1.0)


func shift(axis: String, delta: float) -> void:
	set_axis(axis, get_axis(axis) + delta)


static func rolled(rng: SimRng) -> Temperament:
	var t := Temperament.new()
	for axis in AXES:
		t.set_axis(axis, rng.centered(1.0))
	return t


func to_dict() -> Dictionary:
	return _values.duplicate()


static func from_dict(d: Dictionary) -> Temperament:
	var t := Temperament.new()
	for axis in AXES:
		t.set_axis(axis, float(d.get(axis, 0.0)))
	return t
