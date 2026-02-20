import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';
import 'models.dart';
import 'events.dart';
import 'flag_proxy.dart';
import 'client.dart';
import 'variation_provider.dart';
import 'variant_source.dart';
import 'streaming_sse.dart';
import 'streaming_websocket.dart';
import 'watch_flag_group.dart';

class FeaturesClient implements VariationProvider {
  final String _apiUrl;
  final String _apiToken;
  final String _appName;
  final String _environment;
  final GatrixContext _context;
  final EventEmitter _events;
  final Map<String, String>? _customHeaders;
  final String _connectionId;

  Map<String, EvaluatedFlag> _realtimeFlags = {};
  Map<String, EvaluatedFlag> _synchronizedFlags = {};

  // Watch callbacks: flagName -> list of handlers
  final Map<String, List<GatrixFlagWatchHandler>> _watchCallbacks = {};
  final Map<String, List<GatrixFlagWatchHandler>> _syncedWatchCallbacks = {};
  final Map<String, WatchFlagGroup> _watchGroups = {};

  bool _readyEventEmitted = false;

  final Map<String, int> _missingFlags = {};
  // Metrics bucket: flag access counts (yes/no + variants)
  // Matches JS/Unity SDK structure: {flagName: {yes, no, variants: {variantName: count}}}
  final Map<String, Map<String, dynamic>> _flagBucket = {};
  DateTime _bucketStart = DateTime.now().toUtc();

  bool _explicitSyncMode = false;
  bool _pendingSync = false;
  Timer? _pollTimer;
  Timer? _metricsTimer;
  String? _etag;
  bool _started = false;

  // Retry/backoff state
  int _consecutiveFailures = 0;
  bool _pollingStopped = false;
  int _refreshIntervalMs;

  // Retry options
  final List<int> _nonRetryableStatusCodes;
  final int _initialBackoffMs;
  final int _maxBackoffMs;

  // Stats
  int _fetchCount = 0;
  int _updateCount = 0;
  int _errorCount = 0;
  int _notModifiedCount = 0;
  int _recoveryCount = 0;
  int _impressionCount = 0;
  int _contextChangeCount = 0;
  int _syncFlagsCount = 0;
  int _metricsSentCount = 0;
  int _metricsErrorCount = 0;
  String? _lastError;
  DateTime? _startTime;
  DateTime? _lastFetchTime;
  DateTime? _lastUpdateTime;
  DateTime? _lastRecoveryTime;
  DateTime? _lastErrorTime;
  final Map<String, DateTime> _flagLastChangedTimes = {};

  // Debug / Storage
  final bool _enableDevMode;
  final String _cacheKeyPrefix;

  // Streaming
  StreamingConfig? _streamingConfig;
  SseConnection? _sseConnection;
  WebSocketConnection? _wsConnection;

  FeaturesClient({
    required String apiUrl,
    required String apiToken,
    required String appName,
    required String environment,
    required GatrixContext context,
    required EventEmitter events,
    bool explicitSyncMode = false,
    int refreshIntervalSeconds = 30,
    List<int>? nonRetryableStatusCodes,
    int initialBackoffMs = 1000,
    int maxBackoffMs = 60000,
    bool enableDevMode = false,
    String cacheKeyPrefix = 'gatrix_cache',
    Map<String, String>? customHeaders,
  })  : _apiUrl = apiUrl,
        _apiToken = apiToken,
        _appName = appName,
        _environment = environment,
        _context = context,
        _events = events,
        _explicitSyncMode = explicitSyncMode,
        _refreshIntervalMs = refreshIntervalSeconds * 1000,
        _nonRetryableStatusCodes = nonRetryableStatusCodes ?? [401, 403],
        _initialBackoffMs = initialBackoffMs,
        _maxBackoffMs = maxBackoffMs,
        _enableDevMode = enableDevMode,
        _cacheKeyPrefix = cacheKeyPrefix,
        _customHeaders = customHeaders,
        _connectionId = const Uuid().v4();

  /// Log detailed debug information only when devMode is enabled
  void _devLog(String message) {
    if (_enableDevMode) {
      // ignore: avoid_print
      print('[GatrixSDK][DEV] $message');
    }
  }

  /// Select the active flag set.
  /// When forceRealtime=true, always returns realtimeFlags regardless of explicitSyncMode.
  Map<String, EvaluatedFlag> _selectFlags({bool forceRealtime = false}) {
    if (forceRealtime) return _realtimeFlags;
    return _explicitSyncMode ? _synchronizedFlags : _realtimeFlags;
  }

  // ============================================================= Flag Access

  /// Always reads from realtimeFlags — watch callbacks must reflect
  /// the latest server state regardless of explicitSyncMode.
  FlagProxy _createProxy(String flagName, {bool forceRealtime = true}) {
    final flag = _selectFlags(forceRealtime: forceRealtime)[flagName];
    _trackFlagAccess(flagName, flag, 'watch', flag?.variant.name);
    return FlagProxy(this, flagName, forceRealtime: forceRealtime);
  }

  /// Create a FlagProxy. Used internally by SDK widgets/composables.
  /// Not intended for direct use — prefer watchFlag or variation methods.
  FlagProxy createProxy(String flagName) => _createProxy(flagName);

  EvaluatedFlag? _getFlag(String flagName, {bool forceRealtime = false}) {
    return _selectFlags(forceRealtime: forceRealtime)[flagName];
  }

  List<EvaluatedFlag> getAllFlags({bool forceRealtime = false}) {
    return _selectFlags(forceRealtime: forceRealtime).values.toList();
  }

  bool hasFlag(String flagName, {bool forceRealtime = false}) {
    return _selectFlags(forceRealtime: forceRealtime).containsKey(flagName);
  }

  // ============================================================= Metrics

