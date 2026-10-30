class_name Person
extends RefCounted
## Anyone with a mind: crew, NPCs, rivals, and retired legends from past campaigns all use this one model,
## so a crew member can become an NPC (or a legend) without conversion. Skills and gear come later.

const ROLE_CREW := "crew"
const ROLE_NPC := "npc"
const ROLE_LEGEND := "legend"

const STATUS_ACTIVE := "active"
const STATUS_RETIRED := "retired"
const STATUS_DEAD := "dead"
const STATUS_MISSING := "missing"

## Memories below this salience are forgotten on decay.
const FORGET_THRESHOLD := 0.05

var id: String = ""
var given_name: String = ""
var family_name: String = ""
var role: String = ROLE_NPC
var status: String = STATUS_ACTIVE
var faction_id: String = ""
## Campaign this person first appeared in; lets legends point back to their own history.
var origin_campaign_id: String = ""
var temperament := Temperament.new()
var values: Array[String] = []
var wants: Array[String] = []
var fears: Array[String] = []
## Short-term feeling, -1..+1. Drifts back toward a baseline set by temperament.
var mood: float = 0.0
## Each: {"event_id": int, "weight": float (-1..1, how it felt), "salience": float (0..1, how present it is)}
var memories: Array[Dictionary] = []
## other_id -> Relationship
var relationships: Dictionary = {}


func display_name() -> String:
	return "%s %s" % [given_name, family_name]


## Person ids are only unique within a campaign; across the profile they are qualified by origin.
func id_for_profile() -> String:
	return "%s/%s" % [origin_campaign_id, id]


func holds_value(value_id: String) -> bool:
	return values.has(value_id)


func remember(event: ChronicleEvent, weight: float) -> void:
	memories.append({"event_id": event.id, "weight": clampf(weight, -1.0, 1.0), "salience": 1.0})
	mood = clampf(mood + weight * 0.5, -1.0, 1.0)


## Strong feelings fade slower than mild ones.
func decay_memories(rate: float) -> void:
	for m in memories:
		var strength: float = absf(m.weight)
		m.salience = float(m.salience) * (1.0 - rate * (1.0 - strength * 0.8))
	memories.assign(memories.filter(func(m: Dictionary) -> bool: return float(m.salience) >= FORGET_THRESHOLD))


func mood_baseline() -> float:
	return (temperament.get_axis("nerve") + temperament.get_axis("warmth")) * 0.25


func settle_mood(rate: float) -> void:
	mood = lerpf(mood, mood_baseline(), clampf(rate, 0.0, 1.0))


func relationship_with(other_id: String) -> Relationship:
	if not relationships.has(other_id):
		relationships[other_id] = Relationship.new()
	return relationships[other_id]


func to_dict() -> Dictionary:
	var rels := {}
	for other_id in relationships:
		rels[other_id] = (relationships[other_id] as Relationship).to_dict()
	return {
		"id": id,
		"given_name": given_name,
		"family_name": family_name,
		"role": role,
		"status": status,
		"faction_id": faction_id,
		"origin_campaign_id": origin_campaign_id,
		"temperament": temperament.to_dict(),
		"values": Array(values),
		"wants": Array(wants),
		"fears": Array(fears),
		"mood": mood,
		"memories": memories.map(func(m: Dictionary) -> Dictionary: return m.duplicate()),
		"relationships": rels,
	}


static func from_dict(d: Dictionary) -> Person:
	var c := Person.new()
	c.id = String(d.get("id", ""))
	c.given_name = String(d.get("given_name", ""))
	c.family_name = String(d.get("family_name", ""))
	c.role = String(d.get("role", ROLE_NPC))
	c.status = String(d.get("status", STATUS_ACTIVE))
	c.faction_id = String(d.get("faction_id", ""))
	c.origin_campaign_id = String(d.get("origin_campaign_id", ""))
	c.temperament = Temperament.from_dict(d.get("temperament", {}))
	c.values.assign(d.get("values", []))
	c.wants.assign(d.get("wants", []))
	c.fears.assign(d.get("fears", []))
	c.mood = float(d.get("mood", 0.0))
	for raw in d.get("memories", []):
		c.memories.append({"event_id": int(raw.event_id), "weight": float(raw.weight), "salience": float(raw.salience)})
	var rels: Dictionary = d.get("relationships", {})
	for other_id in rels:
		c.relationships[other_id] = Relationship.from_dict(rels[other_id])
	return c
