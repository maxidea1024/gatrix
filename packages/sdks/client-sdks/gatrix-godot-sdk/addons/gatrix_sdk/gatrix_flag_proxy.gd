## FlagProxy - Thin shell that delegates ALL logic to FeaturesClient.
##
## Architecture per CLIENT_SDK_SPEC:
## - Holds only flag_name + force_realtime + client reference.
## - ALL property reads and variation methods delegate to the client.
## - No deep copy of flag data - always reads live state from FeaturesClient cache.
## - is_realtime property indicates the proxy's operational mode.
## - Client is always present (never null).
class_name GatrixFlagProxy
extends RefCounted

var _client  # GatrixFeaturesClient (VariationProvider)
var _flag_name: String = ""
var _force_realtime: bool = false


func _init(client, flag_name: String, force_realtime: bool = false) -> void:
	assert(client != null, "FlagProxy: client must not be null")
	_client = client
	_flag_name = flag_name if flag_name else ""
	_force_realtime = force_realtime


# ==================== Properties ====================

var name: String:
	get: return _flag_name

var is_realtime: bool:
	get: return _force_realtime

## Whether the flag exists in the current cache.
var exists: bool:
	get: return _client.has_flag_internal(_flag_name, _force_realtime)

## Check if flag is enabled. Delegates to client for metrics tracking.
var enabled: bool:
	get: return _client.is_enabled_internal(_flag_name, _force_realtime)

var variant:
	get: return _client.get_variant_internal(_flag_name, _force_realtime)

var value_type:
	get: return _client.get_value_type_internal(_flag_name, _force_realtime)

var version: int:
	get: return _client.get_version_internal(_flag_name, _force_realtime)

var impression_data: bool:
	get: return _client.get_impression_data_internal(_flag_name, _force_realtime)

var raw:
	get: return _client.get_raw_flag_internal(_flag_name, _force_realtime)

var reason:
	get: return _client.get_reason_internal(_flag_name, _force_realtime)


# ==================== Variation Methods ====================
# All methods delegate to client's internal methods.
# FlagProxy is a convenience shell - no own logic.

func variation(fallback_value: String) -> String:
	return _client.variation_internal(_flag_name, fallback_value, _force_realtime)

func bool_variation(fallback_value: bool) -> bool:
	return _client.bool_variation_internal(_flag_name, fallback_value, _force_realtime)

func string_variation(fallback_value: String) -> String:
	return _client.string_variation_internal(_flag_name, fallback_value, _force_realtime)

func int_variation(fallback_value: int) -> int:
	return _client.int_variation_internal(_flag_name, fallback_value, _force_realtime)

func float_variation(fallback_value: float) -> float:
	return _client.float_variation_internal(_flag_name, fallback_value, _force_realtime)

func json_variation(fallback_value):
	return _client.json_variation_internal(_flag_name, fallback_value, _force_realtime)


# ==================== Variation Details ====================

func bool_variation_details(fallback_value: bool) -> Dictionary:
	return _client.bool_variation_details_internal(_flag_name, fallback_value, _force_realtime)

func string_variation_details(fallback_value: String) -> Dictionary:
	return _client.string_variation_details_internal(_flag_name, fallback_value, _force_realtime)

func int_variation_details(fallback_value: int) -> Dictionary:
	return _client.int_variation_details_internal(_flag_name, fallback_value, _force_realtime)

func float_variation_details(fallback_value: float) -> Dictionary:
	return _client.float_variation_details_internal(_flag_name, fallback_value, _force_realtime)

func json_variation_details(fallback_value) -> Dictionary:
	return _client.json_variation_details_internal(_flag_name, fallback_value, _force_realtime)


# ==================== Strict Variation Methods (OrThrow) ====================

func bool_variation_or_throw() -> bool:
	return _client.bool_variation_or_throw_internal(_flag_name, _force_realtime)

func string_variation_or_throw() -> String:
	return _client.string_variation_or_throw_internal(_flag_name, _force_realtime)

func int_variation_or_throw() -> int:
	return _client.int_variation_or_throw_internal(_flag_name, _force_realtime)

func float_variation_or_throw() -> float:
	return _client.float_variation_or_throw_internal(_flag_name, _force_realtime)

func json_variation_or_throw():
	return _client.json_variation_or_throw_internal(_flag_name, _force_realtime)
