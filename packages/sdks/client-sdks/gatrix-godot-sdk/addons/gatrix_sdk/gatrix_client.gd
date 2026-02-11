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
	assert(config.api_url.strip_edges() != "", "GatrixSDK: api_url is required")
	assert(config.api_token.strip_edges() != "", "GatrixSDK: api_token is required")
	assert(config.app_name.strip_edges() != "", "GatrixSDK: app_name is required")
	assert(config.environment.strip_edges() != "", "GatrixSDK: environment is required")

	# Validate URL format
	assert(
		config.api_url.begins_with("http://") or config.api_url.begins_with("https://"),
		"GatrixSDK: api_url must start with http:// or https://. Got: %s" % config.api_url
	)

	# Validate whitespace
	assert(config.api_url == config.api_url.strip_edges(),
		"GatrixSDK: api_url must not have leading or trailing whitespace")
	assert(config.api_token == config.api_token.strip_edges(),
		"GatrixSDK: api_token must not have leading or trailing whitespace")

	# Validate numeric ranges
	assert(config.refresh_interval >= 1.0 and config.refresh_interval <= 86400.0,
		"GatrixSDK: refresh_interval must be between 1 and 86400, got %f" % config.refresh_interval)
	assert(config.metrics_interval >= 1.0 and config.metrics_interval <= 86400.0,
		"GatrixSDK: metrics_interval must be between 1 and 86400, got %f" % config.metrics_interval)
	assert(config.metrics_interval_initial >= 0.0 and config.metrics_interval_initial <= 3600.0,
		"GatrixSDK: metrics_interval_initial must be between 0 and 3600, got %f" % config.metrics_interval_initial)

	# Validate backoff settings
	assert(config.initial_backoff_ms >= 100 and config.initial_backoff_ms <= 60000,
		"GatrixSDK: initial_backoff_ms must be between 100 and 60000, got %d" % config.initial_backoff_ms)
	assert(config.max_backoff_ms >= 1000 and config.max_backoff_ms <= 600000,
		"GatrixSDK: max_backoff_ms must be between 1000 and 600000, got %d" % config.max_backoff_ms)
	assert(config.initial_backoff_ms <= config.max_backoff_ms,
		"GatrixSDK: initial_backoff_ms (%d) must be <= max_backoff_ms (%d)" % [config.initial_backoff_ms, config.max_backoff_ms])

	# Validate non-retryable status codes
	for code in config.non_retryable_status_codes:
		assert(code >= 400 and code <= 599,
			"GatrixSDK: non_retryable_status_codes must be 400-599, got %d" % code)

	# Validate cache key prefix
	assert(config.cache_key_prefix.length() <= 100,
		"GatrixSDK: cache_key_prefix must be <= 100 characters")

	# Set up storage
	if storage != null:
		_storage = storage
	else:
		_storage = GatrixStorageProvider.InMemoryStorageProvider.new()

	# Auto-generate sessionId if not set
	if config.context.session_id == "":
		config.context.session_id = GatrixTypes.generate_uuid()

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


## Get int variation.
func int_variation(flag_name: String, missing_value: int) -> int:
	assert(_initialized, "GatrixSDK: Not initialized")
	return _features.int_variation(flag_name, missing_value)


## Get float variation.
func float_variation(flag_name: String, missing_value: float) -> float:
	assert(_initialized, "GatrixSDK: Not initialized")
	return _features.float_variation(flag_name, missing_value)


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


func int_variation_details(flag_name: String, missing_value: int) -> GatrixTypes.VariationResult:
	assert(_initialized, "GatrixSDK: Not initialized")
	return _features.int_variation_details(flag_name, missing_value)


func float_variation_details(flag_name: String, missing_value: float) -> GatrixTypes.VariationResult:
	assert(_initialized, "GatrixSDK: Not initialized")
	return _features.float_variation_details(flag_name, missing_value)


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


func int_variation_or_throw(flag_name: String) -> int:
	assert(_initialized, "GatrixSDK: Not initialized")
	return _features.int_variation_or_throw(flag_name)


func float_variation_or_throw(flag_name: String) -> float:
	assert(_initialized, "GatrixSDK: Not initialized")
	return _features.float_variation_or_throw(flag_name)


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




func _exit_tree() -> void:
	if _started:
		stop()