  void _trackFlagAccess(String flagName, EvaluatedFlag? flag,
      String eventType, [String? variantName]) {
    if (flag == null) {
      _countMissing(flagName);
      return;
    }
    // Update metrics bucket (yes/no count)
    final entry = _flagBucket.putIfAbsent(
        flagName, () => {'yes': 0, 'no': 0, 'variants': <String, int>{}});
    if (flag.enabled) {
      entry['yes'] = (entry['yes'] as int) + 1;
    } else {
      entry['no'] = (entry['no'] as int) + 1;
    }
    // Update variant count
    if (variantName != null) {
      final variants = entry['variants'] as Map<String, int>;
      variants[variantName] = (variants[variantName] ?? 0) + 1;
    }
    // Impression: separate external-service event (only when impressionData=true)
    if (flag.impressionData) {
      final impression = {
        'flagName': flagName,
        'timestamp': DateTime.now().toUtc().toIso8601String(),
        'method': eventType,
        'enabled': flag.enabled,
        'variant': variantName,
      };
      _impressionCount++;
      _events.emit(GatrixEvents.flagsImpression, [impression]);
    }
  }

  void _countMissing(String flagName) {
    _missingFlags[flagName] = (_missingFlags[flagName] ?? 0) + 1;
  }

  // ===================================================== Internal methods
  // These implement the VariationProvider interface.
  // All flag lookup + value extraction + metrics tracking happen here.

  // ==================== Metadata Access Internal Methods ====================
  // No metrics tracking — read-only metadata access for FlagProxy property delegation.

  @override
  bool hasFlagInternal(String flagName, {bool forceRealtime = false}) {
    return _getFlag(flagName, forceRealtime: forceRealtime) != null;
  }

  @override
  ValueType getValueTypeInternal(String flagName, {bool forceRealtime = false}) {
    final flag = _getFlag(flagName, forceRealtime: forceRealtime);
    return flag?.valueType ?? ValueType.none;
  }

  @override
  int getVersionInternal(String flagName, {bool forceRealtime = false}) {
    final flag = _getFlag(flagName, forceRealtime: forceRealtime);
    return flag?.version ?? 0;
  }

  @override
  String? getReasonInternal(String flagName, {bool forceRealtime = false}) {
    final flag = _getFlag(flagName, forceRealtime: forceRealtime);
    return flag?.reason;
  }

  @override
  bool getImpressionDataInternal(String flagName, {bool forceRealtime = false}) {
    final flag = _getFlag(flagName, forceRealtime: forceRealtime);
    return flag?.impressionData ?? false;
  }

  @override
  EvaluatedFlag? getRawFlagInternal(String flagName, {bool forceRealtime = false}) {
    return _getFlag(flagName, forceRealtime: forceRealtime);
  }

  @override
  bool isEnabledInternal(String flagName, {bool forceRealtime = false}) {
    final flag = _getFlag(flagName, forceRealtime: forceRealtime);
    if (flag == null) {
      _trackFlagAccess(flagName, null, 'isEnabled');
      return false;
    }
    _trackFlagAccess(flagName, flag, 'isEnabled', flag.variant.name);
    return flag.enabled;
  }

  @override
  Variant getVariantInternal(String flagName, {bool forceRealtime = false}) {
    final flag = _getFlag(flagName, forceRealtime: forceRealtime);
    if (flag == null) {
      _trackFlagAccess(flagName, null, 'getVariant');
      return Variant(name: VariantSource.missing, enabled: false);
    }
    _trackFlagAccess(flagName, flag, 'getVariant', flag.variant.name);
    return flag.variant;
  }

  @override
  String variationInternal(String flagName, String fallbackValue,
      {bool forceRealtime = false}) {
    final flag = _getFlag(flagName, forceRealtime: forceRealtime);
    if (flag == null) {
      _trackFlagAccess(flagName, null, 'getVariant');
      return fallbackValue;
    }
    _trackFlagAccess(flagName, flag, 'getVariant', flag.variant.name);
    return flag.variant.name;
  }

  @override
  bool boolVariationInternal(String flagName, bool fallbackValue,
      {bool forceRealtime = false}) {
    final flag = _getFlag(flagName, forceRealtime: forceRealtime);
    if (flag == null) {
      _trackFlagAccess(flagName, null, 'getVariant');
      return fallbackValue;
    }
    _trackFlagAccess(flagName, flag, 'getVariant', flag.variant.name);
    if (flag.valueType != ValueType.boolean) return fallbackValue;
    final val = flag.variant.value;
    if (val == null) return fallbackValue;
    if (val is bool) return val;
    if (val is String) return val.toLowerCase() == 'true';
    return fallbackValue;
  }

  @override
  String stringVariationInternal(String flagName, String fallbackValue,
      {bool forceRealtime = false}) {
    final flag = _getFlag(flagName, forceRealtime: forceRealtime);
    if (flag == null) {
      _trackFlagAccess(flagName, null, 'getVariant');
      return fallbackValue;
    }
    _trackFlagAccess(flagName, flag, 'getVariant', flag.variant.name);
    if (flag.valueType != ValueType.string) return fallbackValue;
    final val = flag.variant.value;
    if (val == null) return fallbackValue;
    return val.toString();
  }

  @override
  int intVariationInternal(String flagName, int fallbackValue,
      {bool forceRealtime = false}) {
    final flag = _getFlag(flagName, forceRealtime: forceRealtime);
    if (flag == null) {
      _trackFlagAccess(flagName, null, 'getVariant');
      return fallbackValue;
    }
    _trackFlagAccess(flagName, flag, 'getVariant', flag.variant.name);
    if (flag.valueType != ValueType.number) return fallbackValue;
    final val = flag.variant.value;
    if (val == null) return fallbackValue;
    if (val is num) return val.toInt();
    if (val is String) return int.tryParse(val) ?? fallbackValue;
    return fallbackValue;
  }

