# Gatrix Features Client
# Core SDK logic: HTTP fetching, ETag caching, polling, variations, watch, metrics
class_name GatrixFeaturesClient
extends RefCounted

const SDK_NAME := GatrixVersion.NAME
const SDK_VERSION := GatrixVersion.VERSION
const STORAGE_KEY_FLAGS := "gatrix_flags"
const STORAGE_KEY_ETAG := "gatrix_etag"

var _config: GatrixTypes.GatrixClientConfig
var _emitter: GatrixEventEmitter
var _storage: GatrixStorageProvider

# Thread-safe flag storage
var _mutex := Mutex.new()
var _realtime_flags: Dictionary = {}  # flag_name -> EvaluatedFlag
var _synchronized_flags: Dictionary = {}  # flag_name -> EvaluatedFlag

# State
var _sdk_state: GatrixTypes.SdkState = GatrixTypes.SdkState.INITIALIZING
var _ready_emitted := false
var _fetched_from_server := false
var _is_fetching := false
var _has_pending_sync := false
var _started := false
var _etag := ""
var _connection_id := ""

# HTTP
var _http_request: HTTPRequest = null
var _metrics_http: HTTPRequest = null
var _metrics_retry_count: int = 0
var _metrics_pending_payload: String = ""

# Timers
var _poll_timer: Timer = null
var _metrics_timer: Timer = null
var _metrics_initial_timer: Timer = null

# Statistics
var _stats := GatrixTypes.FeaturesStats.new()

# Per-flag watch callbacks
var _watch_handles: Dictionary = {}  # handle -> { flag_name, callback }
var _synced_watch_handles: Dictionary = {}  # handle -> { flag_name, callback }
var _next_watch_handle: int = 1

# Metrics tracking
var _metrics_mutex := Mutex.new()
var _metrics_flag_access: Dictionary = {}  # flag_name -> { "yes": n, "no": n, "variants": {} }
var _metrics_missing: Dictionary = {}  # flag_name -> count
var _metrics_start_time: String = ""

# Scene tree reference for timers
var _scene_tree: SceneTree = null


func initialize(config: GatrixTypes.GatrixClientConfig, emitter: GatrixEventEmitter,
		storage: GatrixStorageProvider, scene_tree: SceneTree) -> void:
	_config = config
	_emitter = emitter
	_storage = storage
	_scene_tree = scene_tree
	_connection_id = GatrixTypes.generate_uuid()
	_stats.start_time = Time.get_unix_time_from_system()


func _dev_log(message: String) -> void:
	if _config.enable_dev_mode:
		print("[GatrixSDK][DEV] %s" % message)


func start() -> void:
	if _started:
		return
	_started = true
	_dev_log("start() called. offlineMode=%s, refreshInterval=%.1f" % [_config.offline_mode, _config.refresh_interval])

	# Load from storage
	_load_from_storage()

	# Apply bootstrap if provided
	if _config.bootstrap.size() > 0:
		_apply_bootstrap()

	if not _config.offline_mode:
		# Initial fetch
		_do_fetch_flags()

		# Start polling
		if not _config.disable_refresh:
			_schedule_next_poll()

		# Start metrics
		if not _config.disable_metrics:
			_start_metrics()


func stop() -> void:
	if not _started:
		return
	_dev_log("stop() called")
	_started = false

	# Stop polling
	_stop_polling()

	# Send final metrics
	if not _config.disable_metrics:
		_send_metrics()
		_stop_metrics()


# ==================== Flag Access ====================

func _lookup_flag(flag_name: String, force_realtime: bool = false) -> GatrixTypes.EvaluatedFlag:
	_mutex.lock()
	var flags = _get_active_flags(force_realtime)
	var flag = flags.get(flag_name)
	_mutex.unlock()
	return flag


func has_flag(flag_name: String, force_realtime: bool = false) -> bool:
	return _lookup_flag(flag_name, force_realtime) != null


func _create_proxy(flag_name: String, force_realtime: bool = true) -> GatrixFlagProxy:
	var flag = _lookup_flag(flag_name, force_realtime)
	_track_flag_access(flag_name, flag, "watch", flag.variant.name if flag != null else "")
	return GatrixFlagProxy.new(self, flag_name, force_realtime)


func get_all_flags(force_realtime: bool = false) -> Array:
	_mutex.lock()
	var flags = _get_active_flags(force_realtime)
	var result: Array = flags.values()
	_mutex.unlock()
	return result


# ==================== Metadata Access Internal Methods ====================
# No metrics tracking — read-only metadata access for FlagProxy property delegation.

func has_flag_internal(flag_name: String, force_realtime: bool = false) -> bool:
	return _lookup_flag(flag_name, force_realtime) != null


func get_value_type_internal(flag_name: String, force_realtime: bool = false) -> int:
	var flag = _lookup_flag(flag_name, force_realtime)
	if flag == null:
		return GatrixTypes.ValueType.NONE
	return flag.value_type


func get_version_internal(flag_name: String, force_realtime: bool = false) -> int:
	var flag = _lookup_flag(flag_name, force_realtime)
	if flag == null:
		return 0
	return flag.version


func get_reason_internal(flag_name: String, force_realtime: bool = false) -> String:
	var flag = _lookup_flag(flag_name, force_realtime)
	if flag == null:
		return ""
	return flag.reason


func get_impression_data_internal(flag_name: String, force_realtime: bool = false) -> bool:
	var flag = _lookup_flag(flag_name, force_realtime)
	if flag == null:
		return false
	return flag.impression_data


func get_raw_flag_internal(flag_name: String, force_realtime: bool = false) -> GatrixTypes.EvaluatedFlag:
	return _lookup_flag(flag_name, force_realtime)


