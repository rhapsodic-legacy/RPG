class_name TestCase
extends RefCounted
## Base for test suites. Methods named test_* are run by tests/run_tests.gd.

var failures: Array[String] = []


func assert_true(condition: bool, message: String = "expected true") -> void:
	if not condition:
		failures.append(message)


func assert_eq(actual: Variant, expected: Variant, message: String = "") -> void:
	if typeof(actual) != typeof(expected) or actual != expected:
		failures.append("%s expected <%s>, got <%s>" % [message, str(expected), str(actual)])


func assert_almost(actual: float, expected: float, epsilon: float = 0.0001, message: String = "") -> void:
	if absf(actual - expected) > epsilon:
		failures.append("%s expected ~%f, got %f" % [message, expected, actual])


## Serialise through real JSON text, as saves do, so float/int coercions are exercised.
func json_round_trip(d: Dictionary) -> Dictionary:
	return JSON.parse_string(JSON.stringify(d))
