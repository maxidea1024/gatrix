# Gatrix FlagProxy
# Convenience wrapper for accessing flag values with typed variations
class_name GatrixFlagProxy

var _flag  # GatrixTypes.EvaluatedFlag or null
var _exists: bool = false


func _init(flag = null) -> void:
	if flag != null:
		_flag = flag
		_exists = true
	else:
		_flag = GatrixTypes.EvaluatedFlag.new()
		_exists = false


# ==================== Properties ====================

var exists: bool:
	get: return _exists

var enabled: bool:
	get: return _flag.enabled if _exists else false

var name: String:
	get: return _flag.name if _exists else ""

var variant: GatrixTypes.Variant:
	get: return _flag.variant if _exists else GatrixTypes.Variant.disabled()

var variant_type: GatrixTypes.VariantType:
	get: return _flag.variant_type if _exists else GatrixTypes.VariantType.NONE

var version: int:
	get: return _flag.version if _exists else 0

var reason: String:
	get: return _flag.reason if _exists else ""

var impression_data: bool:
	get: return _flag.impression_data if _exists else false

var raw:
	get: return _flag if _exists else null


# ==================== Variation Methods ====================

# Get boolean variation (flag enabled state)
func bool_variation(default_value: bool) -> bool:
	if not _exists:
		return default_value
	return _flag.enabled


# Get string variation from variant payload
func string_variation(default_value: String) -> String:
	if not _exists or not _flag.enabled:
		return default_value
	var payload: String = _flag.variant.payload
	return payload if payload != "" else default_value


# Get number variation from variant payload
func number_variation(default_value: float) -> float:
	if not _exists or not _flag.enabled:
		return default_value
	var payload: String = _flag.variant.payload
	if payload == "":
		return default_value
	if payload.is_valid_float():
		return payload.to_float()
	if payload.is_valid_int():
		return float(payload.to_int())
	return default_value


# Get JSON variation (parsed as Variant - returns Dictionary or Array)
func json_variation(default_value = null):
	if not _exists or not _flag.enabled:
		return default_value
	var payload: String = _flag.variant.payload
	if payload == "":
		return default_value
	var json := JSON.new()
	if json.parse(payload) == OK:
		return json.data
	return default_value


# Get variant name (variation)
func variation(default_value: String) -> String:
	if not _exists or not _flag.enabled:
		return default_value
	return _flag.variant.name if _flag.variant.name != "" else default_value


# ==================== Variation Details ====================

func bool_variation_details(default_value: bool) -> GatrixTypes.VariationResult:
	return GatrixTypes.VariationResult.new(
		bool_variation(default_value),
		_flag.reason if _exists else "not_found",
		_exists,
		_flag.enabled if _exists else false
	)


func string_variation_details(default_value: String) -> GatrixTypes.VariationResult:
	return GatrixTypes.VariationResult.new(
		string_variation(default_value),
		_flag.reason if _exists else "not_found",
		_exists,
		_flag.enabled if _exists else false
	)


func number_variation_details(default_value: float) -> GatrixTypes.VariationResult:
	return GatrixTypes.VariationResult.new(
		number_variation(default_value),
		_flag.reason if _exists else "not_found",
		_exists,
		_flag.enabled if _exists else false
	)


func json_variation_details(default_value = null) -> GatrixTypes.VariationResult:
	return GatrixTypes.VariationResult.new(
		json_variation(default_value),
		_flag.reason if _exists else "not_found",
		_exists,
		_flag.enabled if _exists else false
	)


# ==================== Strict Variations (throw on error) ====================

func bool_variation_or_throw() -> bool:
	if not _exists:
		push_error("[GatrixSDK] Flag '%s' not found" % _flag.name)
		assert(false, "GatrixFeatureError: flag not found")
	if not _flag.enabled:
		push_error("[GatrixSDK] Flag '%s' is disabled" % _flag.name)
		assert(false, "GatrixFeatureError: flag disabled")
	return _flag.enabled


func string_variation_or_throw() -> String:
	if not _exists:
		push_error("[GatrixSDK] Flag '%s' not found" % _flag.name)
		assert(false, "GatrixFeatureError: flag not found")
	if not _flag.enabled:
		push_error("[GatrixSDK] Flag '%s' is disabled" % _flag.name)
		assert(false, "GatrixFeatureError: flag disabled")
	return _flag.variant.payload


func number_variation_or_throw() -> float:
	var s := string_variation_or_throw()
	if s.is_valid_float():
		return s.to_float()
	if s.is_valid_int():
		return float(s.to_int())
	push_error("[GatrixSDK] Flag '%s' payload is not a number" % _flag.name)
	assert(false, "GatrixFeatureError: invalid number payload")
	return 0.0


func json_variation_or_throw():
	var s := string_variation_or_throw()
	var json := JSON.new()
	if json.parse(s) == OK:
		return json.data
	push_error("[GatrixSDK] Flag '%s' payload is not valid JSON" % _flag.name)
	assert(false, "GatrixFeatureError: invalid JSON payload")
	return null
