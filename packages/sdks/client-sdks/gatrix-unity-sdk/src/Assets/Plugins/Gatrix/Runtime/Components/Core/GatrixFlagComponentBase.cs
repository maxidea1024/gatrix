// GatrixFlagComponentBase - Base class for all Gatrix flag-binding components
// Consolidates common fields (_flagName, _use) and subscription lifecycle.

using System;
using UnityEngine;
using UnityEngine.Serialization;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Base class for components that bind to a Gatrix feature flag.
    /// Manages the subscription lifecycle and provides a common interface for the inspector.
    /// </summary>
    public abstract class GatrixFlagComponentBase : MonoBehaviour
    {
        [GatrixFlagName]
        [SerializeField] protected string _flagName;

        [Tooltip("Use Realtime mode for immediate updates, or Synced mode for controlled updates")]
        [FormerlySerializedAs("_useRealtime")]
        [SerializeField] protected bool _use = true;

        protected Action _unwatch;

        protected virtual void OnEnable()
        {
            if (GatrixBehaviour.IsInitialized)
            {
                Resubscribe();
            }
            else
            {
                // Wait for SDK to be ready if it's not yet
                GatrixBehaviour.Client?.On(GatrixEvents.FlagsReady, _ => Resubscribe(), "Base:SubscribeOnReady");
            }
        }

        protected virtual void OnDisable()
        {
            // Safe teardown: may not be subscribed if _flagName was empty or SDK not ready.
            if (_unwatch != null)
            {
                _unwatch.Invoke();
                _unwatch = null;
            }
        }

        protected virtual void Subscribe()
        {
            if (_unwatch != null)
            {
                Debug.LogWarning($"[Gatrix] {GetType().Name} Subscribe() called while already subscribed. Use Resubscribe() to replace an existing watcher.", this);
                return;
            }

            var client = GatrixBehaviour.Client;
            if (client == null || string.IsNullOrEmpty(_flagName)) return;

            // Include instanceID to distinguish objects with the same name (e.g. multiple enemies)
            string componentName = $"{GetType().Name}:{gameObject.name}(#{gameObject.GetInstanceID()})";

            if (_use)
            {
                _unwatch = client.Features.WatchRealtimeFlagWithInitialState(_flagName, OnFlagChanged, componentName);
            }
            else
            {
                _unwatch = client.Features.WatchSyncedFlagWithInitialState(_flagName, OnFlagChanged, componentName);
            }
        }

        protected virtual void Unsubscribe()
        {
            if (_unwatch == null)
            {
                Debug.LogWarning($"[Gatrix] {GetType().Name} Unsubscribe() called while not subscribed.", this);
                return;
            }

            _unwatch.Invoke();
            _unwatch = null;
        }

        /// <summary>
        /// Cleanly re-subscribes to the current flag, replacing any existing watcher.
        /// Equivalent to Unsubscribe() followed by Subscribe().
        /// </summary>
        protected void Resubscribe()
        {
            // Suppress individual Subscribe/Unsubscribe warnings — this is an intentional replace.
            if (_unwatch != null)
            {
                _unwatch.Invoke();
                _unwatch = null;
            }
            Subscribe();
        }

        /// <summary>
        /// Called whenever the watched flag changes.
        /// </summary>
        /// <param name="flag">The latest flag state proxy.</param>
        protected abstract void OnFlagChanged(FlagProxy flag);

#if UNITY_EDITOR
        protected virtual void OnValidate()
        {
            // Re-subscribe when _flagName or _use changes in the Inspector during Play Mode.
            // OnValidate() is called by Unity whenever a serialized field is modified.
            if (Application.isPlaying && GatrixBehaviour.IsInitialized)
            {
                Resubscribe();
            }
        }
#endif
    }
}
