class_name SaveStore
extends RefCounted
## Disk IO for saves. Encoding and migrations live in core (SaveCodec); this only reads and writes files.

const PROFILE_PATH := "user://profile.json"
const CAMPAIGN_DIR := "user://campaigns"


static func save_campaign(state: GameState) -> Error:
	DirAccess.make_dir_recursive_absolute(CAMPAIGN_DIR)
	return _write("%s/%s.json" % [CAMPAIGN_DIR, state.campaign_id], SaveCodec.encode_campaign(state))


static func load_campaign(campaign_id: String) -> GameState:
	var path := "%s/%s.json" % [CAMPAIGN_DIR, campaign_id]
	if not FileAccess.file_exists(path):
		return null
	return SaveCodec.decode_campaign(FileAccess.get_file_as_string(path))


static func save_profile(profile: ProfileState) -> Error:
	return _write(PROFILE_PATH, SaveCodec.encode_profile(profile))


static func load_profile() -> ProfileState:
	if not FileAccess.file_exists(PROFILE_PATH):
		return ProfileState.new()
	var profile := SaveCodec.decode_profile(FileAccess.get_file_as_string(PROFILE_PATH))
	return profile if profile != null else ProfileState.new()


# Write to a temp file, then rename, so a crash mid-save never corrupts the previous save.
static func _write(path: String, text: String) -> Error:
	var tmp := path + ".tmp"
	var f := FileAccess.open(tmp, FileAccess.WRITE)
	if f == null:
		return FileAccess.get_open_error()
	f.store_string(text)
	f.close()
	return DirAccess.rename_absolute(tmp, path)
