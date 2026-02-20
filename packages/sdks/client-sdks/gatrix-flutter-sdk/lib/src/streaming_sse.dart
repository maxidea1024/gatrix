// SSE (Server-Sent Events) streaming connection for real-time flag updates.
// Uses dart:io HttpClient for chunked streaming with automatic reconnection.

import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'events.dart';
import 'models.dart';

/// Callback when flags are invalidated via streaming
typedef InvalidationCallback = void Function(List<String> changedKeys);

/// Callback for full-fetch request (gap recovery)
typedef FetchCallback = void Function();

class SseConnection {
  final String apiUrl;
  final String apiToken;
  final String appName;
  final String environment;
  final String connectionId;
  final String sdkVersion;
  final SseStreamingConfig config;
  final EventEmitter events;
  final Map<String, String>? customHeaders;

  StreamingConnectionState _state = StreamingConnectionState.disconnected;
  int _reconnectAttempt = 0;
  int _reconnectCount = 0;
  int _eventCount = 0;
  int _errorCount = 0;
  int _recoveryCount = 0;
  int _localGlobalRevision = 0;
  String? _lastError;
  DateTime? _lastEventTime;
  DateTime? _lastErrorTime;
  DateTime? _lastRecoveryTime;
  bool _stopRequested = false;
  Timer? _reconnectTimer;
  HttpClient? _httpClient;
  final Random _random = Random();

  InvalidationCallback? onInvalidation;
  FetchCallback? onFetchRequest;

  // SSE parser state
  String _currentEventType = '';
  StringBuffer _dataBuffer = StringBuffer();

  SseConnection({
    required this.apiUrl,
    required this.apiToken,
    required this.appName,
    required this.environment,
    required this.connectionId,
    required this.sdkVersion,
    required this.config,
    required this.events,
    this.customHeaders,
  });

  StreamingConnectionState get state => _state;
  int get reconnectCount => _reconnectCount;
  int get eventCount => _eventCount;
  int get errorCount => _errorCount;
  int get recoveryCount => _recoveryCount;
  String? get lastError => _lastError;
  DateTime? get lastEventTime => _lastEventTime;
  DateTime? get lastErrorTime => _lastErrorTime;
  DateTime? get lastRecoveryTime => _lastRecoveryTime;

  /// Start SSE connection
  void connect() {
    if (_state == StreamingConnectionState.connected ||
        _state == StreamingConnectionState.connecting) {
      return;
    }

    _state = StreamingConnectionState.connecting;
    _stopRequested = false;
    _runSseLoop();
  }

  /// Disconnect and cleanup
  void disconnect() {
    _stopRequested = true;
    _state = StreamingConnectionState.disconnected;
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
    _httpClient?.close(force: true);
    _httpClient = null;
  }

  String _buildUrl() {
    final baseUrl = config.url ??
        '$apiUrl/client/features/$environment/stream/sse';
    final params = <String, String>{
      'x-api-token': apiToken,
      'appName': appName,
      'environment': environment,
      'connectionId': connectionId,
      'sdkVersion': sdkVersion,
    };
    final uri = Uri.parse(baseUrl);
    return uri.replace(queryParameters: {...uri.queryParameters, ...params}).toString();
  }

  Future<void> _runSseLoop() async {
    final url = _buildUrl();

    try {
      _httpClient?.close(force: true);
      _httpClient = HttpClient();

      final request = await _httpClient!.getUrl(Uri.parse(url));
      request.headers.set('Accept', 'text/event-stream');
      request.headers.set('Cache-Control', 'no-cache');
      request.headers.set('X-API-Token', apiToken);
      request.headers.set('X-Application-Name', appName);
      request.headers.set('X-Environment', environment);
      request.headers.set('X-Connection-Id', connectionId);
      request.headers.set('X-SDK-Version', sdkVersion);
      customHeaders?.forEach((key, value) {
        request.headers.set(key, value);
      });

      final response = await request.close();

      if (response.statusCode != 200) {
        final errorMsg = 'SSE connection failed: HTTP ${response.statusCode}';
        _trackError(errorMsg);
        _state = StreamingConnectionState.reconnecting;
        events.emit(GatrixEvents.flagsStreamingError, [errorMsg]);
        events.emit(GatrixEvents.flagsStreamingDisconnected);
        _scheduleReconnect();
        return;
      }

      // Track recovery
      if (_reconnectCount > 0) {
        _trackRecovery();
      }
      _state = StreamingConnectionState.connected;
      _reconnectAttempt = 0;
      events.emit(GatrixEvents.flagsStreamingConnected);

      // Reset parser state
      _currentEventType = '';
      _dataBuffer = StringBuffer();

      // Listen to stream
      await for (final chunk in response.transform(utf8.decoder)) {
        if (_stopRequested) break;
        _parseSseChunk(chunk);
      }

      // Stream ended
      if (!_stopRequested &&
          _state != StreamingConnectionState.disconnected) {
        _state = StreamingConnectionState.reconnecting;
        events.emit(GatrixEvents.flagsStreamingDisconnected);
        _scheduleReconnect();
      }
    } catch (e) {
      if (_stopRequested || _state == StreamingConnectionState.disconnected) {
        return;
      }

      _trackError(e.toString());
      events.emit(GatrixEvents.flagsStreamingError, [e.toString()]);

      if (_state != StreamingConnectionState.reconnecting) {
        _state = StreamingConnectionState.reconnecting;
        events.emit(GatrixEvents.flagsStreamingDisconnected);
      }
      _scheduleReconnect();
    }
  }