  @override
  double doubleVariationInternal(String flagName, double fallbackValue,
      {bool forceRealtime = false}) {
    final flag = _getFlag(flagName, forceRealtime: forceRealtime);
    if (flag == null) {
      _trackFlagAccess(flagName, null, 'getVariant');
      return fallbackValue;
    }
    _trackFlagAccess(flagName, flag, 'getVariant', flag.variant.name);
    if (flag.valueType != ValueType.number) return fallbackValue;
    final val = flag.variant.value;
    if (val == null) return fallbackValue;
    if (val is num) return val.toDouble();
    if (val is String) return double.tryParse(val) ?? fallbackValue;
    return fallbackValue;
  }

  @override
  T jsonVariationInternal<T>(String flagName, T fallbackValue,
      {bool forceRealtime = false}) {
    final flag = _getFlag(flagName, forceRealtime: forceRealtime);
    if (flag == null) {
      _trackFlagAccess(flagName, null, 'getVariant');
      return fallbackValue;
    }
    _trackFlagAccess(flagName, flag, 'getVariant', flag.variant.name);
    if (flag.valueType != ValueType.json) return fallbackValue;
    final val = flag.variant.value;
    if (val == null) return fallbackValue;
    if (val is T) return val;
    // Try JSON string parsing
    if (val is String) {
      try {
        final parsed = jsonDecode(val);
        if (parsed is T) return parsed;
      } catch (_) {}
    }
    return fallbackValue;
  }

  // --------------------------------------------- Variation details internal

  VariationResult<T> _makeDetails<T>(
      String flagName, T value, String expectedType,
      {bool forceRealtime = false}) {
    final flag = _getFlag(flagName, forceRealtime: forceRealtime);
    final exists = flag != null;
    var reason = (flag?.reason) ?? (exists ? 'evaluated' : 'flag_not_found');
    if (exists && flag.valueType.toApiString() != expectedType) {
      reason =
          'type_mismatch:expected_${expectedType}_got_${flag.valueType.toApiString()}';
    }
    return VariationResult(
      value: value,
      reason: reason,
      flagExists: exists,
      enabled: flag?.enabled ?? false,
      variant: exists ? flag.variant : null,
    );
  }

  @override
  VariationResult<bool> boolVariationDetailsInternal(
      String flagName, bool fallbackValue,
      {bool forceRealtime = false}) {
    final value =
        boolVariationInternal(flagName, fallbackValue, forceRealtime: forceRealtime);
    return _makeDetails(flagName, value, 'boolean', forceRealtime: forceRealtime);
  }

  @override
  VariationResult<String> stringVariationDetailsInternal(
      String flagName, String fallbackValue,
      {bool forceRealtime = false}) {
    final value =
        stringVariationInternal(flagName, fallbackValue, forceRealtime: forceRealtime);
    return _makeDetails(flagName, value, 'string', forceRealtime: forceRealtime);
  }

  @override
  VariationResult<int> intVariationDetailsInternal(
      String flagName, int fallbackValue,
      {bool forceRealtime = false}) {
    final value =
        intVariationInternal(flagName, fallbackValue, forceRealtime: forceRealtime);
    return _makeDetails(flagName, value, 'number', forceRealtime: forceRealtime);
  }

  @override
  VariationResult<double> doubleVariationDetailsInternal(
      String flagName, double fallbackValue,
      {bool forceRealtime = false}) {
    final value =
        doubleVariationInternal(flagName, fallbackValue, forceRealtime: forceRealtime);
    return _makeDetails(flagName, value, 'number', forceRealtime: forceRealtime);
  }

  @override
  VariationResult<T> jsonVariationDetailsInternal<T>(
      String flagName, T fallbackValue,
      {bool forceRealtime = false}) {
    final value =
        jsonVariationInternal<T>(flagName, fallbackValue, forceRealtime: forceRealtime);
    return _makeDetails(flagName, value, 'json', forceRealtime: forceRealtime);
  }

  // ------------------------------------------------ Or-throw internal

  @override
  bool boolVariationOrThrowInternal(String flagName,
      {bool forceRealtime = false}) {
    final flag = _getFlag(flagName, forceRealtime: forceRealtime);
    if (flag == null) {
      _trackFlagAccess(flagName, null, 'getVariant');
      throw GatrixException("Flag '$flagName' not found",
          code: 'FLAG_NOT_FOUND');
    }
    _trackFlagAccess(flagName, flag, 'getVariant', flag.variant.name);
    if (flag.valueType != ValueType.boolean) {
      throw GatrixException(
        "Flag '$flagName' type mismatch: expected boolean, got ${flag.valueType.toApiString()}",
        code: 'TYPE_MISMATCH',
      );
    }
    final val = flag.variant.value;
    if (val == null) {
      throw GatrixException("Flag '$flagName' has no boolean value",
          code: 'NO_VALUE');
    }
    if (val is bool) return val;
    if (val is String) return val.toLowerCase() == 'true';
    throw GatrixException(
      "Flag '$flagName' value is not a valid boolean",
      code: 'TYPE_MISMATCH',
    );
  }

  @override
  String stringVariationOrThrowInternal(String flagName,
      {bool forceRealtime = false}) {
    final flag = _getFlag(flagName, forceRealtime: forceRealtime);
    if (flag == null) {
      _trackFlagAccess(flagName, null, 'getVariant');
      throw GatrixException("Flag '$flagName' not found",
          code: 'FLAG_NOT_FOUND');
    }
    _trackFlagAccess(flagName, flag, 'getVariant', flag.variant.name);
    if (flag.valueType != ValueType.string) {
      throw GatrixException(
        "Flag '$flagName' type mismatch: expected string, got ${flag.valueType.toApiString()}",
        code: 'TYPE_MISMATCH',
      );
    }
    final val = flag.variant.value;
    if (val == null) {
      throw GatrixException("Flag '$flagName' has no string value",
          code: 'NO_VALUE');
    }
    return val.toString();
  }

