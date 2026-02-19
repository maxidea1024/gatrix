// WatchFlagGroup - Group multiple flag watchers for batch management

using System;
using System.Collections.Generic;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Batch management for multiple flag watchers.
    /// Supports chaining and bulk unsubscribe.
    /// </summary>
    public class WatchFlagGroup
    {
        private readonly FeaturesClient _client;
        private readonly string _name;
        private readonly List<Action> _unsubscribers = new List<Action>(4);

        public WatchFlagGroup(FeaturesClient client, string name)
        {
            _client = client;
            _name = name;
        }

        /// <summary>Get the group name</summary>
        public string GetName() => _name;

        /// <summary>Watch a flag for realtime changes and add to this group (returns this for chaining)</summary>
        public WatchFlagGroup WatchRealtimeFlag(string flagName, GatrixFlagWatchHandler callback)
        {
            var unsubscribe = _client.WatchRealtimeFlag(flagName, callback);
            _unsubscribers.Add(unsubscribe);
            return this;
        }

        /// <summary>Watch a flag for realtime changes with initial state and add to this group</summary>
        public WatchFlagGroup WatchRealtimeFlagWithInitialState(string flagName, GatrixFlagWatchHandler callback)
        {
            var unsubscribe = _client.WatchRealtimeFlagWithInitialState(flagName, callback);
            _unsubscribers.Add(unsubscribe);
            return this;
        }

        /// <summary>Watch a flag for synced changes and add to this group (returns this for chaining)</summary>
        public WatchFlagGroup WatchSyncedFlag(string flagName, GatrixFlagWatchHandler callback)
        {
            var unsubscribe = _client.WatchSyncedFlag(flagName, callback);
            _unsubscribers.Add(unsubscribe);
            return this;
        }

        /// <summary>Watch a flag for synced changes with initial state and add to this group</summary>
        public WatchFlagGroup WatchSyncedFlagWithInitialState(string flagName, GatrixFlagWatchHandler callback)
        {
            var unsubscribe = _client.WatchSyncedFlagWithInitialState(flagName, callback);
            _unsubscribers.Add(unsubscribe);
            return this;
        }

        /// <summary>Unwatch all registered watchers in this group</summary>
        public void UnwatchAll()
        {
            for (int i = 0; i < _unsubscribers.Count; i++)
            {
                _unsubscribers[i]();
            }
            _unsubscribers.Clear();
        }

        /// <summary>Alias for UnwatchAll - destroys the group</summary>
        public void Destroy() => UnwatchAll();

        /// <summary>Get the number of active watchers</summary>
        public int Size => _unsubscribers.Count;
    }
}