  void _parseSseChunk(String chunk) {
    final lines = chunk.split('\n');
    for (final rawLine in lines) {
      final line = rawLine.trimRight();

      if (line.isEmpty) {
        // Empty line = dispatch event
        if (_currentEventType.isNotEmpty || _dataBuffer.isNotEmpty) {
          final eventType =
              _currentEventType.isEmpty ? 'message' : _currentEventType;
          final eventData = _dataBuffer.toString();
          _currentEventType = '';
          _dataBuffer = StringBuffer();
          _processEvent(eventType, eventData);
        }
      } else if (line.startsWith('event:')) {
        _currentEventType = line.substring(6).trimLeft();
      } else if (line.startsWith('data:')) {
        if (_dataBuffer.isNotEmpty) _dataBuffer.write('\n');
        _dataBuffer.write(line.substring(5).trimLeft());
      }
      // Ignore 'id:', 'retry:', and comment lines
    }
  }

  void _processEvent(String eventType, String eventData) {
    _lastEventTime = DateTime.now();
    _eventCount++;

    switch (eventType) {
      case 'connected':
        try {
          final data = jsonDecode(eventData) as Map<String, dynamic>;
          final serverRevision =
              (data['globalRevision'] as num?)?.toInt() ?? 0;

          if (serverRevision > _localGlobalRevision &&
              _localGlobalRevision > 0) {
            _localGlobalRevision = serverRevision;
            onFetchRequest?.call();
          } else if (_localGlobalRevision == 0) {
            _localGlobalRevision = serverRevision;
          }
        } catch (_) {}
        break;

      case 'flags_changed':
        try {
          final data = jsonDecode(eventData) as Map<String, dynamic>;
          final serverRevision =
              (data['globalRevision'] as num?)?.toInt() ?? 0;
          final changedKeys = (data['changedKeys'] as List<dynamic>?)
                  ?.map((k) => k.toString())
                  .toList() ??
              [];

          if (serverRevision > _localGlobalRevision) {
            _localGlobalRevision = serverRevision;
            events.emit(GatrixEvents.flagsInvalidated);
            onInvalidation?.call(changedKeys);
          }
        } catch (_) {}
        break;

      case 'heartbeat':
        break;
    }
  }

  void _scheduleReconnect() {
    if (_state == StreamingConnectionState.disconnected || _stopRequested) {
      return;
    }

    _reconnectTimer?.cancel();
    _reconnectAttempt++;
    _reconnectCount++;

    final baseMs = config.reconnectBase * 1000;
    final maxMs = config.reconnectMax * 1000;
    final exponentialDelay =
        min(baseMs * pow(2, _reconnectAttempt - 1).toInt(), maxMs);
    final jitter = _random.nextInt(1000);
    final delayMs = exponentialDelay + jitter;

    events.emit(GatrixEvents.flagsStreamingReconnecting);

    // Transition to degraded after several failed attempts
    if (_reconnectAttempt >= 5 &&
        _state != StreamingConnectionState.degraded) {
      _state = StreamingConnectionState.degraded;
    }

    _reconnectTimer = Timer(
      Duration(milliseconds: delayMs),
      () {
        if (!_stopRequested && _state != StreamingConnectionState.disconnected) {
          connect();
        }
      },
    );
  }

  void _trackError(String errorMessage) {
    _errorCount++;
    _lastErrorTime = DateTime.now();
    _lastError = errorMessage;
  }

  void _trackRecovery() {
    _recoveryCount++;
    _lastRecoveryTime = DateTime.now();
  }
}
