// GatrixWatchExtensions - Extension methods for lifecycle-bound flag watching
// Binds Watch subscriptions to a MonoBehaviour's enable/disable/destroy lifecycle

using System;
using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Extension methods for binding Gatrix flag watches to a MonoBehaviour's lifecycle.
    /// <para>
    /// <b>Behavior:</b>
    /// <list type="bullet">
    /// <item><description>Callbacks only fire when the owning MonoBehaviour is active and enabled.</description></item>
    /// <item><description>WithInitialState callbacks are deferred until OnEnable if the owner is disabled at registration time.</description></item>
    /// <item><description>All subscriptions are automatically cleaned up when the owner's GameObject is destroyed.</description></item>
    /// </list>
    /// </para>
    /// <para>
    /// <b>Usage:</b>
    /// <code>
    /// // Individual watches
    /// this.WatchRealtimeFlag("my-flag", proxy => { ... });
    /// this.WatchRealtimeFlagWithInitialState("my-flag", proxy => { ... });
    /// this.WatchSyncedFlagWithInitialState("my-flag", proxy => { ... });
    ///
    /// // Lifecycle-bound watch group
    /// var group = this.CreateGatrixWatchGroup("combat");
    /// group.WatchSyncedFlag("enemy-hp", p => { ... })
    ///      .WatchSyncedFlag("boss-buff", p => { ... });
    /// </code>
    /// </para>
    /// </summary>
    public static class GatrixWatchExtensions
    {
        // ==================== Individual Watch Methods ====================

        /// <summary>
        /// Watch a flag for realtime changes, bound to this MonoBehaviour's lifecycle.
        /// Callbacks only fire when active and enabled. Auto-cleanup on destroy.
        /// </summary>
        /// <returns>Unsubscribe action for manual cleanup (optional — destroy cleanup is automatic)</returns>
        public static Action WatchRealtimeFlag(this MonoBehaviour owner,
            string flagName, GatrixFlagWatchHandler callback)
        {
            var features = GatrixBehaviour.Client?.Features;
            if (features == null) return NoOp;

            var guard = GatrixLifecycleGuard.GetOrAdd(owner);
            var unsub = features.WatchRealtimeFlag(flagName, WrapCallback(guard, callback));
            guard.Track(unsub);
            return unsub;
        }

        /// <summary>
        /// Watch a flag for realtime changes with initial state, bound to this MonoBehaviour's lifecycle.
        /// If the owner is disabled at registration time, the initial callback is deferred until OnEnable.
        /// </summary>
        /// <returns>Unsubscribe action for manual cleanup (optional — destroy cleanup is automatic)</returns>
        public static Action WatchRealtimeFlagWithInitialState(this MonoBehaviour owner,
            string flagName, GatrixFlagWatchHandler callback)
        {
            var features = GatrixBehaviour.Client?.Features;
            if (features == null) return NoOp;

            var guard = GatrixLifecycleGuard.GetOrAdd(owner);
            FlagProxy pendingProxy = null;

            var unsub = features.WatchRealtimeFlagWithInitialState(flagName, proxy =>
            {
                if (guard.IsActive)
                {
                    callback(proxy);
                    pendingProxy = null;
                }
                else
                {
                    pendingProxy = proxy;
                }
            });
            guard.Track(unsub);

            guard.AddOnEnableAction(() =>
            {
                if (pendingProxy != null)
                {
                    callback(pendingProxy);
                    pendingProxy = null;
                }
            });

            return unsub;
        }

        /// <summary>
        /// Watch a flag for synced changes, bound to this MonoBehaviour's lifecycle.
        /// Callbacks only fire when active and enabled. Auto-cleanup on destroy.
        /// </summary>
        /// <returns>Unsubscribe action for manual cleanup (optional — destroy cleanup is automatic)</returns>
        public static Action WatchSyncedFlag(this MonoBehaviour owner,
            string flagName, GatrixFlagWatchHandler callback)
        {
            var features = GatrixBehaviour.Client?.Features;
            if (features == null) return NoOp;

            var guard = GatrixLifecycleGuard.GetOrAdd(owner);
            var unsub = features.WatchSyncedFlag(flagName, WrapCallback(guard, callback));
            guard.Track(unsub);
            return unsub;
        }

        /// <summary>
        /// Watch a flag for synced changes with initial state, bound to this MonoBehaviour's lifecycle.
        /// If the owner is disabled at registration time, the initial callback is deferred until OnEnable.
        /// </summary>
        /// <returns>Unsubscribe action for manual cleanup (optional — destroy cleanup is automatic)</returns>
        public static Action WatchSyncedFlagWithInitialState(this MonoBehaviour owner,
            string flagName, GatrixFlagWatchHandler callback)
        {
            var features = GatrixBehaviour.Client?.Features;
            if (features == null) return NoOp;

            var guard = GatrixLifecycleGuard.GetOrAdd(owner);
            FlagProxy pendingProxy = null;

            var unsub = features.WatchSyncedFlagWithInitialState(flagName, proxy =>
            {
                if (guard.IsActive)
                {
                    callback(proxy);
                    pendingProxy = null;
                }
                else
                {
                    pendingProxy = proxy;
                }
            });
            guard.Track(unsub);

            guard.AddOnEnableAction(() =>
            {
                if (pendingProxy != null)
                {
                    callback(pendingProxy);
                    pendingProxy = null;
                }
            });

            return unsub;
        }

        // ==================== Lifecycle-Bound Watch Group ====================

        /// <summary>
        /// Create a watch group bound to this MonoBehaviour's lifecycle.
        /// All callbacks in the group only fire when the owner is active and enabled.
        /// The group is automatically destroyed when the owner's GameObject is destroyed.
        /// </summary>
        public static LifecycleBoundWatchGroup CreateGatrixWatchGroup(this MonoBehaviour owner, string name)
        {
            var features = GatrixBehaviour.Client?.Features;
            if (features == null) return null;

            var guard = GatrixLifecycleGuard.GetOrAdd(owner);
            var group = new LifecycleBoundWatchGroup(features, name, guard);
            guard.Track(() => group.Destroy());
            return group;
        }

        // ==================== Helpers ====================

        private static readonly Action NoOp = () => { };

        private static GatrixFlagWatchHandler WrapCallback(
            GatrixLifecycleGuard guard, GatrixFlagWatchHandler callback)
        {
            return proxy =>
            {
                if (guard != null && guard.IsActive)
                {
                    callback(proxy);
                }
            };
        }
    }
}
