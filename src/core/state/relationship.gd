class_name Relationship
extends RefCounted
## How one person feels about another. Directional: A's view of B can differ from B's view of A.

const DIMENSIONS := ["trust", "affection", "respect", "tension"]
const MIN_VALUE := -100.0
const MAX_VALUE := 100.0

var trust: float = 0.0
var affection: float = 0.0
var respect: float = 0.0
## 0..100. Unresolved friction; high tension with high affection is a different story from high tension with none.
var tension: float = 0.0


## deltas: {"trust": 5, "tension": -10}. Unknown keys are ignored.
func apply(deltas: Dictionary) -> void:
	trust = clampf(trust + float(deltas.get("trust", 0.0)), MIN_VALUE, MAX_VALUE)
	affection = clampf(affection + float(deltas.get("affection", 0.0)), MIN_VALUE, MAX_VALUE)
	respect = clampf(respect + float(deltas.get("respect", 0.0)), MIN_VALUE, MAX_VALUE)
	tension = clampf(tension + float(deltas.get("tension", 0.0)), 0.0, MAX_VALUE)


func to_dict() -> Dictionary:
	return {"trust": trust, "affection": affection, "respect": respect, "tension": tension}


static func from_dict(d: Dictionary) -> Relationship:
	var r := Relationship.new()
	r.apply(d)
	return r
