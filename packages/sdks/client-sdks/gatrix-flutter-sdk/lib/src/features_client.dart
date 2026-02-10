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

class FeaturesClient {
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
  
  final Map<String, int> _missingFlags = {};
  final List<Map<String, dynamic>> _pendingImpressions = [];
  
  bool _explicitSyncMode = false;
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
  final Map<String, Map<String, int>> _flagEnabledCounts = {};
  final Map<String, Map<String, int>> _flagVariantCounts = {};
  final Map<String, DateTime> _flagLastChangedTimes = {};

  // Debug / Storage
  final bool _enableDevMode;
  final String _cacheKeyPrefix;
  
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
      print('[GatrixSDK][DEV] $message');
    }
  }

  Map<String, EvaluatedFlag> get _activeFlags => _explicitSyncMode ? _synchronizedFlags : _realtimeFlags;

  FlagProxy getFlag(String flagName) {
    if (!_activeFlags.containsKey(flagName)) {
      _countMissing(flagName);
      return FlagProxy(null);
    }
    return FlagProxy(_activeFlags[flagName], _trackImpression);
  }

  void _trackImpression(String flagName, Map<String, dynamic> data) {
    final impression = {
      'flagName': flagName,
      'timestamp': DateTime.now().toUtc().toIso8601String(),
      ...data,
    };
    _pendingImpressions.add(impression);
    _impressionCount++;
    _events.emit(GatrixEvents.flagsImpression, [impression]);
  }

  void _countMissing(String flagName) {
    _missingFlags[flagName] = (_missingFlags[flagName] ?? 0) + 1;
  }

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
        _devLog('initFromStorage: loaded ${_realtimeFlags.length} flags from cache');
        _events.emit(GatrixEvents.flagsInit);
      }
    } catch (e) {
      print('Gatrix: Failed to init from storage: $e');
    }
  }

  Future<void> _saveToStorage() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final flagsMap = _realtimeFlags.map((key, value) => MapEntry(key, value.toJson()));
      await prefs.setString('${_cacheKeyPrefix}_flags', jsonEncode(flagsMap));
      if (_etag != null) await prefs.setString('${_cacheKeyPrefix}_etag', _etag!);
    } catch (e) {
      print('Gatrix: Failed to save to storage: $e');
    }
  }

  /// Start polling with schedule-after-completion pattern
  void startPolling(int intervalSeconds) {
    _refreshIntervalMs = intervalSeconds * 1000;
    _consecutiveFailures = 0;
    _pollingStopped = false;
    _started = true;
    _devLog('startPolling: intervalMs=$_refreshIntervalMs');
    // Initial fetch triggers the first scheduleNextRefresh on completion
  }

  void startMetricsReporting(int intervalSeconds) {
    _metricsTimer?.cancel();
    if (intervalSeconds <= 0) return;
    _metricsTimer = Timer.periodic(Duration(seconds: intervalSeconds), (_) => _reportMetrics());
  }

  Future<void> _reportMetrics() async {
    if (_pendingImpressions.isEmpty && _missingFlags.isEmpty) return;
    
    final impressions = List<Map<String, dynamic>>.from(_pendingImpressions);
    final missing = Map<String, int>.from(_missingFlags);
    
    _pendingImpressions.clear();
    _missingFlags.clear();

    try {
      final headers = _buildHeaders();
      final response = await http.post(
        Uri.parse('$_apiUrl/metrics'),
        headers: headers,
        body: jsonEncode({
          'impressions': impressions,
          'missingFlags': missing,
        }),
      );

      if (response.statusCode >= 200 && response.statusCode < 300) {
        _metricsSentCount++;
        _events.emit(GatrixEvents.flagsMetricSent);
      } else {
        // Retry on retryable status codes
        final retryable = response.statusCode == 408 ||
            response.statusCode == 429 ||
            response.statusCode >= 500;
        if (retryable) {
          await _retryMetrics(impressions, missing, 0);
          return;
        }
        throw Exception('HTTP ${response.statusCode}');
      }
    } catch (e) {
      // Restore on failure
      _pendingImpressions.addAll(impressions);
      missing.forEach((k, v) => _missingFlags[k] = (_missingFlags[k] ?? 0) + v);
      _metricsErrorCount++;
      _events.emit(GatrixEvents.flagsMetricError, [e.toString()]);
    }
  }

  /// Retry metrics send with exponential backoff
  Future<void> _retryMetrics(
      List<Map<String, dynamic>> impressions,
      Map<String, int> missing,
      int attempt) async {
    const maxRetries = 2;
    if (attempt >= maxRetries) {
      _pendingImpressions.addAll(impressions);
      missing.forEach((k, v) => _missingFlags[k] = (_missingFlags[k] ?? 0) + v);
      _metricsErrorCount++;
      _events.emit(GatrixEvents.flagsMetricError, ['Max retries exceeded']);
      return;
    }

    await Future.delayed(Duration(milliseconds: pow(2, attempt + 1).toInt() * 1000));

    try {
      final headers = _buildHeaders();
      final response = await http.post(
        Uri.parse('$_apiUrl/metrics'),
        headers: headers,
        body: jsonEncode({
          'impressions': impressions,
          'missingFlags': missing,
        }),
      );

      if (response.statusCode >= 200 && response.statusCode < 300) {
        _events.emit(GatrixEvents.flagsMetricSent);
      } else {
        await _retryMetrics(impressions, missing, attempt + 1);
      }
    } catch (_) {
      await _retryMetrics(impressions, missing, attempt + 1);
    }
  }

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
        Uri.parse('$_apiUrl/evaluate-all'),
        headers: headers,
        body: jsonEncode({
          'context': _context.toJson(),
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
          final flag = EvaluatedFlag.fromJson(flagJson as Map<String, dynamic>);
          newFlags[flag.name] = flag;
          
          final oldFlag = _realtimeFlags[flag.name];
          if (oldFlag == null || oldFlag.version != flag.version) {
            changed = true;
            final changeType = oldFlag == null ? 'created' : 'updated';
            _events.emit(GatrixEvents.flagChange(flag.name),
                [flag, oldFlag, changeType]);
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
          _realtimeFlags = newFlags;
           _updateCount++;
          _lastUpdateTime = DateTime.now();
          if (!_explicitSyncMode) {
            _synchronizedFlags = Map.from(_realtimeFlags);
            _events.emit(GatrixEvents.flagsChange);
          }
          await _saveToStorage();
        }
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
        _events.emit(GatrixEvents.sdkError, ['Non-retryable HTTP ${response.statusCode}']);
      } else {
        // Retryable error: schedule with backoff
        _errorCount++;
        _lastError = 'HTTP ${response.statusCode}';
        _lastErrorTime = DateTime.now();
        _consecutiveFailures++;
        _events.emit(GatrixEvents.sdkError, ['HTTP ${response.statusCode}']);
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
    _synchronizedFlags = Map.from(_realtimeFlags);
    _syncFlagsCount++;
    _events.emit(GatrixEvents.flagsSync);
    _events.emit(GatrixEvents.flagsChange);
  }

  Future<void> updateContext(GatrixContext newContext) async {
    if (_context == newContext) return;
    _context.userId = newContext.userId;
    _context.sessionId = newContext.sessionId;
    _context.deviceId = newContext.deviceId;
    _context.properties = newContext.properties;
    await fetchFlags();
  }

  void stop() {
    _pollTimer?.cancel();
    _pollTimer = null;
    _metricsTimer?.cancel();
    _started = false;
    _pollingStopped = true;
    _consecutiveFailures = 0;
  }

  Map<String, dynamic> getStats() {
    return {
      'totalFlagCount': _activeFlags.length,
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
      'flagEnabledCounts': Map<String, Map<String, int>>.from(
        _flagEnabledCounts.map((k, v) => MapEntry(k, Map<String, int>.from(v)))),
      'flagVariantCounts': Map<String, Map<String, int>>.from(
        _flagVariantCounts.map((k, v) => MapEntry(k, Map<String, int>.from(v)))),
      'syncFlagsCount': _syncFlagsCount,
      'etag': _etag,
      'impressionCount': _impressionCount,
      'contextChangeCount': _contextChangeCount,
      'flagLastChangedTimes': _flagLastChangedTimes.map(
        (k, v) => MapEntry(k, v.toIso8601String())),
      'metricsSentCount': _metricsSentCount,
      'metricsErrorCount': _metricsErrorCount,
      'pendingImpressions': _pendingImpressions.length,
      'consecutiveFailures': _consecutiveFailures,
      'pollingStopped': _pollingStopped,
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
}
