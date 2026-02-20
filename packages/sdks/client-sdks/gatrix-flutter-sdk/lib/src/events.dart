typedef GatrixEventHandler = void Function(List<dynamic> args);

class EventEmitter {
  final Map<String, List<_Listener>> _events = {};
  static int _autoNameCount = 0;

  void on(String event, GatrixEventHandler callback, {String? name}) {
    _events.putIfAbsent(event, () => []);
    _events[event]!.add(_Listener(
      callback: callback,
      name: name ?? 'listener_${++_autoNameCount}',
      registeredAt: DateTime.now(),
      isOnce: false,
    ));
  }

  void once(String event, GatrixEventHandler callback, {String? name}) {
    _events.putIfAbsent(event, () => []);
    _events[event]!.add(_Listener(
      callback: callback,
      name: name ?? 'listener_${++_autoNameCount}',
      registeredAt: DateTime.now(),
      isOnce: true,
    ));
  }

  void off(String event, [GatrixEventHandler? callback]) {
    if (!_events.containsKey(event)) return;
    if (callback == null) {
      _events.remove(event);
    } else {
      _events[event]!.removeWhere((l) => l.callback == callback);
    }
  }

  void emit(String event, [List<dynamic>? args]) {
    if (!_events.containsKey(event)) return;
    final listeners = List<_Listener>.from(_events[event]!);
    for (final listener in listeners) {
      listener.callCount++;
      listener.callback(args ?? []);
      if (listener.isOnce) {
        _events[event]!.remove(listener);
      }
    }
  }

  Map<String, List<Map<String, dynamic>>> getHandlerStats() {
    final stats = <String, List<Map<String, dynamic>>>{};
    _events.forEach((event, listeners) {
      stats[event] = listeners.map((l) => l.toStats()).toList();
    });
    return stats;
  }
}

class _Listener {
  final GatrixEventHandler callback;
  final String name;
  final DateTime registeredAt;
  final bool isOnce;
  int callCount = 0;

  _Listener({
    required this.callback,
    required this.name,
    required this.registeredAt,
    required this.isOnce,
  });

  Map<String, dynamic> toStats() => {
        'name': name,
        'callCount': callCount,
        'isOnce': isOnce,
        'registeredAt': registeredAt.toIso8601String(),
      };
}

class GatrixEvents {
  static const String flagsInit = 'flags.init';
  static const String flagsReady = 'flags.ready';
  static const String flagsChange = 'flags.change';
  static const String sdkError = 'flags.error';
  static const String flagsMetricSent = 'flags.metrics_sent';
  static const String flagsMetricError = 'flags.metrics_error';
  static const String flagsSync = 'flags.sync';
  static const String flagsPendingSync = 'flags.pending_sync';
  static const String flagsRemoved = 'flags.removed';
  static const String flagsRecovered = 'flags.recovered';
  static const String flagsFetchStart = 'flags.fetch_start';
  static const String flagsFetchEnd = 'flags.fetch_end';
  static const String flagsImpression = 'flags.impression';

  // Streaming events
  static const String flagsStreamingConnected = 'flags.streaming.connected';
  static const String flagsStreamingDisconnected = 'flags.streaming.disconnected';
  static const String flagsStreamingReconnecting = 'flags.streaming.reconnecting';
  static const String flagsStreamingError = 'flags.streaming.error';
  static const String flagsInvalidated = 'flags.invalidated';

  static String flagChange(String flagName) => 'flags.$flagName.change';
}
