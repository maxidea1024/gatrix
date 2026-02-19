# Gatrix Watch Flag Group
# Batch management for multiple flag watchers
class_name GatrixWatchFlagGroup

var _features: GatrixFeaturesClient
var _name: String
var _unwatchers: Array = []  # Array[Callable]


func _init(features: GatrixFeaturesClient, group_name: String) -> void:
	_features = features
	_name = group_name


## Get the name of this watch group.
func get_group_name() -> String:
	return _name


## Watch a flag for realtime changes. Returns self for chaining.
func watch_realtime_flag(flag_name: String, callback: Callable) -> GatrixWatchFlagGroup:
	var unwatch := _features.watch_realtime_flag(flag_name, callback, "%s/%s" % [_name, flag_name])
	_unwatchers.append(unwatch)
	return self


## Watch a flag for realtime changes with initial state. Returns self for chaining.
func watch_realtime_flag_with_initial_state(flag_name: String, callback: Callable) -> GatrixWatchFlagGroup:
	var unwatch := _features.watch_realtime_flag_with_initial_state(flag_name, callback, "%s/%s" % [_name, flag_name])
	_unwatchers.append(unwatch)
	return self


## Watch a flag for synced changes. Returns self for chaining.
func watch_synced_flag(flag_name: String, callback: Callable) -> GatrixWatchFlagGroup:
	var unwatch := _features.watch_synced_flag(flag_name, callback, "%s/%s" % [_name, flag_name])
	_unwatchers.append(unwatch)
	return self


## Watch a flag for synced changes with initial state. Returns self for chaining.
func watch_synced_flag_with_initial_state(flag_name: String, callback: Callable) -> GatrixWatchFlagGroup:
	var unwatch := _features.watch_synced_flag_with_initial_state(flag_name, callback, "%s/%s" % [_name, flag_name])
	_unwatchers.append(unwatch)
	return self


## Unwatch all flags in this group.
func unwatch_all() -> void:
	for unwatch in _unwatchers:
		unwatch.call()
	_unwatchers.clear()


## Destroy the group (same as unwatch_all).
func destroy() -> void:
	unwatch_all()


## Get the number of active watchers in this group.
var size: int:
	get: return _unwatchers.size()