# ==================== VariationProvider Internal Methods ====================
# All flag lookup + value extraction + metrics tracking happen here.

func is_enabled_internal(flag_name: String, force_realtime: bool = false) -> bool:
	var flag = _lookup_flag(flag_name, force_realtime)
	if flag == null:
		_track_flag_access(flag_name, null, "isEnabled")
		return false
	_track_flag_access(flag_name, flag, "isEnabled", flag.variant.name)
	return flag.enabled


func get_variant_internal(flag_name: String, force_realtime: bool = false) -> GatrixTypes.Variant:
	var flag = _lookup_flag(flag_name, force_realtime)
	if flag == null:
		_track_flag_access(flag_name, null, "getVariant")
		return GatrixTypes.MISSING_VARIANT
	_track_flag_access(flag_name, flag, "getVariant", flag.variant.name)
	return flag.variant


func variation_internal(flag_name: String, fallback_value: String, force_realtime: bool = false) -> String:
	var flag = _lookup_flag(flag_name, force_realtime)
	if flag == null:
		_track_flag_access(flag_name, null, "getVariant")
		return fallback_value
	_track_flag_access(flag_name, flag, "getVariant", flag.variant.name)
	return flag.variant.name


func bool_variation_internal(flag_name: String, fallback_value: bool, force_realtime: bool = false) -> bool:
	var flag = _lookup_flag(flag_name, force_realtime)
	if flag == null:
		_track_flag_access(flag_name, null, "getVariant")
		return fallback_value
	_track_flag_access(flag_name, flag, "getVariant", flag.variant.name)
	if flag.value_type != GatrixTypes.ValueType.BOOLEAN:
		return fallback_value
	var val = flag.variant.value
	if val == null:
		return fallback_value
	if val is bool:
		return val
	if val is String:
		return val.to_lower() == "true"
	return fallback_value


func string_variation_internal(flag_name: String, fallback_value: String, force_realtime: bool = false) -> String:
	var flag = _lookup_flag(flag_name, force_realtime)
	if flag == null:
		_track_flag_access(flag_name, null, "getVariant")
		return fallback_value
	_track_flag_access(flag_name, flag, "getVariant", flag.variant.name)
	if flag.value_type != GatrixTypes.ValueType.STRING:
		return fallback_value
	var val = flag.variant.value
	if val == null:
		return fallback_value
	return str(val)


func int_variation_internal(flag_name: String, fallback_value: int, force_realtime: bool = false) -> int:
	var flag = _lookup_flag(flag_name, force_realtime)
	if flag == null:
		_track_flag_access(flag_name, null, "getVariant")
		return fallback_value
	_track_flag_access(flag_name, flag, "getVariant", flag.variant.name)
	if flag.value_type != GatrixTypes.ValueType.NUMBER:
		return fallback_value
	var val = flag.variant.value
	if val == null:
		return fallback_value
	if val is int or val is float:
		return int(val)
	if val is String and val.is_valid_int():
		return val.to_int()
	return fallback_value


func float_variation_internal(flag_name: String, fallback_value: float, force_realtime: bool = false) -> float:
	var flag = _lookup_flag(flag_name, force_realtime)
	if flag == null:
		_track_flag_access(flag_name, null, "getVariant")
		return fallback_value
	_track_flag_access(flag_name, flag, "getVariant", flag.variant.name)
	if flag.value_type != GatrixTypes.ValueType.NUMBER:
		return fallback_value
	var val = flag.variant.value
	if val == null:
		return fallback_value
	if val is int or val is float:
		return float(val)
	if val is String and val.is_valid_float():
		return val.to_float()
	return fallback_value


func json_variation_internal(flag_name: String, fallback_value = null, force_realtime: bool = false):
	var flag = _lookup_flag(flag_name, force_realtime)
	if flag == null:
		_track_flag_access(flag_name, null, "getVariant")
		return fallback_value
	_track_flag_access(flag_name, flag, "getVariant", flag.variant.name)
	if flag.value_type != GatrixTypes.ValueType.JSON:
		return fallback_value
	var val = flag.variant.value
	if val == null:
		return fallback_value
	if val is Dictionary or val is Array:
		return val
	# Try JSON string parsing
	if val is String:
		var json := JSON.new()
		if json.parse(val) == OK:
			return json.data
	return fallback_value


# -------------------- Variation Details Internal --------------------

func _make_details(flag_name: String, value, expected_type: String) -> GatrixTypes.VariationResult:
	var flag = _lookup_flag(flag_name)
	var exists := flag != null
	var r := flag.reason if exists else "flag_not_found"
	if exists and GatrixTypes.EvaluatedFlag._value_type_to_string(flag.value_type) != expected_type:
		r = "type_mismatch:expected_%s_got_%s" % [expected_type, GatrixTypes.EvaluatedFlag._value_type_to_string(flag.value_type)]
	return GatrixTypes.VariationResult.new(
		value, r, exists, flag.enabled if exists else false, flag.variant if exists else null
	)


func bool_variation_details_internal(flag_name: String, fallback_value: bool, force_realtime: bool = false) -> GatrixTypes.VariationResult:
	var value := bool_variation_internal(flag_name, fallback_value, force_realtime)
	return _make_details(flag_name, value, "boolean")


func string_variation_details_internal(flag_name: String, fallback_value: String, force_realtime: bool = false) -> GatrixTypes.VariationResult:
	var value := string_variation_internal(flag_name, fallback_value, force_realtime)
	return _make_details(flag_name, value, "string")


