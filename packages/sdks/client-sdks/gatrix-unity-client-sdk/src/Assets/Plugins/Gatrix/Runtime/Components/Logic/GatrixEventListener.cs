// GatrixEventListener - Listen to SDK-level events and fire UnityEvents
// Standalone component that can be placed on any GameObject

using System;
using UnityEngine;
using UnityEngine.Events;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Standalone component for listening to Gatrix SDK events.
    /// Attach to any GameObject to receive SDK lifecycle events as UnityEvents.
    /// Unlike GatrixBehaviour's built-in events, this can be placed anywhere in the scene.
    ///
    /// Usage:
    ///   1. Add this component to any GameObject
    ///   2. Enable events you want to listen to
    ///   3. Wire up UnityEvent callbacks in the Inspector
    ///   4. Events fire automatically when the SDK triggers them
    /// </summary>
    [AddComponentMenu("Gatrix/Event Listener")]
    public class GatrixEventListener : MonoBehaviour
    {
        [Header("SDK Lifecycle")]
        [SerializeField] private EventEntry _onReady = new EventEntry();
        [SerializeField] private EventEntry _onError = new EventEntry();
        [SerializeField] private EventEntry _onRecovered = new EventEntry();

        [Header("Flag Updates")]
        [SerializeField] private EventEntry _onFlagsChanged = new EventEntry();
        [SerializeField] private EventEntry _onFlagsSynced = new EventEntry();
        [SerializeField] private EventEntry _onPendingSync = new EventEntry();
        [SerializeField] private EventEntry _onFlagsRemoved = new EventEntry();
        [SerializeField] private EventEntry _onImpression = new EventEntry();

        [Header("Fetch")]
        [SerializeField] private EventEntry _onFetchStart = new EventEntry();
        [SerializeField] private EventEntry _onFetchSuccess = new EventEntry();
        [SerializeField] private EventEntry _onFetchError = new EventEntry();

        [Header("Streaming")]
        [SerializeField] private EventEntry _onStreamingConnected = new EventEntry();
        [SerializeField] private EventEntry _onStreamingDisconnected = new EventEntry();
        [SerializeField] private EventEntry _onStreamingReconnecting = new EventEntry();

        [Header("Metrics")]
        [SerializeField] private EventEntry _onMetricsSent = new EventEntry();
        [SerializeField] private EventEntry _onMetricsError = new EventEntry();

        // Runtime binding state
        private bool _bound;
        private readonly EventBinding[] _bindings = new EventBinding[16];

        [Serializable]
        public class EventEntry
        {
            [Tooltip("Enable this event listener")]
            public bool enabled;

            [Tooltip("UnityEvent to invoke when the SDK event fires")]
            public UnityEvent onEvent = new UnityEvent();
        }

        // Public accessors for code-based wiring
        public EventEntry OnReady => _onReady;
        public EventEntry OnError => _onError;
        public EventEntry OnRecovered => _onRecovered;
        public EventEntry OnFlagsChanged => _onFlagsChanged;
        public EventEntry OnFlagsSynced => _onFlagsSynced;
        public EventEntry OnPendingSync => _onPendingSync;
        public EventEntry OnFlagsRemoved => _onFlagsRemoved;
        public EventEntry OnFetchStart => _onFetchStart;
        public EventEntry OnFetchSuccess => _onFetchSuccess;
        public EventEntry OnFetchError => _onFetchError;
        public EventEntry OnStreamingConnected => _onStreamingConnected;
        public EventEntry OnStreamingDisconnected => _onStreamingDisconnected;
        public EventEntry OnStreamingReconnecting => _onStreamingReconnecting;
        public EventEntry OnImpression => _onImpression;
        public EventEntry OnMetricsSent => _onMetricsSent;
        public EventEntry OnMetricsError => _onMetricsError;

        private void OnEnable()
        {
            TryBind();
        }

        private void OnDisable()
        {
            Unbind();
        }

        private void Update()
        {
            // Retry binding if client wasn't ready on OnEnable
            if (!_bound)
            {
                TryBind();
            }
        }

        private void TryBind()
        {
            if (_bound) return;

            var client = GatrixBehaviour.Client;
            if (client == null) return;

            _bound = true;

            _bindings[0] = Bind(client, GatrixEvents.FlagsReady, _onReady);
            _bindings[1] = Bind(client, GatrixEvents.FlagsError, _onError);
            _bindings[2] = Bind(client, GatrixEvents.FlagsRecovered, _onRecovered);
            _bindings[3] = Bind(client, GatrixEvents.FlagsChange, _onFlagsChanged);
            _bindings[4] = Bind(client, GatrixEvents.FlagsSync, _onFlagsSynced);
            _bindings[5] = Bind(client, GatrixEvents.FlagsPendingSync, _onPendingSync);
            _bindings[6] = Bind(client, GatrixEvents.FlagsRemoved, _onFlagsRemoved);
            _bindings[7] = Bind(client, GatrixEvents.FlagsFetchStart, _onFetchStart);
            _bindings[8] = Bind(client, GatrixEvents.FlagsFetchSuccess, _onFetchSuccess);
            _bindings[9] = Bind(client, GatrixEvents.FlagsFetchError, _onFetchError);
            _bindings[10] = Bind(client, GatrixEvents.FlagsStreamingConnected, _onStreamingConnected);
            _bindings[11] = Bind(client, GatrixEvents.FlagsStreamingDisconnected, _onStreamingDisconnected);
            _bindings[12] = Bind(client, GatrixEvents.FlagsStreamingReconnecting, _onStreamingReconnecting);
            _bindings[13] = Bind(client, GatrixEvents.FlagsImpression, _onImpression);
            _bindings[14] = Bind(client, GatrixEvents.FlagsMetricsSent, _onMetricsSent);
            _bindings[15] = Bind(client, GatrixEvents.FlagsMetricsError, _onMetricsError);
        }

        private static EventBinding Bind(GatrixClient client, string eventName, EventEntry entry)
        {
            if (!entry.enabled) return null;

            var handler = new GatrixEventHandler(_ => entry.onEvent?.Invoke());
            client.Events.On(eventName, handler);
            return new EventBinding { EventName = eventName, Handler = handler };
        }

        private void Unbind()
        {
            if (!_bound) return;
            _bound = false;

            var client = GatrixBehaviour.Client;
            if (client == null) return;

            for (int i = 0; i < _bindings.Length; i++)
            {
                if (_bindings[i] != null)
                {
                    client.Events.Off(_bindings[i].EventName, _bindings[i].Handler);
                    _bindings[i] = null;
                }
            }
        }

        private class EventBinding
        {
            public string EventName;
            public GatrixEventHandler Handler;
        }
    }
}
