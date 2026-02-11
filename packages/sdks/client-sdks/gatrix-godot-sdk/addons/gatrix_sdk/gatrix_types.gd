# Gatrix SDK Type Definitions
class_name GatrixTypes


# SDK State
enum SdkState { INITIALIZING, READY, HEALTHY, ERROR }

# Value type for variant
enum ValueType { NONE, BOOLEAN, STRING, NUMBER, JSON }


# Variant information from server evaluation
class Variant:
	var name: String = "$disabled"
	var enabled: bool = false
	var value = null  # Dynamic type: bool, string, float, Dictionary, Array, or null

	func _init(p_name := "$disabled", p_enabled := false, p_value = null) -> void:
		name = p_name
		enabled = p_enabled
		value = p_value

	static func missing() -> Variant:
		return Variant.new("$missing", false, null)

	static func disabled() -> Variant:
		return Variant.new("$disabled", false, null)

	func to_dict() -> Dictionary:
		return { "name": name, "enabled": enabled, "value": value }

	static func from_dict(d: Dictionary) -> Variant:
		# Support both 'value' (new) and 'payload' (legacy)
		var val = d.get("value", d.get("payload"))
		return Variant.new(
			d.get("name", "$disabled"),
			d.get("enabled", false),
			val
		)


# Sentinel values
static var MISSING_VARIANT := Variant.missing()
static var DISABLED_VARIANT := Variant.disabled()


# Evaluated feature flag from the server
class EvaluatedFlag:
	var name: String = ""
	var enabled: bool = false
	var variant: Variant = Variant.disabled()
	var value_type: ValueType = ValueType.NONE
	var version: int = 0
	var reason: String = ""
	var impression_data: bool = false

	func to_dict() -> Dictionary:
		return {
			"name": name,
			"enabled": enabled,
			"variant": variant.to_dict(),
			"valueType": _value_type_to_string(value_type),
			"version": version,
			"reason": reason,
			"impressionData": impression_data,
		}

	static func from_dict(d: Dictionary) -> EvaluatedFlag:
		var flag := EvaluatedFlag.new()
		flag.name = d.get("name", "")
		flag.enabled = d.get("enabled", false)
		flag.version = d.get("version", 0)
		flag.reason = d.get("reason", "")
		flag.impression_data = d.get("impressionData", false)

		# Support both 'valueType' (new) and 'variantType' (legacy)
		var vt_str: String = d.get("valueType", d.get("variantType", "none"))
		flag.value_type = _string_to_value_type(vt_str)

		var v_dict = d.get("variant", {})
		if v_dict is Dictionary:
			flag.variant = Variant.from_dict(v_dict)
		else:
			flag.variant = Variant.disabled()

		return flag

	static func _value_type_to_string(vt: ValueType) -> String:
		match vt:
			ValueType.BOOLEAN: return "boolean"
			ValueType.STRING: return "string"
			ValueType.NUMBER: return "number"
			ValueType.JSON: return "json"
			_: return "none"

	static func _string_to_value_type(s: String) -> ValueType:
		match s.to_lower():
			"boolean": return ValueType.BOOLEAN
			"string": return ValueType.STRING
			"number": return ValueType.NUMBER
			"json": return ValueType.JSON
			_: return ValueType.NONE


# Missing flag sentinel
static var MISSING_FLAG := _create_missing_flag()

static func _create_missing_flag() -> EvaluatedFlag:
	var f := EvaluatedFlag.new()
	f.name = ""
	f.enabled = false
	f.variant = Variant.missing()
	f.value_type = ValueType.NONE
	return f


# Evaluation context (global for client-side)
class GatrixContext:
	var user_id: String = ""
	var session_id: String = ""
	var current_time: String = ""
	var properties: Dictionary = {}

	func to_dict() -> Dictionary:
		var d := {}
		if user_id != "": d["userId"] = user_id
		if session_id != "": d["sessionId"] = session_id
		if current_time != "": d["currentTime"] = current_time
		for key in properties:
			d[key] = properties[key]
		return d

	func to_query_string() -> String:
		var parts: PackedStringArray = []
		if user_id != "": parts.append("userId=%s" % user_id.uri_encode())
		if session_id != "": parts.append("sessionId=%s" % session_id.uri_encode())
		if current_time != "": parts.append("currentTime=%s" % current_time.uri_encode())
		for key in properties:
			parts.append("properties[%s]=%s" % [key.uri_encode(), str(properties[key]).uri_encode()])
		return "&".join(parts)


