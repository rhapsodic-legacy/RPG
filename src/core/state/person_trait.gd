class_name PersonTrait
extends RefCounted
## One want, fear, grudge or scar, instanced from an archetype in data/trait_archetypes.json.
## Two layers: the archetype's general form ("fears a powerful group") stays stable and short; the
## bound target, intensity, origin and notes carry the specifics ("fears the Halvard Syndicate, since
## they burned her home on turn 3"). Archetypes only change along authored edges and keep their target.

var id: String = ""
var archetype: String = ""
## Entity id (faction, person, place) or detail tag this trait is about. Empty for target "none".
var target: String = ""
## 0..1, how strongly it is felt. Rises as events touch the target.
var intensity: float = 0.5
var since_turn: int = 0
## Where it came from: birth, backstory, world, battle, ship_life, relationship (Content.TRAIT_SOURCES).
var source: String = ""
## Chronicle event that created it (0 = backstory).
var origin_event_id: int = 0
## Earlier archetypes this trait evolved from, oldest first.
var lineage: Array[String] = []
## Short specific details, from rules or an LLM, kept so the character stays consistent over time.
var notes: Array[String] = []


func to_dict() -> Dictionary:
	return {
		"id": id,
		"archetype": archetype,
		"target": target,
		"intensity": intensity,
		"since_turn": since_turn,
		"source": source,
		"origin_event_id": origin_event_id,
		"lineage": Array(lineage),
		"notes": Array(notes),
	}


static func from_dict(d: Dictionary) -> PersonTrait:
	var t := PersonTrait.new()
	t.id = String(d.get("id", ""))
	t.archetype = String(d.get("archetype", ""))
	t.target = String(d.get("target", ""))
	t.intensity = clampf(float(d.get("intensity", 0.5)), 0.0, 1.0)
	t.since_turn = int(d.get("since_turn", 0))
	t.source = String(d.get("source", ""))
	t.origin_event_id = int(d.get("origin_event_id", 0))
	t.lineage.assign(d.get("lineage", []))
	t.notes.assign(d.get("notes", []))
	return t