  @override
  int intVariationOrThrowInternal(String flagName, {bool forceRealtime = false}) {
    final flag = _getFlag(flagName, forceRealtime: forceRealtime);
    if (flag == null) {
      _trackFlagAccess(flagName, null, 'getVariant');
      throw GatrixException("Flag '$flagName' not found",
          code: 'FLAG_NOT_FOUND');
    }
    _trackFlagAccess(flagName, flag, 'getVariant', flag.variant.name);
    if (flag.valueType != ValueType.number) {
      throw GatrixException(
        "Flag '$flagName' type mismatch: expected number, got ${flag.valueType.toApiString()}",
        code: 'TYPE_MISMATCH',
      );
    }
    final val = flag.variant.value;
    if (val == null) {
      throw GatrixException("Flag '$flagName' has no number value",
          code: 'NO_VALUE');
    }
    if (val is num) return val.toInt();
    if (val is String) {
      final parsed = int.tryParse(val);
      if (parsed != null) return parsed;
    }
    throw GatrixException(
      "Flag '$flagName' value is not a valid integer",
      code: 'TYPE_MISMATCH',
    );
  }

  @override
  double doubleVariationOrThrowInternal(String flagName,
      {bool forceRealtime = false}) {
    final flag = _getFlag(flagName, forceRealtime: forceRealtime);
    if (flag == null) {
      _trackFlagAccess(flagName, null, 'getVariant');
      throw GatrixException("Flag '$flagName' not found",
          code: 'FLAG_NOT_FOUND');
    }
    _trackFlagAccess(flagName, flag, 'getVariant', flag.variant.name);
    if (flag.valueType != ValueType.number) {
      throw GatrixException(
        "Flag '$flagName' type mismatch: expected number, got ${flag.valueType.toApiString()}",
        code: 'TYPE_MISMATCH',
      );
    }
    final val = flag.variant.value;
    if (val == null) {
      throw GatrixException("Flag '$flagName' has no number value",
          code: 'NO_VALUE');
    }
    if (val is num) return val.toDouble();
    if (val is String) {
      final parsed = double.tryParse(val);
      if (parsed != null) return parsed;
    }
    throw GatrixException(
      "Flag '$flagName' value is not a valid number",
      code: 'TYPE_MISMATCH',
    );
  }

  @override
  T jsonVariationOrThrowInternal<T>(String flagName,
      {bool forceRealtime = false}) {
    final flag = _getFlag(flagName, forceRealtime: forceRealtime);
    if (flag == null) {
      _trackFlagAccess(flagName, null, 'getVariant');
      throw GatrixException("Flag '$flagName' not found",
          code: 'FLAG_NOT_FOUND');
    }
    _trackFlagAccess(flagName, flag, 'getVariant', flag.variant.name);
    if (flag.valueType != ValueType.json) {
      throw GatrixException(
        "Flag '$flagName' type mismatch: expected json, got ${flag.valueType.toApiString()}",
        code: 'TYPE_MISMATCH',
      );
    }
    final val = flag.variant.value;
    if (val == null) {
      throw GatrixException("Flag '$flagName' has no JSON value",
          code: 'NO_VALUE');
    }
    if (val is T) return val;
    // Try JSON string parsing
    if (val is String) {
      try {
        final parsed = jsonDecode(val);
        if (parsed is T) return parsed;
      } catch (_) {}
    }
    throw GatrixException(
      "Flag '$flagName' value is not a valid object",
      code: 'TYPE_MISMATCH',
    );
  }

  // ============================================= Public methods (delegate)

  bool isEnabled(String flagName, {bool forceRealtime = false}) =>
      isEnabledInternal(flagName, forceRealtime: forceRealtime);
  /// Get raw flag data. Returns null if not found.
  EvaluatedFlag? getFlag(String flagName, {bool forceRealtime = false}) {
    final flag = _getFlag(flagName, forceRealtime: forceRealtime);
    if (flag == null) {
      _trackFlagAccess(flagName, null, 'getFlag');
      return null;
    }
    _trackFlagAccess(flagName, flag, 'getFlag', flag.variant.name);
    return flag;
  }
  Variant getVariant(String flagName, {bool forceRealtime = false}) =>
      getVariantInternal(flagName, forceRealtime: forceRealtime);
  String variation(String flagName, String fallbackValue,
          {bool forceRealtime = false}) =>
      variationInternal(flagName, fallbackValue, forceRealtime: forceRealtime);
  bool boolVariation(String flagName, bool fallbackValue,
          {bool forceRealtime = false}) =>
      boolVariationInternal(flagName, fallbackValue, forceRealtime: forceRealtime);
  String stringVariation(String flagName, String fallbackValue,
          {bool forceRealtime = false}) =>
      stringVariationInternal(flagName, fallbackValue, forceRealtime: forceRealtime);
  int intVariation(String flagName, int fallbackValue,
          {bool forceRealtime = false}) =>
      intVariationInternal(flagName, fallbackValue, forceRealtime: forceRealtime);
  double doubleVariation(String flagName, double fallbackValue,
          {bool forceRealtime = false}) =>
      doubleVariationInternal(flagName, fallbackValue, forceRealtime: forceRealtime);
  T jsonVariation<T>(String flagName, T fallbackValue,
          {bool forceRealtime = false}) =>
      jsonVariationInternal<T>(flagName, fallbackValue, forceRealtime: forceRealtime);

  // Details delegates
  VariationResult<bool> boolVariationDetails(
          String flagName, bool fallbackValue,
          {bool forceRealtime = false}) =>
      boolVariationDetailsInternal(flagName, fallbackValue,
          forceRealtime: forceRealtime);
  VariationResult<String> stringVariationDetails(
          String flagName, String fallbackValue,
          {bool forceRealtime = false}) =>
      stringVariationDetailsInternal(flagName, fallbackValue,
          forceRealtime: forceRealtime);
  VariationResult<int> intVariationDetails(
          String flagName, int fallbackValue,
          {bool forceRealtime = false}) =>
      intVariationDetailsInternal(flagName, fallbackValue,
          forceRealtime: forceRealtime);
  VariationResult<double> doubleVariationDetails(
          String flagName, double fallbackValue,
          {bool forceRealtime = false}) =>
      doubleVariationDetailsInternal(flagName, fallbackValue,
          forceRealtime: forceRealtime);
  VariationResult<T> jsonVariationDetails<T>(
          String flagName, T fallbackValue,
          {bool forceRealtime = false}) =>
      jsonVariationDetailsInternal<T>(flagName, fallbackValue,
          forceRealtime: forceRealtime);

