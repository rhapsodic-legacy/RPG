class_name GameState
extends RefCounted
## One campaign's complete state. Everything needed to resume lives here; nothing lives in scenes.
## Profile-wide data (legends, outpost, unlocks) lives in ProfileState instead.

## Bump when the saved shape changes, and add a migration step in SaveCodec.
const SCHEMA_VERSION := 1

var campaign_id: String = ""
var campaign_seed: int = 0
var turn: int = 1
## Id of the current CampaignPhase in the TurnFlow.
var phase: String = ""
var credits: int = 0
var crew_ids: Array[String] = []
## Every Person known to this campaign, crew or not. id -> Person
var people: Dictionary = {}
var chronicle := Chronicle.new()
## Orchestrator answers already used, keyed by request key, so reloads replay the same decisions.
var orchestrator_results: Dictionary = {}
var _rngs: Dictionary = {}
var _next_ids: Dictionary = {}


static func create(id: String, seed_value: int) -> GameState:
	var s := GameState.new()
	s.campaign_id = id
	s.campaign_seed = seed_value
	return s


## Named random stream. Each system uses its own so they don't disturb each other.
func rng(stream: String) -> SimRng:
	if not _rngs.has(stream):
		_rngs[stream] = SimRng.new(campaign_seed).derive(stream)
	return _rngs[stream]


## Deterministic ids like "p_1", "p_2". Prefixes: p = person, f = faction, w = world, j = job.
func new_id(prefix: String) -> String:
	var n: int = _next_ids.get(prefix, 0) + 1
	_next_ids[prefix] = n
	return "%s_%d" % [prefix, n]


func add_person(p: Person) -> void:
	assert(not people.has(p.id), "Duplicate person id: " + p.id)
	if p.origin_campaign_id.is_empty():
		p.origin_campaign_id = campaign_id
	people[p.id] = p


func get_person(id: String) -> Person:
	return people.get(id)


## Display name for any entity id or detail tag. Factions and places join here when they exist (M1).
func name_of(id: String) -> String:
	if people.has(id):
		return (people[id] as Person).display_name()
	return id.replace("_", " ")


func crew() -> Array[Person]:
	var out: Array[Person] = []
	for id in crew_ids:
		out.append(people[id])
	return out


func to_dict() -> Dictionary:
	var people_out := {}
	for id in people:
		people_out[id] = (people[id] as Person).to_dict()
	var rngs_out := {}
	for stream in _rngs:
		rngs_out[stream] = (_rngs[stream] as SimRng).to_dict()
	return {
		"schema_version": SCHEMA_VERSION,
		"campaign_id": campaign_id,
		"campaign_seed": str(campaign_seed),
		"turn": turn,
		"phase": phase,
		"credits": credits,
		"crew_ids": Array(crew_ids),
		"people": people_out,
		"chronicle": chronicle.to_dict(),
		"orchestrator_results": orchestrator_results.duplicate(true),
		"rngs": rngs_out,
		"next_ids": _next_ids.duplicate(),
	}


static func from_dict(d: Dictionary) -> GameState:
	var s := GameState.new()
	s.campaign_id = String(d.get("campaign_id", ""))
	s.campaign_seed = String(d.get("campaign_seed", "0")).to_int()
	s.turn = int(d.get("turn", 1))
	s.phase = String(d.get("phase", ""))
	s.credits = int(d.get("credits", 0))
	s.crew_ids.assign(d.get("crew_ids", []))
	var people_in: Dictionary = d.get("people", {})
	for id in people_in:
		s.people[id] = Person.from_dict(people_in[id])
	s.chronicle = Chronicle.from_dict(d.get("chronicle", {}))
	s.orchestrator_results = Dictionary(d.get("orchestrator_results", {})).duplicate(true)
	var rngs_in: Dictionary = d.get("rngs", {})
	for stream in rngs_in:
		s._rngs[stream] = SimRng.from_dict(rngs_in[stream])
	var ids_in: Dictionary = d.get("next_ids", {})
	for prefix in ids_in:
		s._next_ids[prefix] = int(ids_in[prefix])
	return s
