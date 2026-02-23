// GatrixLifecycleGuard - Internal component for binding watch subscriptions to GameObject lifecycle
// Auto-attached by GatrixWatchExtensions. Hidden from Add Component menu.

using System;
using System.Collections.Generic;
using UnityEngine;

namespace Gatrix.Unity.SDK.Extensions
{
    /// <summary>
    /// Internal MonoBehaviour that binds flag watch subscriptions to a GameObject's lifecycle.
    /// <para>
    /// - Callbacks only fire when the component is active and enabled.
    /// - Initial state callbacks are deferred until OnEnable if the object starts disabled.
    /// - All subscriptions are automatically cleaned up on OnDestroy.
    /// </para>
    /// Auto-attached when using lifecycle-bound Watch extension methods.
    /// </summary>
    [AddComponentMenu("")]
    internal class GatrixLifecycleGuard : MonoBehaviour
    {
        private readonly List<Action> _cleanups = new List<Action>(4);
        private List<Action> _onEnableActions;

        /// <summary>Whether the owning GameObject is active and enabled</summary>
        internal bool IsActive => isActiveAndEnabled;

        /// <summary>Track an unsubscribe action for auto-cleanup on destroy</summary>
        internal void Track(Action cleanup)
        {
            _cleanups.Add(cleanup);
        }

        /// <summary>
        /// Register an action to run on every OnEnable.
        /// Used for deferred initial state delivery and pending proxy flush.
        /// </summary>
        internal void AddOnEnableAction(Action action)
        {
            _onEnableActions ??= new List<Action>(2);
            _onEnableActions.Add(action);
        }

        private void OnEnable()
        {
            if (_onEnableActions == null) return;

            // Use index loop to avoid allocation from enumerator
            for (int i = 0; i < _onEnableActions.Count; i++)
            {
                try
                {
                    _onEnableActions[i]?.Invoke();
                }
                catch (Exception ex)
                {
                    Debug.LogException(ex, this);
                }
            }
        }

        private void OnDestroy()
        {
            for (int i = 0; i < _cleanups.Count; i++)
            {
                try
                {
                    _cleanups[i]?.Invoke();
                }
                catch (Exception ex)
                {
                    Debug.LogException(ex, this);
                }
            }
            _cleanups.Clear();
            _onEnableActions?.Clear();
        }

        /// <summary>Get or create a lifecycle guard on the given MonoBehaviour's GameObject</summary>
        internal static GatrixLifecycleGuard GetOrAdd(MonoBehaviour owner)
        {
            var guard = owner.GetComponent<GatrixLifecycleGuard>();
            if (guard == null)
            {
                guard = owner.gameObject.AddComponent<GatrixLifecycleGuard>();
            }
            return guard;
        }
    }
}