  // OrThrow delegates
  bool boolVariationOrThrow(String flagName, {bool forceRealtime = false}) =>
      boolVariationOrThrowInternal(flagName, forceRealtime: forceRealtime);
  String stringVariationOrThrow(String flagName, {bool forceRealtime = false}) =>
      stringVariationOrThrowInternal(flagName, forceRealtime: forceRealtime);
  int intVariationOrThrow(String flagName, {bool forceRealtime = false}) =>
      intVariationOrThrowInternal(flagName, forceRealtime: forceRealtime);
  double doubleVariationOrThrow(String flagName, {bool forceRealtime = false}) =>
      doubleVariationOrThrowInternal(flagName, forceRealtime: forceRealtime);
  T jsonVariationOrThrow<T>(String flagName, {bool forceRealtime = false}) =>
      jsonVariationOrThrowInternal<T>(flagName, forceRealtime: forceRealtime);

  // ============================================= Watch

  /// Watch a flag for realtime changes.
  /// Returns an unsubscribe function.
  void Function() watchRealtimeFlag(
      String flagName, GatrixFlagWatchHandler callback) {
    _watchCallbacks.putIfAbsent(flagName, () => []).add(callback);
    return () => _watchCallbacks[flagName]?.remove(callback);
  }

  /// Watch a flag for realtime changes with immediate initial state.
  /// Fires [callback] immediately if flags are already loaded.
  void Function() watchRealtimeFlagWithInitialState(
      String flagName, GatrixFlagWatchHandler callback) {
    final unsub = watchRealtimeFlag(flagName, callback);
    if (_readyEventEmitted) {
      callback(_createProxy(flagName, forceRealtime: true));
    } else {
      _events.once(GatrixEvents.flagsReady, (_) {
        callback(_createProxy(flagName, forceRealtime: true));
      });
    }
    return unsub;
  }

  /// Watch a flag for synced changes (respects explicitSyncMode).
  /// Returns an unsubscribe function.
  void Function() watchSyncedFlag(
      String flagName, GatrixFlagWatchHandler callback) {
    _syncedWatchCallbacks.putIfAbsent(flagName, () => []).add(callback);
    return () => _syncedWatchCallbacks[flagName]?.remove(callback);
  }

  /// Watch a flag for synced changes with immediate initial state.
  /// Fires [callback] immediately if flags are already loaded.
  void Function() watchSyncedFlagWithInitialState(
      String flagName, GatrixFlagWatchHandler callback) {
    final unsub = watchSyncedFlag(flagName, callback);
    if (_readyEventEmitted) {
      callback(_createProxy(flagName, forceRealtime: false));
    } else {
      _events.once(GatrixEvents.flagsReady, (_) {
        callback(_createProxy(flagName, forceRealtime: false));
      });
    }
    return unsub;
  }

  /// Create a named watch group for batch management.
  WatchFlagGroup createWatchGroup(String name) {
    final group = WatchFlagGroup(
      name: name,
      watchRealtime: watchRealtimeFlag,
      watchRealtimeWithInitial: watchRealtimeFlagWithInitialState,
      watchSynced: watchSyncedFlag,
      watchSyncedWithInitial: watchSyncedFlagWithInitialState,
    );
    _watchGroups[name] = group;
    return group;
  }

  /// Invoke watch callbacks for all changed/removed flags.
  void _invokeWatchCallbacks(
    Map<String, List<GatrixFlagWatchHandler>> callbackMap,
    Map<String, EvaluatedFlag> oldFlags,
    Map<String, EvaluatedFlag> newFlags, {
    required bool forceRealtime,
  }) {
    // Changed or new flags
    for (final entry in newFlags.entries) {
      final oldFlag = oldFlags[entry.key];
      if (oldFlag == null || oldFlag.version != entry.value.version) {
        final callbacks = callbackMap[entry.key];
        if (callbacks != null && callbacks.isNotEmpty) {
          final proxy = FlagProxy(this, entry.key, forceRealtime: forceRealtime);
          for (final cb in List.of(callbacks)) {
            try {
              cb(proxy);
            } catch (e) {
              _devLog('Error in watch callback for ${entry.key}: $e');
            }
          }
        }
      }
    }
    // Removed flags
    for (final entry in oldFlags.entries) {
      if (!newFlags.containsKey(entry.key)) {
        final callbacks = callbackMap[entry.key];
        if (callbacks != null && callbacks.isNotEmpty) {
          final proxy = FlagProxy(this, entry.key, forceRealtime: forceRealtime);
          for (final cb in List.of(callbacks)) {
            try {
              cb(proxy);
            } catch (e) {
              _devLog('Error in watch callback for removed flag ${entry.key}: $e');
            }
          }
        }
      }
    }
  }

  // ============================================= Explicit Sync

  bool isExplicitSyncEnabled() => _explicitSyncMode;

  /// Change explicit sync mode at runtime.
  /// No-op if the mode is already set to the requested value.
  void setExplicitSyncMode(bool enabled) {
    if (_explicitSyncMode == enabled) return;
    _explicitSyncMode = enabled;
    _synchronizedFlags = Map.from(_realtimeFlags);
    _pendingSync = false;
    _devLog('setExplicitSyncMode: $enabled');
  }

  bool hasPendingSyncFlags() =>
      _explicitSyncMode && _pendingSync;

  // ============================================= Storage

  Future<void> initFromStorage() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final flagsJson = prefs.getString('${_cacheKeyPrefix}_flags');
      _etag = prefs.getString('${_cacheKeyPrefix}_etag');

