class_name ProfileState
extends RefCounted
## Data shared by every campaign on this player profile: legends, the outpost, unlocks.

const SCHEMA_VERSION := 1

## Retired crew from past campaigns. They can appear in later campaigns as NPCs. id -> Person
var legends: Dictionary = {}
## Outpost (moon base) facilities and stored heirlooms. Shape is defined in M5.
var outpost: Dictionary = {}
var unlocks: Array[String] = []


## Copies the person out of their campaign; the campaign keeps its own record unchanged.
func enshrine(person: Person) -> Person:
	var legend := Person.from_dict(person.to_dict())
	legend.role = Person.ROLE_LEGEND
	legend.status = Person.STATUS_RETIRED
	legends[legend.id_for_profile()] = legend
	return legend


func to_dict() -> Dictionary:
	var legends_out := {}
	for key in legends:
		legends_out[key] = (legends[key] as Person).to_dict()
	return {
		"schema_version": SCHEMA_VERSION,
		"legends": legends_out,
		"outpost": outpost.duplicate(true),
		"unlocks": Array(unlocks),
	}


static func from_dict(d: Dictionary) -> ProfileState:
	var p := ProfileState.new()
	var legends_in: Dictionary = d.get("legends", {})
	for key in legends_in:
		p.legends[key] = Person.from_dict(legends_in[key])
	p.outpost = Dictionary(d.get("outpost", {})).duplicate(true)
	p.unlocks.assign(d.get("unlocks", []))
	return p