func int_variation_details_internal(flag_name: String, fallback_value: int, force_realtime: bool = false) -> GatrixTypes.VariationResult:
	var value := int_variation_internal(flag_name, fallback_value, force_realtime)
	return _make_details(flag_name, value, "number")


func float_variation_details_internal(flag_name: String, fallback_value: float, force_realtime: bool = false) -> GatrixTypes.VariationResult:
	var value := float_variation_internal(flag_name, fallback_value, force_realtime)
	return _make_details(flag_name, value, "number")


func json_variation_details_internal(flag_name: String, fallback_value = null, force_realtime: bool = false) -> GatrixTypes.VariationResult:
	var value = json_variation_internal(flag_name, fallback_value, force_realtime)
	return _make_details(flag_name, value, "json")


# -------------------- OrThrow Internal --------------------

func bool_variation_or_throw_internal(flag_name: String, force_realtime: bool = false) -> bool:
	var flag = _lookup_flag(flag_name, force_realtime)
	if flag == null:
		_track_flag_access(flag_name, null, "getVariant")
		push_error("[GatrixSDK] Flag '%s' not found" % flag_name)
		assert(false, "GatrixFeatureError: flag not found")
		return false
	_track_flag_access(flag_name, flag, "getVariant", flag.variant.name)
	if flag.value_type != GatrixTypes.ValueType.BOOLEAN:
		push_error("[GatrixSDK] Flag '%s' type mismatch: expected boolean, got %s" % [flag_name, GatrixTypes.EvaluatedFlag._value_type_to_string(flag.value_type)])
		assert(false, "GatrixFeatureError: type mismatch")
		return false
	var val = flag.variant.value
	if val == null:
		push_error("[GatrixSDK] Flag '%s' has no boolean value" % flag_name)
		assert(false, "GatrixFeatureError: no value")
		return false
	if val is bool:
		return val
	if val is String:
		return val.to_lower() == "true"
	push_error("[GatrixSDK] Flag '%s' value is not a valid boolean" % flag_name)
	assert(false, "GatrixFeatureError: invalid boolean")
	return false


func string_variation_or_throw_internal(flag_name: String, force_realtime: bool = false) -> String:
	var flag = _lookup_flag(flag_name, force_realtime)
	if flag == null:
		_track_flag_access(flag_name, null, "getVariant")
		push_error("[GatrixSDK] Flag '%s' not found" % flag_name)
		assert(false, "GatrixFeatureError: flag not found")
		return ""
	_track_flag_access(flag_name, flag, "getVariant", flag.variant.name)
	if flag.value_type != GatrixTypes.ValueType.STRING:
		push_error("[GatrixSDK] Flag '%s' type mismatch: expected string, got %s" % [flag_name, GatrixTypes.EvaluatedFlag._value_type_to_string(flag.value_type)])
		assert(false, "GatrixFeatureError: type mismatch")
		return ""
	var val = flag.variant.value
	if val == null:
		push_error("[GatrixSDK] Flag '%s' has no string value" % flag_name)
		assert(false, "GatrixFeatureError: no value")
		return ""
	return str(val)


func int_variation_or_throw_internal(flag_name: String, force_realtime: bool = false) -> int:
	var flag = _lookup_flag(flag_name, force_realtime)
	if flag == null:
		_track_flag_access(flag_name, null, "getVariant")
		push_error("[GatrixSDK] Flag '%s' not found" % flag_name)
		assert(false, "GatrixFeatureError: flag not found")
		return 0
	_track_flag_access(flag_name, flag, "getVariant", flag.variant.name)
	if flag.value_type != GatrixTypes.ValueType.NUMBER:
		push_error("[GatrixSDK] Flag '%s' type mismatch: expected number, got %s" % [flag_name, GatrixTypes.EvaluatedFlag._value_type_to_string(flag.value_type)])
		assert(false, "GatrixFeatureError: type mismatch")
		return 0
	var val = flag.variant.value
	if val == null:
		push_error("[GatrixSDK] Flag '%s' has no number value" % flag_name)
		assert(false, "GatrixFeatureError: no value")
		return 0
	if val is int or val is float:
		return int(val)
	if val is String and val.is_valid_int():
		return val.to_int()
	push_error("[GatrixSDK] Flag '%s' value is not a valid integer" % flag_name)
	assert(false, "GatrixFeatureError: invalid integer")
	return 0


func float_variation_or_throw_internal(flag_name: String, force_realtime: bool = false) -> float:
	var flag = _lookup_flag(flag_name, force_realtime)
	if flag == null:
		_track_flag_access(flag_name, null, "getVariant")
		push_error("[GatrixSDK] Flag '%s' not found" % flag_name)
		assert(false, "GatrixFeatureError: flag not found")
		return 0.0
	_track_flag_access(flag_name, flag, "getVariant", flag.variant.name)
	if flag.value_type != GatrixTypes.ValueType.NUMBER:
		push_error("[GatrixSDK] Flag '%s' type mismatch: expected number, got %s" % [flag_name, GatrixTypes.EvaluatedFlag._value_type_to_string(flag.value_type)])
		assert(false, "GatrixFeatureError: type mismatch")
		return 0.0
	var val = flag.variant.value
	if val == null:
		push_error("[GatrixSDK] Flag '%s' has no number value" % flag_name)
		assert(false, "GatrixFeatureError: no value")
		return 0.0
	if val is int or val is float:
		return float(val)
	if val is String and val.is_valid_float():
		return val.to_float()
	push_error("[GatrixSDK] Flag '%s' value is not a valid number" % flag_name)
	assert(false, "GatrixFeatureError: invalid number")
	return 0.0