      if (flagsJson != null) {
        final Map<String, dynamic> decoded = jsonDecode(flagsJson);
        decoded.forEach((key, value) {
          _realtimeFlags[key] = EvaluatedFlag.fromJson(value);
        });
        _synchronizedFlags = Map.from(_realtimeFlags);
        _devLog(
            'initFromStorage: loaded ${_realtimeFlags.length} flags from cache');
        _events.emit(GatrixEvents.flagsInit);
      }
    } catch (e) {
      // ignore: avoid_print
      print('Gatrix: Failed to init from storage: $e');
    }
  }

  Future<void> _saveToStorage() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final flagsMap =
          _realtimeFlags.map((key, value) => MapEntry(key, value.toJson()));
      await prefs.setString(
          '${_cacheKeyPrefix}_flags', jsonEncode(flagsMap));
      if (_etag != null) {
        await prefs.setString('${_cacheKeyPrefix}_etag', _etag!);
      }
    } catch (e) {
      // ignore: avoid_print
      print('Gatrix: Failed to save to storage: $e');
    }
  }

  // ============================================= Polling

  /// Start polling with schedule-after-completion pattern
  void startPolling(int intervalSeconds) {
    _refreshIntervalMs = intervalSeconds * 1000;
    _consecutiveFailures = 0;
    _pollingStopped = false;
    _started = true;
    _devLog('startPolling: intervalMs=$_refreshIntervalMs');
  }

  void startMetricsReporting(int intervalSeconds) {
    _metricsTimer?.cancel();
    if (intervalSeconds <= 0) return;
    _metricsTimer = Timer.periodic(
        Duration(seconds: intervalSeconds), (_) => _reportMetrics());
  }

  Future<void> _reportMetrics() async {
    if (_flagBucket.isEmpty && _missingFlags.isEmpty) return;

    // Snapshot and reset bucket atomically
    final bucketFlags = Map<String, Map<String, dynamic>>.from(_flagBucket);
    final bucketMissing = Map<String, int>.from(_missingFlags);
    final bucketStart = _bucketStart;
    _flagBucket.clear();
    _missingFlags.clear();
    _bucketStart = DateTime.now().toUtc();

    final payload = {
      'appName': _appName,
      'instanceId': _connectionId,
      'bucket': {
        'start': bucketStart.toIso8601String(),
        'stop': DateTime.now().toUtc().toIso8601String(),
        'flags': bucketFlags,
        'missing': bucketMissing,
      },
    };

    try {
      final headers = _buildHeaders();
      final response = await http.post(
        Uri.parse('$_apiUrl/client/features/$_environment/metrics'),
        headers: headers,
        body: jsonEncode(payload),
      );

      if (response.statusCode >= 200 && response.statusCode < 300) {
        _metricsSentCount++;
        _events.emit(GatrixEvents.flagsMetricSent);
      } else {
        final retryable = response.statusCode == 408 ||
            response.statusCode == 429 ||
            response.statusCode >= 500;
        if (retryable) {
          await _retryMetrics(payload, 0);
          return;
        }
        throw Exception('HTTP ${response.statusCode}');
      }
    } catch (e) {
      // Restore bucket on failure
      bucketFlags.forEach((k, v) => _flagBucket[k] = v);
      bucketMissing.forEach(
          (k, v) => _missingFlags[k] = (_missingFlags[k] ?? 0) + v);
      _metricsErrorCount++;
      _events.emit(GatrixEvents.flagsMetricError, [e.toString()]);
    }
  }

  /// Retry metrics send with exponential backoff.
  Future<void> _retryMetrics(
      Map<String, dynamic> payload, int attempt) async {
    const maxRetries = 2;
    if (attempt >= maxRetries) {
      _metricsErrorCount++;
      _events.emit(GatrixEvents.flagsMetricError, ['Max retries exceeded']);
      return;
    }

    await Future.delayed(
        Duration(milliseconds: pow(2, attempt + 1).toInt() * 1000));

    try {
      final headers = _buildHeaders();
      final response = await http.post(
        Uri.parse('$_apiUrl/client/features/$_environment/metrics'),
        headers: headers,
        body: jsonEncode(payload),
      );

      if (response.statusCode >= 200 && response.statusCode < 300) {
        _metricsSentCount++;
        _events.emit(GatrixEvents.flagsMetricSent);
      } else {
        await _retryMetrics(payload, attempt + 1);
      }
    } catch (_) {
      await _retryMetrics(payload, attempt + 1);
    }
  }

  // ============================================= Fetch Flags

  Future<void> fetchFlags() async {
    _devLog('fetchFlags: starting fetch. etag=$_etag');
    _events.emit(GatrixEvents.flagsFetchStart);
    _fetchCount++;
    _lastFetchTime = DateTime.now();

    // Cancel pending poll timer when manually called
    _pollTimer?.cancel();
    _pollTimer = null;
    _pollingStopped = false;

    try {
      final headers = _buildHeaders();
      if (_etag != null) headers['If-None-Match'] = _etag!;

      final response = await http.post(
        Uri.parse('$_apiUrl/client/features'),
        headers: headers,
        body: jsonEncode({
          'appName': _appName,
          'environment': _environment,
          ..._context.toJson(),
        }),
      );

      if (response.statusCode == 200) {
        _etag = response.headers['etag'];
        final data = jsonDecode(response.body);
        final List<dynamic> flagsList = data['flags'] ?? [];

        bool changed = false;
        final newFlags = <String, EvaluatedFlag>{};
        final oldFlags = Map<String, EvaluatedFlag>.from(_realtimeFlags);

        for (var flagJson in flagsList) {
          final flag =
              EvaluatedFlag.fromJson(flagJson as Map<String, dynamic>);
          newFlags[flag.name] = flag;

          final oldFlag = _realtimeFlags[flag.name];
          if (oldFlag == null || oldFlag.version != flag.version) {
            changed = true;
            final changeType = oldFlag == null ? 'created' : 'updated';
            _events.emit(
                GatrixEvents.flagChange(flag.name), [flag, oldFlag, changeType]);
          }
        }

        // Detect removed flags - emit bulk event
        final removedNames = <String>[];
        for (var name in oldFlags.keys) {
          if (!newFlags.containsKey(name)) {
            removedNames.add(name);
            changed = true;
          }
        }
        if (removedNames.isNotEmpty) {
          _events.emit(GatrixEvents.flagsRemoved, [removedNames]);
        }

        if (changed || _realtimeFlags.length != newFlags.length) {
          final oldFlags = Map<String, EvaluatedFlag>.from(_realtimeFlags);
          _realtimeFlags = newFlags;
          _updateCount++;
          _lastUpdateTime = DateTime.now();

          // Always invoke realtime watch callbacks
          _invokeWatchCallbacks(
            _watchCallbacks, oldFlags, _realtimeFlags,
            forceRealtime: true,
          );

          if (!_explicitSyncMode) {
            _synchronizedFlags = Map.from(_realtimeFlags);
            // Invoke synced watch callbacks immediately in non-explicit mode
            _invokeWatchCallbacks(
              _syncedWatchCallbacks, oldFlags, _realtimeFlags,
              forceRealtime: false,
            );
            _events.emit(GatrixEvents.flagsChange);
          } else {
            final wasPending = _pendingSync;
            _pendingSync = true;
            if (!wasPending) {
              _events.emit(GatrixEvents.flagsPendingSync);
            }
          }
          await _saveToStorage();
        }
        _readyEventEmitted = true;
        _events.emit(GatrixEvents.flagsReady);

        // Success: reset failure counter and schedule at normal interval
        if (_consecutiveFailures > 0) {
          _recoveryCount++;
          _lastRecoveryTime = DateTime.now();
        }
        _consecutiveFailures = 0;
        _scheduleNextRefresh();
      } else if (response.statusCode == 304) {
        // Not modified: reset failure counter and schedule at normal interval
        _notModifiedCount++;
        if (_consecutiveFailures > 0) {
          _recoveryCount++;
          _lastRecoveryTime = DateTime.now();
        }
        _consecutiveFailures = 0;
        _scheduleNextRefresh();
      } else if (_nonRetryableStatusCodes.contains(response.statusCode)) {
        // Non-retryable error: stop polling entirely
        _errorCount++;
        _lastError = 'Non-retryable HTTP ${response.statusCode}';
        _lastErrorTime = DateTime.now();
        _pollingStopped = true;
        _events.emit(GatrixEvents.sdkError,
            ['Non-retryable HTTP ${response.statusCode}']);
      } else {
        // Retryable error: schedule with backoff
        _errorCount++;
        _lastError = 'HTTP ${response.statusCode}';
        _lastErrorTime = DateTime.now();
        _consecutiveFailures++;
        _events.emit(
            GatrixEvents.sdkError, ['HTTP ${response.statusCode}']);
        _scheduleNextRefresh();
      }
    } catch (e) {
      _errorCount++;
      _lastError = e.toString();
      _lastErrorTime = DateTime.now();
      _consecutiveFailures++;
      _events.emit(GatrixEvents.sdkError, [e.toString()]);
      // Network error: schedule with backoff
      _scheduleNextRefresh();
    } finally {
      _events.emit(GatrixEvents.flagsFetchEnd);
    }
  }

  /// Schedule next fetch with exponential backoff on failures
  void _scheduleNextRefresh() {
    if (_refreshIntervalMs <= 0 || !_started || _pollingStopped) {
      return;
    }

    // Cancel existing timer
    _pollTimer?.cancel();

    int delayMs = _refreshIntervalMs;

    // Apply exponential backoff on consecutive failures
    if (_consecutiveFailures > 0) {
      final backoffMs = min(
        (_initialBackoffMs * pow(2, _consecutiveFailures - 1)).toInt(),
        _maxBackoffMs,
      );
      delayMs = backoffMs;
    }

    _pollTimer = Timer(Duration(milliseconds: delayMs), () => fetchFlags());
  }

  void syncFlags() {
    if (!_explicitSyncMode) return;
    final oldFlags = Map<String, EvaluatedFlag>.from(_synchronizedFlags);
    _synchronizedFlags = Map.from(_realtimeFlags);
    _pendingSync = false;
    _syncFlagsCount++;
    // Invoke synced watch callbacks for flags that changed since last sync
    _invokeWatchCallbacks(
      _syncedWatchCallbacks, oldFlags, _synchronizedFlags,
      forceRealtime: false,
    );
    _events.emit(GatrixEvents.flagsSync);
    _events.emit(GatrixEvents.flagsChange);
  }

  Future<void> updateContext(GatrixContext newContext) async {
    if (_context == newContext) return;
    _context.userId = newContext.userId;
    _context.sessionId = newContext.sessionId;
    _context.properties = newContext.properties;
    _contextChangeCount++;
    await fetchFlags();
  }

  void stop() {
    disconnectStreaming();
    _pollTimer?.cancel();
    _pollTimer = null;
    _metricsTimer?.cancel();
    _started = false;
    _pollingStopped = true;
    _consecutiveFailures = 0;
  }

  Map<String, dynamic> getStats() {
    return {
      'totalFlagCount': _selectFlags().length,
      'missingFlags': Map<String, int>.from(_missingFlags),
      'fetchFlagsCount': _fetchCount,
      'updateCount': _updateCount,
      'notModifiedCount': _notModifiedCount,
      'recoveryCount': _recoveryCount,
      'errorCount': _errorCount,
      'sdkState': _started ? 'ready' : 'initializing',
      'lastError': _lastError,
      'startTime': _startTime?.toIso8601String(),
      'lastFetchTime': _lastFetchTime?.toIso8601String(),
      'lastUpdateTime': _lastUpdateTime?.toIso8601String(),
      'lastRecoveryTime': _lastRecoveryTime?.toIso8601String(),
      'lastErrorTime': _lastErrorTime?.toIso8601String(),
      'flagBucketSize': _flagBucket.length,
      'missingFlagsCount': _missingFlags.length,
      'syncFlagsCount': _syncFlagsCount,
      'etag': _etag,
      'impressionCount': _impressionCount,
      'contextChangeCount': _contextChangeCount,
      'flagLastChangedTimes':
          _flagLastChangedTimes.map((k, v) => MapEntry(k, v.toIso8601String())),
      'metricsSentCount': _metricsSentCount,
      'metricsErrorCount': _metricsErrorCount,
      'consecutiveFailures': _consecutiveFailures,
      'pollingStopped': _pollingStopped,
      // Streaming stats
      'streamingEnabled': _streamingConfig?.enabled ?? false,
      'streamingTransport': _streamingConfig?.transport.name ?? 'none',
      'streamingState': _getStreamingStateName(),
      'streamingReconnectCount': _getStreamingReconnectCount(),
      'streamingEventCount': _getStreamingEventCount(),
      'streamingErrorCount': _getStreamingErrorCount(),
      'streamingRecoveryCount': _getStreamingRecoveryCount(),
      'lastStreamingError': _getLastStreamingError(),
      'lastStreamingEventTime': _getStreamingLastEventTime(),
      'lastStreamingErrorTime': _getStreamingLastErrorTime(),
      'lastStreamingRecoveryTime': _getStreamingLastRecoveryTime(),
    };
  }

  /// Build common API headers
  Map<String, String> _buildHeaders() {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'X-API-Token': _apiToken,
      'X-Application-Name': _appName,
      'X-Environment': _environment,
      'X-Connection-Id': _connectionId,
      'X-SDK-Version': '${GatrixClient.sdkName}/${GatrixClient.sdkVersion}',
    };
    if (_customHeaders != null) {
      headers.addAll(_customHeaders!);
    }
    return headers;
  }

  /// Allow injecting flags for testing (bootstrap)
  void applyBootstrapFlags(List<EvaluatedFlag> flags) {
    for (final flag in flags) {
      _realtimeFlags[flag.name] = flag;
    }
    _synchronizedFlags = Map.from(_realtimeFlags);
    _events.emit(GatrixEvents.flagsInit);
    _events.emit(GatrixEvents.flagsReady);
  }

  // ==================== Streaming ====================

  /// Configure and connect streaming
  void connectStreaming(StreamingConfig config) {
    _streamingConfig = config;
    if (!config.enabled) return;

    final sdkVersionStr = '${GatrixClient.sdkName}/${GatrixClient.sdkVersion}';

    if (config.transport == StreamingTransport.webSocket) {
      _wsConnection = WebSocketConnection(
        apiUrl: _apiUrl,
        apiToken: _apiToken,
        appName: _appName,
        environment: _environment,
        connectionId: _connectionId,
        sdkVersion: sdkVersionStr,
        config: config.ws,
        events: _events,
        customHeaders: _customHeaders,
      );
      _wsConnection!.onInvalidation = _handleStreamingInvalidation;
      _wsConnection!.onFetchRequest = () {
        _etag = null;
        fetchFlags();
      };
      _wsConnection!.connect();
    } else {
      _sseConnection = SseConnection(
        apiUrl: _apiUrl,
        apiToken: _apiToken,
        appName: _appName,
        environment: _environment,
        connectionId: _connectionId,
        sdkVersion: sdkVersionStr,
        config: config.sse,
        events: _events,
        customHeaders: _customHeaders,
      );
      _sseConnection!.onInvalidation = _handleStreamingInvalidation;
      _sseConnection!.onFetchRequest = () {
        _etag = null;
        fetchFlags();
      };
      _sseConnection!.connect();
    }
  }

  /// Disconnect streaming
  void disconnectStreaming() {
    _sseConnection?.disconnect();
    _sseConnection = null;
    _wsConnection?.disconnect();
    _wsConnection = null;
  }

  /// Handle streaming invalidation signal
  void _handleStreamingInvalidation(List<String> changedKeys) {
    final totalFlags = _realtimeFlags.length;
    final changedCount = changedKeys.length;

    if (changedCount == 0 || totalFlags == 0 || changedCount >= totalFlags ~/ 2) {
      // Full fetch: clear ETag
      _etag = null;
      fetchFlags();
    } else {
      // Partial invalidation - for now do full fetch
      fetchFlags();
    }
  }

  // Streaming stats helpers
  String _getStreamingStateName() {
    if (_sseConnection != null) return _sseConnection!.state.name;
    if (_wsConnection != null) return _wsConnection!.state.name;
    return 'disconnected';
  }

  int _getStreamingReconnectCount() {
    return (_sseConnection?.reconnectCount ?? 0) +
           (_wsConnection?.reconnectCount ?? 0);
  }

  int _getStreamingEventCount() {
    return (_sseConnection?.eventCount ?? 0) +
           (_wsConnection?.eventCount ?? 0);
  }

  int _getStreamingErrorCount() {
    return (_sseConnection?.errorCount ?? 0) +
           (_wsConnection?.errorCount ?? 0);
  }

  int _getStreamingRecoveryCount() {
    return (_sseConnection?.recoveryCount ?? 0) +
           (_wsConnection?.recoveryCount ?? 0);
  }

  String? _getLastStreamingError() {
    return _sseConnection?.lastError ?? _wsConnection?.lastError;
  }

  String? _getStreamingLastEventTime() {
    return (_sseConnection?.lastEventTime ?? _wsConnection?.lastEventTime)
        ?.toIso8601String();
  }

  String? _getStreamingLastErrorTime() {
    return (_sseConnection?.lastErrorTime ?? _wsConnection?.lastErrorTime)
        ?.toIso8601String();
  }

  String? _getStreamingLastRecoveryTime() {
    return (_sseConnection?.lastRecoveryTime ?? _wsConnection?.lastRecoveryTime)
        ?.toIso8601String();
  }
}
