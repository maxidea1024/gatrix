import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'models.dart';
import 'events.dart';
import 'flag_proxy.dart';

class FeaturesClient {
  final String _apiUrl;
  final String _apiToken;
  final GatrixContext _context;
  final EventEmitter _events;
  
  Map<String, EvaluatedFlag> _realtimeFlags = {};
  Map<String, EvaluatedFlag> _synchronizedFlags = {};
  
  final Map<String, int> _missingFlags = {};
  final List<Map<String, dynamic>> _pendingImpressions = [];
  
  bool _explicitSyncMode = false;
  Timer? _pollTimer;
  Timer? _metricsTimer;
  String? _etag;
  
  // Stats
  int _fetchCount = 0;
  int _updateCount = 0;
  int _errorCount = 0;
  DateTime? _lastFetchTime;
  
  FeaturesClient({
    required String apiUrl,
    required String apiToken,
    required GatrixContext context,
    required EventEmitter events,
    bool explicitSyncMode = false,
  })  : _apiUrl = apiUrl,
        _apiToken = apiToken,
        _context = context,
        _events = events,
        _explicitSyncMode = explicitSyncMode;

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
    _events.emit(GatrixEvents.flagsImpression, [impression]);
  }

  void _countMissing(String flagName) {
    _missingFlags[flagName] = (_missingFlags[flagName] ?? 0) + 1;
  }

  Future<void> initFromStorage() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final flagsJson = prefs.getString('gatrix_flags');
      _etag = prefs.getString('gatrix_etag');
      
      if (flagsJson != null) {
        final Map<String, dynamic> decoded = jsonDecode(flagsJson);
        decoded.forEach((key, value) {
          _realtimeFlags[key] = EvaluatedFlag.fromJson(value);
        });
        _synchronizedFlags = Map.from(_realtimeFlags);
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
      await prefs.setString('gatrix_flags', jsonEncode(flagsMap));
      if (_etag != null) await prefs.setString('gatrix_etag', _etag!);
    } catch (e) {
      print('Gatrix: Failed to save to storage: $e');
    }
  }

  void startPolling(int intervalSeconds) {
    _pollTimer?.cancel();
    if (intervalSeconds <= 0) return;
    _pollTimer = Timer.periodic(Duration(seconds: intervalSeconds), (_) => fetchFlags());
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
      final response = await http.post(
        Uri.parse('$_apiUrl/metrics'),
        headers: {
          'Authorization': 'Bearer $_apiToken',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'impressions': impressions,
          'missingFlags': missing,
        }),
      );

      if (response.statusCode >= 200 && response.statusCode < 300) {
        _events.emit(GatrixEvents.flagsMetricSent);
      } else {
        throw Exception('HTTP ${response.statusCode}');
      }
    } catch (e) {
      // Restore on failure
      _pendingImpressions.addAll(impressions);
      missing.forEach((k, v) => _missingFlags[k] = (_missingFlags[k] ?? 0) + v);
      _events.emit(GatrixEvents.flagsMetricError, [e.toString()]);
    }
  }

  Future<void> fetchFlags() async {
    _events.emit(GatrixEvents.flagsFetchStart);
    _fetchCount++;
    _lastFetchTime = DateTime.now();

    try {
      final headers = {
        'Authorization': 'Bearer $_apiToken',
        'Content-Type': 'application/json',
      };
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
        
        for (var flagJson in flagsList) {
          final flag = EvaluatedFlag.fromJson(flagJson as Map<String, dynamic>);
          newFlags[flag.name] = flag;
          
          final oldFlag = _realtimeFlags[flag.name];
          if (oldFlag == null || oldFlag.version != flag.version) {
            changed = true;
          }
        }

        if (changed || _realtimeFlags.length != newFlags.length) {
          _realtimeFlags = newFlags;
          _updateCount++;
          if (!_explicitSyncMode) {
            _synchronizedFlags = Map.from(_realtimeFlags);
            _events.emit(GatrixEvents.flagsChange);
          }
          await _saveToStorage();
        }
        _events.emit(GatrixEvents.flagsReady);
      } else if (response.statusCode == 304) {
        // Not modified
      } else {
        _errorCount++;
        _events.emit(GatrixEvents.sdkError, ['HTTP ${response.statusCode}']);
      }
    } catch (e) {
      _errorCount++;
      _events.emit(GatrixEvents.sdkError, [e.toString()]);
    } finally {
      _events.emit(GatrixEvents.flagsFetchEnd);
    }
  }

  void syncFlags() {
    if (!_explicitSyncMode) return;
    _synchronizedFlags = Map.from(_realtimeFlags);
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
    _metricsTimer?.cancel();
  }

  Map<String, dynamic> getStats() {
    return {
      'fetchCount': _fetchCount,
      'updateCount': _updateCount,
      'errorCount': _errorCount,
      'lastFetchTime': _lastFetchTime?.toIso8601String(),
      'missingFlags': Map.from(_missingFlags),
      'pendingImpressions': _pendingImpressions.length,
    };
  }
}