func json_variation_or_throw_internal(flag_name: String, force_realtime: bool = false):
	var flag = _lookup_flag(flag_name, force_realtime)
	if flag == null:
		_track_flag_access(flag_name, null, "getVariant")
		push_error("[GatrixSDK] Flag '%s' not found" % flag_name)
		assert(false, "GatrixFeatureError: flag not found")
		return null
	_track_flag_access(flag_name, flag, "getVariant", flag.variant.name)
	if flag.value_type != GatrixTypes.ValueType.JSON:
		push_error("[GatrixSDK] Flag '%s' type mismatch: expected json, got %s" % [flag_name, GatrixTypes.EvaluatedFlag._value_type_to_string(flag.value_type)])
		assert(false, "GatrixFeatureError: type mismatch")
		return null
	var val = flag.variant.value
	if val == null:
		push_error("[GatrixSDK] Flag '%s' has no JSON value" % flag_name)
		assert(false, "GatrixFeatureError: no value")
		return null
	if val is Dictionary or val is Array:
		return val
	if val is String:
		var json := JSON.new()
		if json.parse(val) == OK:
			return json.data
	push_error("[GatrixSDK] Flag '%s' value is not valid JSON" % flag_name)
	assert(false, "GatrixFeatureError: invalid JSON")
	return null


# ==================== Public Methods (delegate to internal) ====================

func is_enabled(flag_name: String, force_realtime: bool = false) -> bool:
	return is_enabled_internal(flag_name, force_realtime)


func get_variant(flag_name: String, force_realtime: bool = false) -> GatrixTypes.Variant:
	return get_variant_internal(flag_name, force_realtime)


func variation(flag_name: String, fallback_value: String, force_realtime: bool = false) -> String:
	return variation_internal(flag_name, fallback_value, force_realtime)


func bool_variation(flag_name: String, fallback_value: bool, force_realtime: bool = false) -> bool:
	return bool_variation_internal(flag_name, fallback_value, force_realtime)


func string_variation(flag_name: String, fallback_value: String, force_realtime: bool = false) -> String:
	return string_variation_internal(flag_name, fallback_value, force_realtime)


func int_variation(flag_name: String, fallback_value: int, force_realtime: bool = false) -> int:
	return int_variation_internal(flag_name, fallback_value, force_realtime)


func float_variation(flag_name: String, fallback_value: float, force_realtime: bool = false) -> float:
	return float_variation_internal(flag_name, fallback_value, force_realtime)


func json_variation(flag_name: String, fallback_value = null, force_realtime: bool = false):
	return json_variation_internal(flag_name, fallback_value, force_realtime)


# Variation details - delegate
func bool_variation_details(flag_name: String, fallback_value: bool, force_realtime: bool = false) -> GatrixTypes.VariationResult:
	return bool_variation_details_internal(flag_name, fallback_value, force_realtime)


func string_variation_details(flag_name: String, fallback_value: String, force_realtime: bool = false) -> GatrixTypes.VariationResult:
	return string_variation_details_internal(flag_name, fallback_value, force_realtime)


func int_variation_details(flag_name: String, fallback_value: int, force_realtime: bool = false) -> GatrixTypes.VariationResult:
	return int_variation_details_internal(flag_name, fallback_value, force_realtime)


func float_variation_details(flag_name: String, fallback_value: float, force_realtime: bool = false) -> GatrixTypes.VariationResult:
	return float_variation_details_internal(flag_name, fallback_value, force_realtime)


func json_variation_details(flag_name: String, fallback_value = null, force_realtime: bool = false) -> GatrixTypes.VariationResult:
	return json_variation_details_internal(flag_name, fallback_value, force_realtime)


# OrThrow - delegate
func bool_variation_or_throw(flag_name: String, force_realtime: bool = false) -> bool:
	return bool_variation_or_throw_internal(flag_name, force_realtime)


func string_variation_or_throw(flag_name: String, force_realtime: bool = false) -> String:
	return string_variation_or_throw_internal(flag_name, force_realtime)


func int_variation_or_throw(flag_name: String, force_realtime: bool = false) -> int:
	return int_variation_or_throw_internal(flag_name, force_realtime)


func float_variation_or_throw(flag_name: String, force_realtime: bool = false) -> float:
	return float_variation_or_throw_internal(flag_name, force_realtime)


func json_variation_or_throw(flag_name: String, force_realtime: bool = false):
	return json_variation_or_throw_internal(flag_name, force_realtime)


# ==================== Context ====================

func update_context(new_context: GatrixTypes.GatrixContext) -> void:
	_config.context = new_context
	_stats.context_change_count += 1
	if _started and not _config.offline_mode:
		_do_fetch_flags()


func get_context() -> GatrixTypes.GatrixContext:
	return _config.context


# ==================== Explicit Sync ====================

func is_explicit_sync() -> bool:
	return _config.explicit_sync_mode


func can_sync_flags() -> bool:
	return _config.explicit_sync_mode and _has_pending_sync


func has_pending_sync_flags() -> bool:
	return _config.explicit_sync_mode and _has_pending_sync


func set_explicit_sync_mode(enabled: bool) -> void:
	if _config.explicit_sync_mode == enabled:
		return
	_config.explicit_sync_mode = enabled
	if enabled:
		_mutex.lock()
		_synchronized_flags = _realtime_flags.duplicate(true)
		_has_pending_sync = false
		_mutex.unlock()
	else:
		_has_pending_sync = false


