class_name SaveCodec
extends RefCounted
## Versioned JSON encoding for campaign and profile saves. File IO lives in the game layer.
## When a saved shape changes: bump SCHEMA_VERSION on the state class and add a step in _migrate_step.

const KIND_CAMPAIGN := "campaign"
const KIND_PROFILE := "profile"


static func encode_campaign(state: GameState) -> String:
	return JSON.stringify(state.to_dict(), "\t")


## Null when the text is not a readable save.
static func decode_campaign(text: String) -> GameState:
	var d: Variant = JSON.parse_string(text)
	if not d is Dictionary:
		return null
	return GameState.from_dict(migrate(d, KIND_CAMPAIGN, GameState.SCHEMA_VERSION))


static func encode_profile(profile: ProfileState) -> String:
	return JSON.stringify(profile.to_dict(), "\t")


static func decode_profile(text: String) -> ProfileState:
	var d: Variant = JSON.parse_string(text)
	if not d is Dictionary:
		return null
	return ProfileState.from_dict(migrate(d, KIND_PROFILE, ProfileState.SCHEMA_VERSION))


static func migrate(d: Dictionary, kind: String, target_version: int) -> Dictionary:
	var version := int(d.get("schema_version", 1))
	assert(version <= target_version, "%s save is from a newer game version" % kind)
	while version < target_version:
		d = _migrate_step(kind, version, d)
		version += 1
		d["schema_version"] = version
	return d


# One step from from_version to from_version + 1. No migrations exist yet.
static func _migrate_step(kind: String, from_version: int, d: Dictionary) -> Dictionary:
	match "%s:%d" % [kind, from_version]:
		_:
			push_error("No migration for %s save v%d" % [kind, from_version])
	return d
