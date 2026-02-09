# Gatrix SDK Client (Autoload Singleton)
# Main entry point for the Gatrix SDK in Godot Engine
extends Node

const SDK_VERSION := "1.0.0"
const SDK_NAME := "gatrix-godot-sdk"

# Core components
var _emitter := GatrixEventEmitter.new()
var _features: GatrixFeaturesClient = null
var _storage: GatrixStorageProvider = null
var _config: GatrixTypes.GatrixClientConfig = null

var _initialized := false
var _started := false


# ==================== Lifecycle ====================

## Initialize the SDK with configuration.
## Must be called before start().
func init_sdk(config: GatrixTypes.GatrixClientConfig, storage: GatrixStorageProvider = null) -> void:
	if _initialized:
		push_warning("[GatrixSDK] Already initialized")
		return

	_config = config

	# Validate required fields
	assert(config.api_token != "", "GatrixSDK: api_token is required")
	assert(config.app_name != "", "GatrixSDK: app_name is required")
	assert(config.environment != "", "GatrixSDK: environment is required")

	# Set up storage
	if storage != null:
		_storage = storage
	else:
		_storage = GatrixStorageProvider.InMemoryStorageProvider.new()

	# Auto-generate sessionId if not set
	if config.context.session_id == "":
		config.context.session_id = _generate_uuid()

	# Create features client
	_features = GatrixFeaturesClient.new()
	_features.initialize(config, _emitter, _storage, get_tree())

	_initialized = true
	print("[GatrixSDK] Initialized (app=%s, env=%s)" % [config.app_name, config.environment])


## Start the SDK (begins fetching, polling, metrics).
func start() -> void:
	assert(_initialized, "GatrixSDK: Must call init_sdk() before start()")
	if _started:
		return
	_started = true
	_features.start()
	print("[GatrixSDK] Started")


## Stop the SDK (stops polling, cleans up).
func stop() -> void:
	if not _started:
		return
	_started = false
	_features.stop()
	print("[GatrixSDK] Stopped")


## Check if the SDK has been initialized.
func is_initialized() -> bool:
	return _initialized


## Check if the SDK is ready (first fetch completed).
func is_ready() -> bool:
	return _features.is_ready() if _features != null else false


# ==================== Features Client Access ====================

## Get the features client for direct access.
func get_features() -> GatrixFeaturesClient:
	return _features


# ==================== Convenience Methods (delegates to FeaturesClient) ====================

## Check if a flag is enabled.
func is_enabled(flag_name: String) -> bool:
	assert(_initialized, "GatrixSDK: Not initialized")
	return _features.is_enabled(flag_name)


## Get a FlagProxy for convenient flag access.
func get_flag(flag_name: String) -> GatrixFlagProxy:
	assert(_initialized, "GatrixSDK: Not initialized")
	return _features.get_flag(flag_name)


## Get boolean variation.
func bool_variation(flag_name: String, default_value: bool) -> bool:
	assert(_initialized, "GatrixSDK: Not initialized")
	return _features.bool_variation(flag_name, default_value)


## Get string variation.
func string_variation(flag_name: String, default_value: String) -> String:
	assert(_initialized, "GatrixSDK: Not initialized")
	return _features.string_variation(flag_name, default_value)


## Get number variation.
func number_variation(flag_name: String, default_value: float) -> float:
	assert(_initialized, "GatrixSDK: Not initialized")
	return _features.number_variation(flag_name, default_value)


## Get JSON variation (returns Dictionary or Array).
func json_variation(flag_name: String, default_value = null):
	assert(_initialized, "GatrixSDK: Not initialized")
	return _features.json_variation(flag_name, default_value)


## Get variant name.
func variation(flag_name: String, default_value: String) -> String:
	assert(_initialized, "GatrixSDK: Not initialized")
	return _features.variation(flag_name, default_value)


## Get the variant object for a flag.
func get_variant(flag_name: String) -> GatrixTypes.Variant:
	assert(_initialized, "GatrixSDK: Not initialized")
	return _features.get_variant(flag_name)


## Get all evaluated flags.
func get_all_flags() -> Array:
	assert(_initialized, "GatrixSDK: Not initialized")
	return _features.get_all_flags()


# ==================== Variation Details ====================