# Variation result with details
class VariationResult:
	var value  # Can be bool, string, float, int, Dictionary, Array
	var reason: String = ""
	var flag_exists: bool = false
	var enabled: bool = false
	var variant: Variant = null

	func _init(p_value = null, p_reason := "", p_exists := false, p_enabled := false, p_variant: Variant = null) -> void:
		value = p_value
		reason = p_reason
		flag_exists = p_exists
		enabled = p_enabled
		variant = p_variant


# Impression event data
class ImpressionEvent:
	var event_type: String = "isEnabled"
	var event_id: String = ""
	var context: GatrixContext = GatrixContext.new()
	var enabled: bool = false
	var feature_name: String = ""
	var impression_data: bool = false
	var variant_name: String = ""
	var reason: String = ""

	func to_dict() -> Dictionary:
		return {
			"eventType": event_type,
			"eventId": event_id,
			"context": context.to_dict(),
			"enabled": enabled,
			"featureName": feature_name,
			"impressionData": impression_data,
			"variant": variant_name,
			"reason": reason,
		}


# Error event payload
class ErrorEvent:
	var type: String = ""
	var message: String = ""
	var code: int = 0


# SDK Configuration
class GatrixClientConfig:
	# Required
	var api_url: String = "http://localhost:3400/api/v1"
	var api_token: String = ""
	var app_name: String = ""
	var environment: String = ""

	# Optional - Polling
	var refresh_interval: float = 30.0
	var disable_refresh: bool = false

	# Optional - Context
	var context: GatrixContext = GatrixContext.new()

	# Optional - Sync Mode
	var explicit_sync_mode: bool = false

	# Optional - Offline Mode
	var offline_mode: bool = false

	# Optional - Bootstrap
	var bootstrap: Array = []  # Array[EvaluatedFlag]
	var bootstrap_override: bool = true

	# Optional - Advanced
	var custom_headers: Dictionary = {}
	var disable_metrics: bool = false
	var disable_stats: bool = false
	var impression_data_all: bool = false
	var use_post_requests: bool = false

	# Metrics intervals
	var metrics_interval_initial: float = 2.0
	var metrics_interval: float = 60.0

	# Fetch retry options
	var non_retryable_status_codes: Array[int] = [401, 403]
	var initial_backoff_ms: int = 1000
	var max_backoff_ms: int = 60000

	# Debug / Storage
	var enable_dev_mode: bool = false
	var cache_key_prefix: String = "gatrix_cache"


# Feature flag statistics
class FeaturesStats:
	var total_flag_count: int = 0
	var fetch_flags_count: int = 0
	var update_count: int = 0
	var not_modified_count: int = 0
	var error_count: int = 0
	var recovery_count: int = 0
	var impression_count: int = 0
	var context_change_count: int = 0
	var sync_flags_count: int = 0
	var metrics_sent_count: int = 0
	var metrics_error_count: int = 0
	var etag: String = ""

	# Timestamps
	var start_time: float = 0.0
	var last_fetch_time: float = 0.0
	var last_update_time: float = 0.0
	var last_error_time: float = 0.0
	var last_recovery_time: float = 0.0

	# State
	var sdk_state: SdkState = SdkState.INITIALIZING
	var offline_mode: bool = false

	# Per-flag data
	var missing_flags: Dictionary = {}  # flag_name -> count
	var flag_enabled_counts: Dictionary = {}  # flag_name -> { "yes": n, "no": n }
	var flag_variant_counts: Dictionary = {}  # flag_name -> { variant_name: count }
	var flag_last_changed_times: Dictionary = {}  # flag_name -> timestamp


# ==================== Utility ====================

static func generate_uuid() -> String:
	var uuid := ""
	var chars := "0123456789abcdef"
	var pattern := "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"
	for c in pattern:
		if c == "x":
			uuid += chars[randi() % 16]
		elif c == "y":
			uuid += chars[(randi() % 4) + 8]
		else:
			uuid += c
	return uuid