func sync_flags(fetch_now := true) -> void:
	if not _config.explicit_sync_mode:
		return

	_stats.sync_flags_count += 1

	if fetch_now and not _config.offline_mode:
		_do_fetch_flags()

	_mutex.lock()
	var old_synced := _synchronized_flags.duplicate()
	_synchronized_flags = _realtime_flags.duplicate(true)
	_has_pending_sync = false
	_mutex.unlock()

	# Invoke synced watch callbacks
	_invoke_watch_callbacks(_synced_watch_handles, old_synced, _synchronized_flags, false)

	_emitter.emit_event(GatrixEvents.FLAGS_SYNC)
	_emitter.emit_event(GatrixEvents.FLAGS_CHANGE, [{ "flags": _synchronized_flags.values() }])


# ==================== Watch ====================

func watch_realtime_flag(flag_name: String, callback: Callable, watcher_name := "") -> Callable:
	var handle := _next_watch_handle
	_next_watch_handle += 1
	_watch_handles[handle] = { "flag_name": flag_name, "callback": callback, "name": watcher_name }

	# Return unwatch callable
	return func(): _watch_handles.erase(handle)


func watch_realtime_flag_with_initial_state(flag_name: String, callback: Callable, watcher_name := "") -> Callable:
	var unwatch := watch_realtime_flag(flag_name, callback, watcher_name)

	# Fire immediately with current state — always use realtimeFlags
	var proxy := _create_proxy(flag_name, true)
	callback.call(proxy)

	return unwatch


func watch_synced_flag(flag_name: String, callback: Callable, watcher_name := "") -> Callable:
	var handle := _next_watch_handle
	_next_watch_handle += 1
	_synced_watch_handles[handle] = { "flag_name": flag_name, "callback": callback, "name": watcher_name }

	# Return unwatch callable
	return func(): _synced_watch_handles.erase(handle)


func watch_synced_flag_with_initial_state(flag_name: String, callback: Callable, watcher_name := "") -> Callable:
	var unwatch := watch_synced_flag(flag_name, callback, watcher_name)

	# Fire immediately — respect explicitSyncMode for synced watchers
	var proxy := _create_proxy(flag_name, false)
	callback.call(proxy)

	return unwatch


# ==================== Fetch ====================

func fetch_flags() -> void:
	if not _config.offline_mode:
		_do_fetch_flags()


# ==================== Stats ====================

func get_stats() -> GatrixTypes.FeaturesStats:
	_mutex.lock()
	_stats.total_flag_count = _get_active_flags().size()
	_stats.sdk_state = _sdk_state
	_stats.etag = _etag
	_stats.offline_mode = _config.offline_mode
	_stats.missing_flags = _stats.missing_flags.duplicate()
	_stats.flag_enabled_counts = _stats.flag_enabled_counts.duplicate(true)
	_stats.flag_variant_counts = _stats.flag_variant_counts.duplicate(true)
	_stats.flag_last_changed_times = _stats.flag_last_changed_times.duplicate()
	var result := _stats
	_mutex.unlock()
	return result


func is_ready() -> bool:
	return _ready_emitted


# ==================== Internal Methods ====================

func _get_active_flags(force_realtime: bool = false) -> Dictionary:
	if force_realtime or not _config.explicit_sync_mode:
		return _realtime_flags
	return _synchronized_flags


func _load_from_storage() -> void:
	var stored = _storage.get_value(STORAGE_KEY_FLAGS)
	if stored != null and stored is Array:
		_mutex.lock()
		for flag_dict in stored:
			if flag_dict is Dictionary:
				var flag := GatrixTypes.EvaluatedFlag.from_dict(flag_dict)
				_realtime_flags[flag.name] = flag
				_synchronized_flags[flag.name] = flag
		_mutex.unlock()

		if _realtime_flags.size() > 0:
			_emitter.emit_event(GatrixEvents.FLAGS_INIT)

	var stored_etag = _storage.get_value(STORAGE_KEY_ETAG)
	if stored_etag is String:
		_etag = stored_etag


func _apply_bootstrap() -> void:
	if _config.bootstrap_override or _realtime_flags.is_empty():
		_mutex.lock()
		for flag in _config.bootstrap:
			_realtime_flags[flag.name] = flag
			_synchronized_flags[flag.name] = flag
		_mutex.unlock()

		if _realtime_flags.size() > 0:
			_emitter.emit_event(GatrixEvents.FLAGS_INIT)


func _do_fetch_flags() -> void:
	if _is_fetching:
		return
	_is_fetching = true
	_stats.fetch_flags_count += 1
	_stats.last_fetch_time = Time.get_unix_time_from_system()

	_emitter.emit_event(GatrixEvents.FLAGS_FETCH, [{ "etag": _etag }])
	_emitter.emit_event(GatrixEvents.FLAGS_FETCH_START, [{ "etag": _etag }])

	# Build URL
	var url := _build_fetch_url()

	# Create HTTP request node
	if _http_request == null:
		_http_request = HTTPRequest.new()
		_http_request.timeout = 30.0
		_scene_tree.root.call_deferred("add_child", _http_request)
		# Wait a frame for the node to be added
		await _scene_tree.process_frame

	# Set headers
	var headers: PackedStringArray = [
		"X-API-Token: %s" % _config.api_token,
		"Accept: application/json",
		"X-Application-Name: %s" % _config.app_name,
		"X-Environment: %s" % _config.environment,
		"X-Connection-Id: %s" % _connection_id,
		"X-SDK-Version: %s/%s" % [SDK_NAME, SDK_VERSION],
	]

	if _etag != "":
		headers.append("If-None-Match: %s" % _etag)

	for key in _config.custom_headers:
		headers.append("%s: %s" % [key, _config.custom_headers[key]])

	# Connect response handler
	if _http_request.request_completed.get_connections().size() > 0:
		for conn in _http_request.request_completed.get_connections():
			_http_request.request_completed.disconnect(conn.callable)
	_http_request.request_completed.connect(_on_fetch_completed)

	# Make request
	if _config.use_post_requests:
		var body := JSON.stringify({ "context": _config.context.to_dict() })
		headers.append("Content-Type: application/json")
		_http_request.request(url, headers, HTTPClient.METHOD_POST, body)
	else:
		_http_request.request(url, headers, HTTPClient.METHOD_GET)


