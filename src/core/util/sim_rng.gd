class_name SimRng
extends RefCounted
## Deterministic random stream. Core code uses this, never the global randi()/randf().

var _rng := RandomNumberGenerator.new()
var _seed: int


func _init(seed_value: int = 0) -> void:
	_seed = seed_value
	_rng.seed = seed_value


## Independent child stream, so extra rolls in one system never shift another system's results.
func derive(stream_name: String) -> SimRng:
	return SimRng.new(hash("%d:%s" % [_seed, stream_name]))


func range_int(from: int, to: int) -> int:
	return _rng.randi_range(from, to)


func range_float(from: float, to: float) -> float:
	return _rng.randf_range(from, to)


func chance(probability: float) -> bool:
	return _rng.randf() < probability


func pick(items: Array) -> Variant:
	assert(not items.is_empty(), "SimRng.pick on empty array")
	return items[_rng.randi_range(0, items.size() - 1)]


## Keys are outcomes, values are non-negative weights. Iteration order is insertion order, so this is deterministic.
func weighted_pick(weights: Dictionary) -> Variant:
	var total := 0.0
	for key in weights:
		total += float(weights[key])
	var roll := _rng.randf() * total
	for key in weights:
		roll -= float(weights[key])
		if roll < 0.0:
			return key
	return weights.keys().back()


## Sum of two uniforms: values cluster near the middle, extremes are rarer.
func centered(spread: float = 1.0) -> float:
	return (_rng.randf_range(-spread, spread) + _rng.randf_range(-spread, spread)) * 0.5


# The 64-bit state is stored as a string because JSON numbers are doubles.
func to_dict() -> Dictionary:
	return {"seed": str(_seed), "state": str(_rng.state)}


static func from_dict(d: Dictionary) -> SimRng:
	var r := SimRng.new(String(d.get("seed", "0")).to_int())
	r._rng.state = String(d.get("state", "0")).to_int()
	return r
