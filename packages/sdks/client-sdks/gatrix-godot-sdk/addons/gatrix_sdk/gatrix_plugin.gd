@tool
extends EditorPlugin

# Gatrix SDK plugin for Godot Engine

func _enter_tree() -> void:
	# Register autoload singleton
	add_autoload_singleton("GatrixClient", "res://addons/gatrix_sdk/gatrix_client.gd")
	print("[GatrixSDK] Plugin enabled")


func _exit_tree() -> void:
	remove_autoload_singleton("GatrixClient")
	print("[GatrixSDK] Plugin disabled")