func _on_fetch_completed(result: int, response_code: int, response_headers: PackedStringArray,
		body: PackedByteArray) -> void:
	_is_fetching = false

	if result != HTTPRequest.RESULT_SUCCESS:
		_handle_fetch_error("HTTP request failed (result=%d)" % result, response_code)
		return

	# 304 Not Modified
	if response_code == 304:
		_stats.not_modified_count += 1
		_emitter.emit_event(GatrixEvents.FLAGS_FETCH_SUCCESS)
		_emitter.emit_event(GatrixEvents.FLAGS_FETCH_END)

		# Recovery from error state
		if _sdk_state == GatrixTypes.SdkState.ERROR:
			_sdk_state = GatrixTypes.SdkState.HEALTHY
			_stats.recovery_count += 1
			_stats.last_recovery_time = Time.get_unix_time_from_system()
			_emitter.emit_event(GatrixEvents.FLAGS_RECOVERED)

		if not _ready_emitted:
			_set_ready()
		return

	# Success
	if response_code >= 200 and response_code < 300:
		var response_text := body.get_string_from_utf8()

		# Extract ETag from headers
		var new_etag := ""
		for header in response_headers:
			if header.to_lower().begins_with("etag:"):
				new_etag = header.substr(5).strip_edges()
				break

		_handle_fetch_response(response_text, response_code, new_etag)
	else:
		_handle_fetch_error("HTTP %d" % response_code, response_code)


func _handle_fetch_response(response_body: String, http_status: int, new_etag: String) -> void:
	var json := JSON.new()
	if json.parse(response_body) != OK:
		_handle_fetch_error("Invalid JSON response", http_status)
		return

	var data = json.data
	if not data is Dictionary:
		_handle_fetch_error("Response is not an object", http_status)
		return

	# Parse flags from response
	var flags_data = null
	if data.has("data") and data["data"] is Dictionary and data["data"].has("flags"):
		flags_data = data["data"]["flags"]
	elif data.has("flags"):
		flags_data = data["flags"]

	if flags_data == null or not flags_data is Array:
		_handle_fetch_error("No flags array in response", http_status)
		return

	# Parse flags
	var new_flags: Array = []
	for flag_dict in flags_data:
		if flag_dict is Dictionary:
			new_flags.append(GatrixTypes.EvaluatedFlag.from_dict(flag_dict))

	# Update ETag
	if new_etag != "":
		_etag = new_etag
		_storage.save_value(STORAGE_KEY_ETAG, _etag)

	# Store flags
	_store_flags(new_flags, not _fetched_from_server)
	_fetched_from_server = true

	_emitter.emit_event(GatrixEvents.FLAGS_FETCH_SUCCESS)
	_emitter.emit_event(GatrixEvents.FLAGS_FETCH_END)

	# Recovery from error state
	if _sdk_state == GatrixTypes.SdkState.ERROR:
		_sdk_state = GatrixTypes.SdkState.HEALTHY
		_stats.recovery_count += 1
		_stats.last_recovery_time = Time.get_unix_time_from_system()
		_emitter.emit_event(GatrixEvents.FLAGS_RECOVERED)

	if not _ready_emitted:
		_set_ready()


func _handle_fetch_error(message: String, status_code: int) -> void:
	_stats.error_count += 1
	_stats.last_error_time = Time.get_unix_time_from_system()
	_sdk_state = GatrixTypes.SdkState.ERROR

	var error_event := GatrixTypes.ErrorEvent.new()
	error_event.type = "fetch_error"
	error_event.message = message
	error_event.code = status_code

	_emitter.emit_event(GatrixEvents.FLAGS_FETCH_ERROR, [{ "status": status_code, "message": message }])
	_emitter.emit_event(GatrixEvents.FLAGS_FETCH_END)
	_emitter.emit_event(GatrixEvents.SDK_ERROR, [{ "type": "fetch_error", "message": message }])

	push_warning("[GatrixSDK] Fetch error: %s (status=%d)" % [message, status_code])

	# If first fetch failed but we have stored/bootstrap flags, still become ready
	if not _ready_emitted and _realtime_flags.size() > 0:
		_set_ready()


func _store_flags(new_flags: Array, is_initial_fetch: bool) -> void:
	_mutex.lock()
	var old_flags := _realtime_flags.duplicate()

	# Update realtime flags
	_realtime_flags.clear()
	for flag in new_flags:
		_realtime_flags[flag.name] = flag

	# Check for changes
	var changed := _flags_differ(old_flags, _realtime_flags)

	if changed:
		_stats.update_count += 1
		_stats.last_update_time = Time.get_unix_time_from_system()

		if _config.explicit_sync_mode:
			var was_pending := _has_pending_sync
			_has_pending_sync = true
			if not was_pending:
				_emitter.emit_event(GatrixEvents.FLAGS_PENDING_SYNC)
		else:
			_synchronized_flags = _realtime_flags.duplicate(true)
	else:
		_stats.not_modified_count += 1

	_mutex.unlock()

	# Persist to storage
	var flags_array: Array = []
	for flag in new_flags:
		flags_array.append(flag.to_dict())
	_storage.save_value(STORAGE_KEY_FLAGS, flags_array)

	# Emit change events
	if changed and not is_initial_fetch:
		_emit_flag_changes(old_flags, _realtime_flags)
		# Always invoke realtime watch callbacks
		_invoke_watch_callbacks(_watch_handles, old_flags, _realtime_flags, true)
		if not _config.explicit_sync_mode:
			# In non-explicit mode, also invoke synced callbacks
			_invoke_watch_callbacks(_synced_watch_handles, old_flags, _realtime_flags, false)
			_emitter.emit_event(GatrixEvents.FLAGS_CHANGE, [{ "flags": new_flags }])


