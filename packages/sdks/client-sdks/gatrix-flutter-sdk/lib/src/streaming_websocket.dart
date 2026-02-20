// WebSocket streaming connection for real-time flag updates.
// Uses web_socket_channel package for cross-platform WebSocket support.

import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:web_socket_channel/web_socket_channel.dart';

import 'events.dart';
import 'models.dart';

/// Callback when flags are invalidated via streaming
typedef InvalidationCallback = void Function(List<String> changedKeys);

/// Callback for full-fetch request (gap recovery)
typedef FetchCallback = void Function();

class WebSocketConnection {
  final String apiUrl;
  final String apiToken;
  final String appName;
  final String environment;
  final String connectionId;
  final String sdkVersion;
  final WebSocketStreamingConfig config;
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
  Timer? _pingTimer;
  WebSocketChannel? _channel;
  StreamSubscription? _subscription;
  final Random _random = Random();

  InvalidationCallback? onInvalidation;
  FetchCallback? onFetchRequest;

  WebSocketConnection({
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

  /// Start WebSocket connection
  void connect() {
    if (_state == StreamingConnectionState.connected ||
        _state == StreamingConnectionState.connecting) {
      return;
    }

    _state = StreamingConnectionState.connecting;
    _stopRequested = false;
    _connectWebSocket();
  }

  /// Disconnect and cleanup
  void disconnect() {
    _stopRequested = true;
    _state = StreamingConnectionState.disconnected;
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
    _pingTimer?.cancel();
    _pingTimer = null;
    _subscription?.cancel();
    _subscription = null;
    _channel?.sink.close();
    _channel = null;
  }

  Uri _buildUrl() {
    String baseUrl = config.url ?? _convertToWsUrl(apiUrl);
    if (config.url == null) {
      baseUrl += '/client/features/$environment/stream/ws';
    }

    final uri = Uri.parse(baseUrl);
    final params = <String, String>{
      ...uri.queryParameters,
      'x-api-token': apiToken,
      'appName': appName,
      'environment': environment,
      'connectionId': connectionId,
      'sdkVersion': sdkVersion,
    };
    return uri.replace(queryParameters: params);
  }

  String _convertToWsUrl(String httpUrl) {
    return httpUrl
        .replaceFirst('https://', 'wss://')
        .replaceFirst('http://', 'ws://');
  }

  void _connectWebSocket() {
    try {
      final url = _buildUrl();

      _channel = WebSocketChannel.connect(url);

      // Track recovery
      if (_reconnectCount > 0) {
        _trackRecovery();
      }
      _state = StreamingConnectionState.connected;
      _reconnectAttempt = 0;
      events.emit(GatrixEvents.flagsStreamingConnected);

      // Start ping timer
      _startPingTimer();

      // Listen to messages
      _subscription = _channel!.stream.listen(
        (message) {
          if (_stopRequested) return;
          _processMessage(message as String);
        },
        onError: (error) {
          if (_stopRequested) return;
          _trackError(error.toString());
          events.emit(GatrixEvents.flagsStreamingError, [error.toString()]);

          if (_state != StreamingConnectionState.reconnecting) {
            _state = StreamingConnectionState.reconnecting;
            events.emit(GatrixEvents.flagsStreamingDisconnected);
          }
          _pingTimer?.cancel();
          _scheduleReconnect();
        },
        onDone: () {
          if (_stopRequested || _state == StreamingConnectionState.disconnected) {
            return;
          }

          _state = StreamingConnectionState.reconnecting;
          events.emit(GatrixEvents.flagsStreamingDisconnected);
          _pingTimer?.cancel();
          _scheduleReconnect();
        },
        cancelOnError: true,
      );
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

  void _startPingTimer() {
    _pingTimer?.cancel();
    _pingTimer = Timer.periodic(
      Duration(seconds: config.pingInterval),
      (_) {
        if (_state == StreamingConnectionState.connected && _channel != null) {
          try {
            _channel!.sink.add(jsonEncode({'type': 'ping'}));
          } catch (_) {}
        }
      },
    );
  }

  void _processMessage(String message) {
    try {
      final data = jsonDecode(message) as Map<String, dynamic>;
      final type = data['type'] as String?;
      if (type == null) return;

      // Handle pong locally
      if (type == 'pong') return;

      final eventData = data['data'] as Map<String, dynamic>?;
      _processEvent(type, eventData);
    } catch (_) {}
  }

  void _processEvent(String eventType, Map<String, dynamic>? eventData) {
    _lastEventTime = DateTime.now();
    _eventCount++;

    switch (eventType) {
      case 'connected':
        if (eventData != null) {
          final serverRevision =
              (eventData['globalRevision'] as num?)?.toInt() ?? 0;

          if (serverRevision > _localGlobalRevision &&
              _localGlobalRevision > 0) {
            _localGlobalRevision = serverRevision;
            onFetchRequest?.call();
          } else if (_localGlobalRevision == 0) {
            _localGlobalRevision = serverRevision;
          }
        }
        break;

      case 'flags_changed':
        if (eventData != null) {
          final serverRevision =
              (eventData['globalRevision'] as num?)?.toInt() ?? 0;
          final changedKeys = (eventData['changedKeys'] as List<dynamic>?)
                  ?.map((k) => k.toString())
                  .toList() ??
              [];

          if (serverRevision > _localGlobalRevision) {
            _localGlobalRevision = serverRevision;
            events.emit(GatrixEvents.flagsInvalidated);
            onInvalidation?.call(changedKeys);
          }
        }
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

    if (_reconnectAttempt >= 5 &&
        _state != StreamingConnectionState.degraded) {
      _state = StreamingConnectionState.degraded;
    }

    _reconnectTimer = Timer(
      Duration(milliseconds: delayMs),
      () {
        if (!_stopRequested &&
            _state != StreamingConnectionState.disconnected) {
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
