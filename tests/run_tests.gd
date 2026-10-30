extends SceneTree
## Headless test runner. Usage: godot --headless --path . -s tests/run_tests.gd

const SUITE_DIRS := ["res://tests/core"]


func _init() -> void:
	var total := 0
	var failed := 0
	for dir_path in SUITE_DIRS:
		for file_name in DirAccess.get_files_at(dir_path):
			if not (file_name.begins_with("test_") and file_name.ends_with(".gd")):
				continue
			var script: GDScript = load(dir_path + "/" + file_name)
			for method in script.get_script_method_list():
				var method_name: String = method.name
				if not method_name.begins_with("test_"):
					continue
				total += 1
				var suite: TestCase = script.new()
				suite.call(method_name)
				if suite.failures.is_empty():
					print("  ok    %s :: %s" % [file_name, method_name])
				else:
					failed += 1
					for failure in suite.failures:
						printerr("  FAIL  %s :: %s  %s" % [file_name, method_name, failure])
	print("\n%d tests, %d failed" % [total, failed])
	quit(1 if failed > 0 or total == 0 else 0)