func _flags_differ(old_flags: Dictionary, new_flags: Dictionary) -> bool:
	if old_flags.size() != new_flags.size():
		return true
	for key in new_flags:
		if not old_flags.has(key):
			return true
		var old_flag = old_flags[key]
		var new_flag = new_flags[key]
		if old_flag.version != new_flag.version or old_flag.enabled != new_flag.enabled:
			return true
		if old_flag.variant.name != new_flag.variant.name:
			return true
	return false


func _emit_flag_changes(old_flags: Dictionary, new_flags: Dictionary) -> void:
	for flag_name in new_flags:
		var new_flag = new_flags[flag_name]
		var old_flag = old_flags.get(flag_name)

		var changed := false
		if old_flag == null:
			changed = true
		elif old_flag.version != new_flag.version or old_flag.enabled != new_flag.enabled:
			changed = true
		elif old_flag.variant.name != new_flag.variant.name:
			changed = true

		if changed:
			var change_type := "created" if old_flag == null else "updated"
			_stats.flag_last_changed_times[flag_name] = Time.get_unix_time_from_system()

			# Per-flag change event (created/updated only)
			_emitter.emit_event(GatrixEvents.flag_change_event(flag_name),
					[new_flag, old_flag, change_type])

	# Detect removed flags - emit bulk event
	var removed_names: Array[String] = []
	for flag_name in old_flags:
		if not new_flags.has(flag_name):
			removed_names.append(flag_name)
	if removed_names.size() > 0:
		_emitter.emit_event(GatrixEvents.FLAGS_REMOVED, [removed_names])


func _invoke_watch_callbacks(handles: Dictionary, old_flags: Dictionary, new_flags: Dictionary, force_realtime: bool = false) -> void:
	for handle in handles:
		var watcher = handles[handle]
		var flag_name: String = watcher.flag_name
		var new_flag = new_flags.get(flag_name)
		var old_flag = old_flags.get(flag_name)

		var changed := false
		if new_flag != null and old_flag == null:
			changed = true
		elif new_flag != null and old_flag != null:
			if old_flag.version != new_flag.version:
				changed = true
		elif new_flag == null and old_flag != null:
			changed = true  # Flag removed

		if changed:
			var proxy := GatrixFlagProxy.new(self, flag_name, force_realtime)
			watcher.callback.call(proxy)


func _set_ready() -> void:
	_ready_emitted = true
	_sdk_state = GatrixTypes.SdkState.READY
	_emitter.emit_event(GatrixEvents.FLAGS_READY)


func _build_fetch_url() -> String:
	var base := _config.api_url.rstrip("/")
	var url := "%s/client/features/%s" % [base, _config.environment.uri_encode()]

	if not _config.use_post_requests:
		var ctx_qs := _config.context.to_query_string()
		if ctx_qs != "":
			url += "?" + ctx_qs

	return url


# ==================== Polling ====================

func _schedule_next_poll() -> void:
	if not _started or _config.disable_refresh:
		return

	if _poll_timer == null:
		_poll_timer = Timer.new()
		_poll_timer.one_shot = true
		_poll_timer.timeout.connect(_on_poll_timeout)
		_scene_tree.root.call_deferred("add_child", _poll_timer)

	_poll_timer.wait_time = _config.refresh_interval
	_poll_timer.call_deferred("start")


func _on_poll_timeout() -> void:
	if _started and not _config.disable_refresh:
		_do_fetch_flags()
		_schedule_next_poll()


func _stop_polling() -> void:
	if _poll_timer != null:
		_poll_timer.stop()


# ==================== Metrics ====================

func _track_flag_access(flag_name: String, flag, event_type: String, variant_name := "") -> void:
	if flag == null:
		_track_missing(flag_name)
		return

	var is_enabled: bool = flag.enabled

	# Metrics
	if not _config.disable_metrics:
		_metrics_mutex.lock()
		if not _metrics_flag_access.has(flag_name):
			_metrics_flag_access[flag_name] = { "yes": 0, "no": 0, "variants": {} }

		var entry = _metrics_flag_access[flag_name]
		if is_enabled:
			entry["yes"] += 1
		else:
			entry["no"] += 1

		if variant_name != "":
			if not entry["variants"].has(variant_name):
				entry["variants"][variant_name] = 0
			entry["variants"][variant_name] += 1
		_metrics_mutex.unlock()

	# Stats
	if not _config.disable_stats:
		if not _stats.flag_enabled_counts.has(flag_name):
			_stats.flag_enabled_counts[flag_name] = { "yes": 0, "no": 0 }
		if is_enabled:
			_stats.flag_enabled_counts[flag_name]["yes"] += 1
		else:
			_stats.flag_enabled_counts[flag_name]["no"] += 1

		if variant_name != "":
			if not _stats.flag_variant_counts.has(flag_name):
				_stats.flag_variant_counts[flag_name] = {}
			if not _stats.flag_variant_counts[flag_name].has(variant_name):
				_stats.flag_variant_counts[flag_name][variant_name] = 0
			_stats.flag_variant_counts[flag_name][variant_name] += 1

	# Impression
	if flag.impression_data or _config.impression_data_all:
		_track_impression(flag_name, is_enabled, variant_name, flag)