func bool_variation_details(flag_name: String, default_value: bool) -> GatrixTypes.VariationResult:
	assert(_initialized, "GatrixSDK: Not initialized")
	return _features.bool_variation_details(flag_name, default_value)


func string_variation_details(flag_name: String, default_value: String) -> GatrixTypes.VariationResult:
	assert(_initialized, "GatrixSDK: Not initialized")
	return _features.string_variation_details(flag_name, default_value)


func number_variation_details(flag_name: String, default_value: float) -> GatrixTypes.VariationResult:
	assert(_initialized, "GatrixSDK: Not initialized")
	return _features.number_variation_details(flag_name, default_value)


func json_variation_details(flag_name: String, default_value = null) -> GatrixTypes.VariationResult:
	assert(_initialized, "GatrixSDK: Not initialized")
	return _features.json_variation_details(flag_name, default_value)


# ==================== Strict Variations ====================

func bool_variation_or_throw(flag_name: String) -> bool:
	assert(_initialized, "GatrixSDK: Not initialized")
	return _features.bool_variation_or_throw(flag_name)


func string_variation_or_throw(flag_name: String) -> String:
	assert(_initialized, "GatrixSDK: Not initialized")
	return _features.string_variation_or_throw(flag_name)


func number_variation_or_throw(flag_name: String) -> float:
	assert(_initialized, "GatrixSDK: Not initialized")
	return _features.number_variation_or_throw(flag_name)


func json_variation_or_throw(flag_name: String):
	assert(_initialized, "GatrixSDK: Not initialized")
	return _features.json_variation_or_throw(flag_name)


# ==================== Context ====================

## Update the evaluation context. Triggers a re-fetch.
func update_context(new_context: GatrixTypes.GatrixContext) -> void:
	assert(_initialized, "GatrixSDK: Not initialized")
	_features.update_context(new_context)


## Get the current evaluation context.
func get_context() -> GatrixTypes.GatrixContext:
	assert(_initialized, "GatrixSDK: Not initialized")
	return _features.get_context()


# ==================== Explicit Sync ====================

func is_explicit_sync() -> bool:
	return _features.is_explicit_sync() if _features else false

func can_sync_flags() -> bool:
	return _features.can_sync_flags() if _features else false

func sync_flags(fetch_now := true) -> void:
	assert(_initialized, "GatrixSDK: Not initialized")
	_features.sync_flags(fetch_now)


# ==================== Watch ====================

## Watch a flag for changes. Returns an unwatch Callable.
func watch_flag(flag_name: String, callback: Callable, watcher_name := "") -> Callable:
	assert(_initialized, "GatrixSDK: Not initialized")
	return _features.watch_flag(flag_name, callback, watcher_name)


## Watch a flag with immediate initial state callback. Returns an unwatch Callable.
func watch_flag_with_initial_state(flag_name: String, callback: Callable, watcher_name := "") -> Callable:
	assert(_initialized, "GatrixSDK: Not initialized")
	return _features.watch_flag_with_initial_state(flag_name, callback, watcher_name)


# ==================== Event Subscription ====================

## Subscribe to an event. Returns a handle for off().
func on_event(event_name: String, callback: Callable, listener_name := "") -> int:
	return _emitter.on(event_name, callback, listener_name)


## Subscribe once. Auto-removed after first invocation.
func once_event(event_name: String, callback: Callable, listener_name := "") -> int:
	return _emitter.once(event_name, callback, listener_name)


## Unsubscribe by handle.
func off(handle: int) -> void:
	_emitter.off(handle)


## Unsubscribe all listeners for an event.
func off_event(event_name: String) -> void:
	_emitter.off_event(event_name)


## Subscribe to ALL events.
func on_any(callback: Callable, listener_name := "") -> int:
	return _emitter.on_any(callback, listener_name)


## Unsubscribe any-event listener.
func off_any(handle: int) -> void:
	_emitter.off_any(handle)


# ==================== Stats ====================

## Get SDK statistics.
func get_stats() -> GatrixTypes.FeaturesStats:
	assert(_initialized, "GatrixSDK: Not initialized")
	return _features.get_stats()


# ==================== Static ====================

## Get SDK version string.
static func get_version() -> String:
	return SDK_VERSION


## Return EVENTS constants class.
static func get_events() -> Object:
	return GatrixEvents


# ==================== Internal ====================

func _generate_uuid() -> String:
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


func _exit_tree() -> void:
	if _started:
		stop()
