# Gatrix FlagProxy
# Thin convenience shell that delegates ALL variation logic to VariationProvider.
#
# Architecture per CLIENT_SDK_SPEC:
# - Property accessors: enabled/variant delegate to client for metrics tracking.
#   Other properties read flag data directly (read-only).
# - ALL variation / details / orThrow methods delegate to VariationProvider.
# - No type checking logic here - that's the VariationProvider's job.
# - No onAccess callback - metrics tracking handled by VariationProvider.
# - FlagProxy does NOT expose force_realtime; it is available only through
#   FeaturesClient's public methods for direct flag access.
#
# IMPORTANT: client (VariationProvider) is ALWAYS non-null. FlagProxy is
# exclusively created by FeaturesClient, which passes itself as the client.
class_name GatrixFlagProxy

var _flag: GatrixTypes.EvaluatedFlag
var _exists: bool = false
var _client  # VariationProvider (GatrixFeaturesClient)
var _flag_name: String = ""


func _init(flag, client, flag_name := "") -> void:
	_client = client
	if flag != null:
		# Deep-clone for immutable snapshot safety
		_flag = flag.duplicate()
		_exists = true
		_flag_name = flag_name if flag_name != "" else flag.name
	else:
		_flag = GatrixTypes.MISSING_FLAG
		_exists = false
		_flag_name = flag_name


# ==================== Properties ====================

var exists: bool:
	get: return _exists

var enabled: bool:
	get: return _client.is_enabled_internal(_flag_name)

var name: String:
	get: return _flag_name

var variant: GatrixTypes.Variant:
	get: return _client.get_variant_internal(_flag_name)

# Read-only metadata (no metrics needed)
var value_type: GatrixTypes.ValueType:
	get: return _flag.value_type

var version: int:
	get: return _flag.version

var reason: String:
	get: return _flag.reason

var impression_data: bool:
	get: return _flag.impression_data

var raw:
	get: return _flag if _exists else null


# ==================== Variation Methods (pure delegation) ====================

func variation(fallback_value: String) -> String:
	return _client.variation_internal(_flag_name, fallback_value)


func bool_variation(fallback_value: bool) -> bool:
	return _client.bool_variation_internal(_flag_name, fallback_value)


func string_variation(fallback_value: String) -> String:
	return _client.string_variation_internal(_flag_name, fallback_value)


func int_variation(fallback_value: int) -> int:
	return _client.int_variation_internal(_flag_name, fallback_value)


func float_variation(fallback_value: float) -> float:
	return _client.float_variation_internal(_flag_name, fallback_value)


func json_variation(fallback_value = null):
	return _client.json_variation_internal(_flag_name, fallback_value)


# ==================== Variation Details (pure delegation) ====================

func bool_variation_details(fallback_value: bool) -> GatrixTypes.VariationResult:
	return _client.bool_variation_details_internal(_flag_name, fallback_value)


func string_variation_details(fallback_value: String) -> GatrixTypes.VariationResult:
	return _client.string_variation_details_internal(_flag_name, fallback_value)


func int_variation_details(fallback_value: int) -> GatrixTypes.VariationResult:
	return _client.int_variation_details_internal(_flag_name, fallback_value)


func float_variation_details(fallback_value: float) -> GatrixTypes.VariationResult:
	return _client.float_variation_details_internal(_flag_name, fallback_value)


func json_variation_details(fallback_value = null) -> GatrixTypes.VariationResult:
	return _client.json_variation_details_internal(_flag_name, fallback_value)


# ==================== OrThrow Methods (pure delegation) ====================

func bool_variation_or_throw() -> bool:
	return _client.bool_variation_or_throw_internal(_flag_name)


func string_variation_or_throw() -> String:
	return _client.string_variation_or_throw_internal(_flag_name)


func int_variation_or_throw() -> int:
	return _client.int_variation_or_throw_internal(_flag_name)


func float_variation_or_throw() -> float:
	return _client.float_variation_or_throw_internal(_flag_name)


func json_variation_or_throw():
	return _client.json_variation_or_throw_internal(_flag_name)
