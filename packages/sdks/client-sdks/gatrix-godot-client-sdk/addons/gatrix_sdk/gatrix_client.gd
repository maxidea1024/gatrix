# Gatrix SDK Client (Autoload Singleton)
# Main entry point for the Gatrix SDK in Godot Engine
#
# Usage:
#   GatrixClient.start(config)
#   var features = GatrixClient.get_features()
#   features.is_enabled("my-feature")
#   features.float_variation("game-speed", 1.0)
extends Node

const SDK_VERSION := "1.0.0"
const SDK_NAME := "gatrix-godot-client-sdk"

# Core components
var _emitter := GatrixEventEmitter.new()
var _features: GatrixFeaturesClient = null
var _storage: GatrixStorageProvider = null
var _config: GatrixTypes.GatrixClientConfig = null

var _initialized := false
var _started := false


# ==================== Lifecycle ====================

## Start the SDK with configuration.
## Initializes and begins fetching, polling, and metrics.
## @param config  Configuration object (required)
## @param storage Optional storage provider (default: InMemoryStorageProvider)
## @param on_complete Optional callback(success: bool, error_msg: String) invoked
##                    once when the first fetch completes (or immediately if already ready / offline).
func start(config: GatrixTypes.GatrixClientConfig, storage: GatrixStorageProvider = null, on_complete: Callable = Callable()) -> void:
	if _started:
		push_warning("[GatrixSDK] Already started")
		if on_complete.is_valid():
			if _features != null and _features.is_ready():
				on_complete.call(true, "")
			else:
				_features._pending_start_callbacks.append(on_complete)
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
	assert(config.features.refresh_interval >= 1.0 and config.features.refresh_interval <= 86400.0,
		"GatrixSDK: refresh_interval must be between 1 and 86400, got %f" % config.features.refresh_interval)
	assert(config.features.metrics_interval >= 1.0 and config.features.metrics_interval <= 86400.0,
		"GatrixSDK: metrics_interval must be between 1 and 86400, got %f" % config.features.metrics_interval)
	assert(config.features.metrics_interval_initial >= 0.0 and config.features.metrics_interval_initial <= 3600.0,
		"GatrixSDK: metrics_interval_initial must be between 0 and 3600, got %f" % config.features.metrics_interval_initial)

	# Validate backoff settings
	assert(config.features.initial_backoff >= 0.1 and config.features.initial_backoff <= 60.0,
		"GatrixSDK: initial_backoff must be between 0.1 and 60 seconds, got %f" % config.features.initial_backoff)
	assert(config.features.max_backoff >= 1.0 and config.features.max_backoff <= 600.0,
		"GatrixSDK: max_backoff must be between 1 and 600 seconds, got %f" % config.features.max_backoff)
	assert(config.features.initial_backoff <= config.features.max_backoff,
		"GatrixSDK: initial_backoff (%f) must be <= max_backoff (%f)" % [config.features.initial_backoff, config.features.max_backoff])

	# Validate non-retryable status codes
	for code in config.features.non_retryable_status_codes:
		assert(code >= 400 and code <= 599,
			"GatrixSDK: non_retryable_status_codes must be 400-599, got %d" % code)

	# Validate cache key prefix
	assert(config.features.cache_key_prefix.length() <= 100,
		"GatrixSDK: cache_key_prefix must be <= 100 characters")

	# Set up storage
	if storage != null:
		_storage = storage
	else:
		_storage = GatrixStorageProvider.InMemoryStorageProvider.new()

	# Auto-generate sessionId if not set
	if config.features.context.session_id == "":
		config.features.context.session_id = GatrixTypes.generate_uuid()

	# Create features client
	_features = GatrixFeaturesClient.new()
	_features.initialize(config, _emitter, _storage, get_tree())

	_initialized = true
	_started = true

	# Register on_complete callback before start
	if on_complete.is_valid():
		_features._pending_start_callbacks.append(on_complete)

	# Start fetching, polling, metrics
	_features.start()

	print("[GatrixSDK] Started (app=%s, env=%s)" % [config.app_name, config.environment])


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

## Get the features client for flag access.
## All flag operations should be performed through this client:
##   GatrixClient.get_features().is_enabled("flag")
##   GatrixClient.get_features().float_variation("speed", 1.0)
func get_features() -> GatrixFeaturesClient:
	return _features


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


# ==================== Tracking ====================

## Track a custom user event.
## NOTE: Not yet implemented. This API is reserved for the upcoming
## Gatrix Analytics service and will be fully supported in a future release.
## @param event_name  Name of the event to track
## @param properties  Optional dictionary of event properties
func track(event_name: String, properties: Dictionary = {}) -> void:
	if _config != null and _config.enable_dev_mode:
		print("[Gatrix] track() called: eventName=\"%s\", properties=%s — tracking is not yet supported but will be available soon." % [event_name, str(properties)])


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
