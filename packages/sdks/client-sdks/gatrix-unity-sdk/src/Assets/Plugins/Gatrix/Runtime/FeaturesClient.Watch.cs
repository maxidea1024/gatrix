// FeaturesClient.Watch - Flag watching and callback management
// Handles realtime/synced flag watchers and watch groups

using System;
using System.Collections.Generic;

namespace Gatrix.Unity.SDK
{
    public partial class FeaturesClient
    {
        // ==================== Watch ====================

        /// <summary>Watch a flag for realtime changes. Returns unsubscribe action.</summary>
        public Action WatchRealtimeFlag(string flagName, GatrixFlagWatchHandler callback, string name = null)
        {
            if (!_watchCallbacks.TryGetValue(flagName, out var callbacks))
            {
                callbacks = new List<GatrixFlagWatchHandler>();
                _watchCallbacks[flagName] = callbacks;
            }
            callbacks.Add(callback);

            return () =>
            {
                if (_watchCallbacks.TryGetValue(flagName, out var cbs))
                {
                    cbs.Remove(callback);
                }
            };
        }

        /// <summary>Watch a flag for realtime changes with initial state callback.
        /// Initial state always uses realtimeFlags (latest server state).</summary>
        public Action WatchRealtimeFlagWithInitialState(string flagName, GatrixFlagWatchHandler callback, string name = null)
        {
            var unsubscribe = WatchRealtimeFlag(flagName, callback, name);

            // Emit initial state — always use realtimeFlags for realtime watchers
            if (_readyEventEmitted)
            {
                callback(new FlagProxy(this, flagName, true));
            }
            else
            {
                _emitter.Once(GatrixEvents.FlagsReady, _ =>
                {
                    callback(new FlagProxy(this, flagName, true));
                }, name != null ? $"{name}_initial" : null);
            }

            return unsubscribe;
        }

        /// <summary>Watch a flag for synced changes. In explicitSyncMode, reacts only
        /// when SyncFlagsAsync() is called. In normal mode, behaves like realtime.</summary>
        public Action WatchSyncedFlag(string flagName, GatrixFlagWatchHandler callback, string name = null)
        {
            if (!_syncedWatchCallbacks.TryGetValue(flagName, out var callbacks))
            {
                callbacks = new List<GatrixFlagWatchHandler>();
                _syncedWatchCallbacks[flagName] = callbacks;
            }
            callbacks.Add(callback);

            return () =>
            {
                if (_syncedWatchCallbacks.TryGetValue(flagName, out var cbs))
                {
                    cbs.Remove(callback);
                }
            };
        }

        /// <summary>Watch a flag for synced changes with initial state callback.
        /// Initial state uses synchronizedFlags in explicitSyncMode.</summary>
        public Action WatchSyncedFlagWithInitialState(string flagName, GatrixFlagWatchHandler callback, string name = null)
        {
            var unsubscribe = WatchSyncedFlag(flagName, callback, name);

            // Emit initial state — respect explicitSyncMode for synced watchers
            if (_readyEventEmitted)
            {
                callback(new FlagProxy(this, flagName));
            }
            else
            {
                _emitter.Once(GatrixEvents.FlagsReady, _ =>
                {
                    callback(new FlagProxy(this, flagName));
                }, name != null ? $"{name}_initial" : null);
            }

            return unsubscribe;
        }

        /// <summary>Create a watch group for batch management</summary>
        public WatchFlagGroup CreateWatchGroup(string name)
        {
            var group = new WatchFlagGroup(this, name);
            _watchGroups[name] = group;
            return group;
        }

        /// <summary>Emit per-flag change events and track removed flags.</summary>
        private void EmitRealtimeFlagChanges(
            Dictionary<string, EvaluatedFlag> oldFlags,
            Dictionary<string, EvaluatedFlag> newFlags)
        {
            var isInitialLoad = oldFlags.Count == 0;
            var now = DateTime.UtcNow;

            // Check for changed/new flags
            foreach (var kvp in newFlags)
            {
                oldFlags.TryGetValue(kvp.Key, out var oldFlag);
                if (oldFlag == null || oldFlag.Version != kvp.Value.Version)
                {
                    var changeType = oldFlag == null ? "created" : "updated";
                    if (!isInitialLoad)
                    {
                        _flagLastChangedTimes[kvp.Key] = now;
                    }
                    _emitter.Emit(GatrixEvents.FlagChange(kvp.Key), kvp.Value, oldFlag, changeType);
                }
            }

            // Check for removed flags - emit bulk event, not per-flag change
            var removedNames = new List<string>();
            foreach (var kvp in oldFlags)
            {
                if (!newFlags.ContainsKey(kvp.Key))
                {
                    removedNames.Add(kvp.Key);
                    _flagLastChangedTimes[kvp.Key] = now;
                }
            }
            if (removedNames.Count > 0)
            {
                _emitter.Emit(GatrixEvents.FlagsRemoved, removedNames.ToArray());
            }
        }

        /// <summary>Invoke watch callbacks for changed flags.
        /// Used by both realtime and synced watch systems.</summary>
        private void InvokeWatchCallbacks(
            Dictionary<string, List<GatrixFlagWatchHandler>> callbackMap,
            Dictionary<string, EvaluatedFlag> oldFlags,
            Dictionary<string, EvaluatedFlag> newFlags)
        {
            var now = DateTime.UtcNow;

            // Check for changed/new flags
            foreach (var kvp in newFlags)
            {
                oldFlags.TryGetValue(kvp.Key, out var oldFlag);
                if (oldFlag == null || oldFlag.Version != kvp.Value.Version)
                {
                    _flagLastChangedTimes[kvp.Key] = now;

                    if (callbackMap.TryGetValue(kvp.Key, out var callbacks) && callbacks.Count > 0)
                    {
                        var proxy = new FlagProxy(this, kvp.Key);
                        foreach (var cb in callbacks.ToArray()) // copy to avoid mutation during iteration
                        {
                            try
                            {
                                cb(proxy);
                            }
                            catch (Exception ex)
                            {
                                _logger?.Error($"Error in watch callback for {kvp.Key}: {ex.Message}");
                            }
                        }
                    }
                }
            }

            // Check for removed flags
            foreach (var kvp in oldFlags)
            {
                if (!newFlags.ContainsKey(kvp.Key))
                {
                    if (callbackMap.TryGetValue(kvp.Key, out var callbacks) && callbacks.Count > 0)
                    {
                        var proxy = new FlagProxy(this, kvp.Key);
                        foreach (var cb in callbacks.ToArray())
                        {
                            try
                            {
                                cb(proxy);
                            }
                            catch (Exception ex)
                            {
                                _logger?.Error($"Error in watch callback for removed flag {kvp.Key}: {ex.Message}");
                            }
                        }
                    }
                }
            }
        }
    }
}
