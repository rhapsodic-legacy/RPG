class_name TestRunner
extends RefCounted
## Finds and runs every test_*.gd suite. Shared by the headless CLI runner and the in-editor test scene.

const SUITE_DIRS := ["res://tests/core"]


## Returns {"total": int, "failed": int, "lines": Array[String]}.
static func run_all() -> Dictionary:
	var total := 0
	var failed := 0
	var lines: Array[String] = []
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
					lines.append("  ok    %s :: %s" % [file_name, method_name])
				else:
					failed += 1
					for failure in suite.failures:
						lines.append("  FAIL  %s :: %s  %s" % [file_name, method_name, failure])
	lines.append("")
	lines.append("%d tests, %d failed" % [total, failed])
	return {"total": total, "failed": failed, "lines": lines}
