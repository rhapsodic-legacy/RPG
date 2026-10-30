extends OrchestratorPort
## Test double: answers by purpose with canned JSON, and records what was submitted.

var answers_by_purpose: Dictionary = {}
var submitted: Array[String] = []
var _purpose_by_key: Dictionary = {}


func is_available() -> bool:
	return true


func submit(request: OrchestratorRequest) -> void:
	submitted.append(request.key())
	_purpose_by_key[request.key()] = request.purpose


func collect(request_key: String) -> Variant:
	return answers_by_purpose.get(_purpose_by_key.get(request_key, ""))