func _track_missing(flag_name: String) -> void:
	if _config.disable_metrics:
		return

	_metrics_mutex.lock()
	if not _metrics_missing.has(flag_name):
		_metrics_missing[flag_name] = 0
	_metrics_missing[flag_name] += 1

	if not _config.disable_stats:
		if not _stats.missing_flags.has(flag_name):
			_stats.missing_flags[flag_name] = 0
		_stats.missing_flags[flag_name] += 1
	_metrics_mutex.unlock()


func _track_impression(flag_name: String, enabled: bool, variant_name: String,
		flag: GatrixTypes.EvaluatedFlag) -> void:
	if not flag.impression_data and not _config.impression_data_all:
		return

	_stats.impression_count += 1

	var event := GatrixTypes.ImpressionEvent.new()
	event.event_type = "isEnabled"
	event.event_id = GatrixTypes.generate_uuid()
	event.context = _config.context
	event.enabled = enabled
	event.feature_name = flag_name
	event.impression_data = flag.impression_data
	event.variant_name = variant_name

	_emitter.emit_event(GatrixEvents.FLAGS_IMPRESSION, [event.to_dict()])


func _start_metrics() -> void:
	_metrics_start_time = Time.get_datetime_string_from_system(true)

	# Initial delay
	_metrics_initial_timer = Timer.new()
	_metrics_initial_timer.one_shot = true
	_metrics_initial_timer.wait_time = _config.metrics_interval_initial
	_metrics_initial_timer.timeout.connect(_on_metrics_initial_timeout)
	_scene_tree.root.call_deferred("add_child", _metrics_initial_timer)
	_metrics_initial_timer.call_deferred("start")


func _on_metrics_initial_timeout() -> void:
	_send_metrics()

	# Start periodic timer
	_metrics_timer = Timer.new()
	_metrics_timer.wait_time = _config.metrics_interval
	_metrics_timer.timeout.connect(_on_metrics_timeout)
	_scene_tree.root.call_deferred("add_child", _metrics_timer)
	_metrics_timer.call_deferred("start")


func _on_metrics_timeout() -> void:
	_send_metrics()


func _stop_metrics() -> void:
	if _metrics_timer != null:
		_metrics_timer.stop()
	if _metrics_initial_timer != null:
		_metrics_initial_timer.stop()


func _send_metrics() -> void:
	var payload := _build_metrics_payload()
	if payload == "":
		return

	_metrics_retry_count = 0
	_metrics_pending_payload = payload
	_do_send_metrics(payload)


func _do_send_metrics(payload: String) -> void:
	if _metrics_http == null:
		_metrics_http = HTTPRequest.new()
		_metrics_http.timeout = 10.0
		_scene_tree.root.call_deferred("add_child", _metrics_http)
		await _scene_tree.process_frame

	var url := "%s/client/features/%s/metrics" % [
		_config.api_url.rstrip("/"),
		_config.environment.uri_encode()
	]

	var headers: PackedStringArray = [
		"X-API-Token: %s" % _config.api_token,
		"Content-Type: application/json",
		"X-Application-Name: %s" % _config.app_name,
		"X-Connection-Id: %s" % _connection_id,
		"X-SDK-Version: %s/%s" % [SDK_NAME, SDK_VERSION],
	]

	for key in _config.custom_headers:
		headers.append("%s: %s" % [key, _config.custom_headers[key]])

	if _metrics_http.request_completed.get_connections().size() > 0:
		for conn in _metrics_http.request_completed.get_connections():
			_metrics_http.request_completed.disconnect(conn.callable)
	_metrics_http.request_completed.connect(_on_metrics_completed)

	_metrics_http.request(url, headers, HTTPClient.METHOD_POST, payload)


func _on_metrics_completed(result: int, response_code: int, _headers: PackedStringArray,
		_body: PackedByteArray) -> void:
	if result == HTTPRequest.RESULT_SUCCESS and response_code >= 200 and response_code < 300:
		_stats.metrics_sent_count += 1
		_emitter.emit_event(GatrixEvents.FLAGS_METRICS_SENT, [{ "count": 1 }])
	else:
		# Retry on retryable status codes
		var retryable := result != HTTPRequest.RESULT_SUCCESS or \
			response_code == 408 or response_code == 429 or response_code >= 500
		if retryable and _metrics_retry_count < 2:
			_metrics_retry_count += 1
			var delay := pow(2.0, _metrics_retry_count)
			await _scene_tree.create_timer(delay).timeout
			_do_send_metrics(_metrics_pending_payload)
			return

		_stats.metrics_error_count += 1
		push_warning("[GatrixSDK] Metrics send failed (result=%d, status=%d)" % [result, response_code])


func _build_metrics_payload() -> String:
	_metrics_mutex.lock()
	var flag_access_copy := _metrics_flag_access.duplicate(true)
	var missing_copy := _metrics_missing.duplicate()
	var start_time := _metrics_start_time
	_metrics_flag_access.clear()
	_metrics_missing.clear()
	_metrics_start_time = Time.get_datetime_string_from_system(true)
	_metrics_mutex.unlock()

	if flag_access_copy.is_empty() and missing_copy.is_empty():
		return ""

	var stop_time := Time.get_datetime_string_from_system(true)

	var payload := {
		"appName": _config.app_name,
		"environment": _config.environment,
		"sdkName": SDK_NAME,
		"sdkVersion": SDK_VERSION,
		"connectionId": _connection_id,
		"bucket": {
			"start": start_time,
			"stop": stop_time,
			"flags": flag_access_copy,
			"missing": missing_copy,
		}
	}

	return JSON.stringify(payload)


