// WatchFlagGroup - Group multiple flag watchers for batch management.
// Avoids circular imports by accepting function references instead of FeaturesClient directly.

import 'flag_proxy.dart';

/// Callback type for flag watch handlers. Receives a FlagProxy for the changed flag.
typedef GatrixFlagWatchHandler = void Function(FlagProxy proxy);

/// Batch management container for multiple flag watchers.
/// All watchers in the group can be cancelled at once via [unwatchAll].
///
/// Obtain via [FeaturesClient.createWatchGroup].
class WatchFlagGroup {
  final String _name;
  final List<void Function()> _unsubscribers = [];

  // Function references injected by FeaturesClient to avoid circular imports.
  final void Function() Function(String, GatrixFlagWatchHandler)
      _watchRealtime;
  final void Function() Function(String, GatrixFlagWatchHandler)
      _watchRealtimeWithInitial;
  final void Function() Function(String, GatrixFlagWatchHandler) _watchSynced;
  final void Function() Function(String, GatrixFlagWatchHandler)
      _watchSyncedWithInitial;

  WatchFlagGroup({
    required String name,
    required void Function() Function(String, GatrixFlagWatchHandler)
        watchRealtime,
    required void Function() Function(String, GatrixFlagWatchHandler)
        watchRealtimeWithInitial,
    required void Function() Function(String, GatrixFlagWatchHandler)
        watchSynced,
    required void Function() Function(String, GatrixFlagWatchHandler)
        watchSyncedWithInitial,
  })  : _name = name,
        _watchRealtime = watchRealtime,
        _watchRealtimeWithInitial = watchRealtimeWithInitial,
        _watchSynced = watchSynced,
        _watchSyncedWithInitial = watchSyncedWithInitial;

  /// The group name.
  String get name => _name;

  /// Number of active watchers in this group.
  int get size => _unsubscribers.length;

  /// Watch a flag for realtime changes and add to this group.
  /// Returns [this] for chaining.
  WatchFlagGroup watchRealtimeFlag(
      String flagName, GatrixFlagWatchHandler callback) {
    _unsubscribers.add(_watchRealtime(flagName, callback));
    return this;
  }

  /// Watch a flag for realtime changes with immediate initial state callback.
  /// Returns [this] for chaining.
  WatchFlagGroup watchRealtimeFlagWithInitialState(
      String flagName, GatrixFlagWatchHandler callback) {
    _unsubscribers.add(_watchRealtimeWithInitial(flagName, callback));
    return this;
  }

  /// Watch a flag for synced changes and add to this group.
  /// Returns [this] for chaining.
  WatchFlagGroup watchSyncedFlag(
      String flagName, GatrixFlagWatchHandler callback) {
    _unsubscribers.add(_watchSynced(flagName, callback));
    return this;
  }

  /// Watch a flag for synced changes with immediate initial state callback.
  /// Returns [this] for chaining.
  WatchFlagGroup watchSyncedFlagWithInitialState(
      String flagName, GatrixFlagWatchHandler callback) {
    _unsubscribers.add(_watchSyncedWithInitial(flagName, callback));
    return this;
  }

  /// Cancel all watchers registered in this group.
  void unwatchAll() {
    for (final unsub in _unsubscribers) {
      unsub();
    }
    _unsubscribers.clear();
  }

  /// Alias for [unwatchAll].
  void destroy() => unwatchAll();
}
