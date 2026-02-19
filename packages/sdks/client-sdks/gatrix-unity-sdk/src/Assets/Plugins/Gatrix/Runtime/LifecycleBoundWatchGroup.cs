// LifecycleBoundWatchGroup - Watch group that respects MonoBehaviour lifecycle
// Callbacks only fire when the owner is active and enabled.

using System;
using System.Collections.Generic;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// A watch group that respects the owning MonoBehaviour's lifecycle.
    /// <para>
    /// - Callbacks only fire when the owner is active and enabled.
    /// - WithInitialState callbacks are deferred until OnEnable if the owner starts disabled.
    /// - Automatically cleaned up when the owner GameObject is destroyed.
    /// </para>
    /// Created via <c>this.CreateGatrixWatchGroup("name")</c> extension method.
    /// </summary>
    public class LifecycleBoundWatchGroup
    {
        private readonly FeaturesClient _client;
        private readonly string _name;
        private readonly GatrixLifecycleGuard _guard;
        private readonly List<Action> _unsubscribers = new List<Action>(4);

        internal LifecycleBoundWatchGroup(FeaturesClient client, string name, GatrixLifecycleGuard guard)
        {
            _client = client;
            _name = name;
            _guard = guard;
        }

        /// <summary>Get the group name</summary>
        public string GetName() => _name;

        /// <summary>Watch a flag for realtime changes (chaining supported)</summary>
        public LifecycleBoundWatchGroup WatchRealtimeFlag(string flagName, GatrixFlagWatchHandler callback)
        {
            var unsub = _client.WatchRealtimeFlag(flagName, WrapCallback(callback));
            _unsubscribers.Add(unsub);
            return this;
        }

        /// <summary>Watch a flag for realtime changes with initial state (chaining supported)</summary>
        public LifecycleBoundWatchGroup WatchRealtimeFlagWithInitialState(string flagName, GatrixFlagWatchHandler callback)
        {
            FlagProxy pendingProxy = null;

            var unsub = _client.WatchRealtimeFlagWithInitialState(flagName, proxy =>
            {
                if (_guard != null && _guard.IsActive)
                {
                    callback(proxy);
                    pendingProxy = null;
                }
                else
                {
                    pendingProxy = proxy;
                }
            });
            _unsubscribers.Add(unsub);

            _guard.AddOnEnableAction(() =>
            {
                if (pendingProxy != null)
                {
                    callback(pendingProxy);
                    pendingProxy = null;
                }
            });

            return this;
        }

        /// <summary>Watch a flag for synced changes (chaining supported)</summary>
        public LifecycleBoundWatchGroup WatchSyncedFlag(string flagName, GatrixFlagWatchHandler callback)
        {
            var unsub = _client.WatchSyncedFlag(flagName, WrapCallback(callback));
            _unsubscribers.Add(unsub);
            return this;
        }

        /// <summary>Watch a flag for synced changes with initial state (chaining supported)</summary>
        public LifecycleBoundWatchGroup WatchSyncedFlagWithInitialState(string flagName, GatrixFlagWatchHandler callback)
        {
            FlagProxy pendingProxy = null;

            var unsub = _client.WatchSyncedFlagWithInitialState(flagName, proxy =>
            {
                if (_guard != null && _guard.IsActive)
                {
                    callback(proxy);
                    pendingProxy = null;
                }
                else
                {
                    pendingProxy = proxy;
                }
            });
            _unsubscribers.Add(unsub);

            _guard.AddOnEnableAction(() =>
            {
                if (pendingProxy != null)
                {
                    callback(pendingProxy);
                    pendingProxy = null;
                }
            });

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

        private GatrixFlagWatchHandler WrapCallback(GatrixFlagWatchHandler callback)
        {
            return proxy =>
            {
                if (_guard != null && _guard.IsActive)
                {
                    callback(proxy);
                }
            };
        }
    }
}
