extends SceneTree
## Headless test runner. Usage: godot --headless --path . -s tests/run_tests.gd


func _init() -> void:
	var result := TestRunner.run_all()
	for line in result.lines:
		if line.begins_with("  FAIL"):
			printerr(line)
		else:
			print(line)
	quit(1 if result.failed > 0 or result.total == 0 else 0)
