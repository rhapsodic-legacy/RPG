extends Control
## Open tests/test_scene.tscn in the editor and press "Run Current Scene" (F6 / Cmd+R) to run all tests.


func _ready() -> void:
	var result := TestRunner.run_all()
	var label := RichTextLabel.new()
	label.set_anchors_preset(Control.PRESET_FULL_RECT)
	label.offset_left = 16
	label.offset_top = 16
	for line in result.lines:
		var color := "red" if line.begins_with("  FAIL") else "white"
		label.append_text("[color=%s]%s[/color]\n" % [color, line.replace("[", "[lb]")])
		print(line)
	add_child(label)
