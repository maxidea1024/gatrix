// GatrixBehaviour - MonoBehaviour wrapper for GatrixClient lifecycle
// Attaches SDK to Unity's lifecycle (OnDestroy, OnApplicationQuit)
// Supports both code-based and editor-based (zero-code) initialization
// Includes toggleable SDK event listeners wired via UnityEvents

using System;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.Events;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// MonoBehaviour wrapper for GatrixClient.
    /// Manages SDK lifecycle tied to Unity's application lifecycle.
    /// Provides a singleton-like access pattern for convenience.
    ///
    /// Usage (Zero-Code):
    ///   1. Create a GatrixSettings asset: Assets > Create > Gatrix > Settings
    ///   2. Add GatrixBehaviour to a GameObject: Component > Gatrix > Gatrix Behaviour
    ///   3. Assign the settings asset and check "Auto Initialize"
    ///
    /// Usage (Code-Based):
    ///   await GatrixBehaviour.InitializeAsync(config);
    /// </summary>
    [AddComponentMenu("Gatrix/Gatrix Behaviour")]
    public class GatrixBehaviour : MonoBehaviour
    {
        // ==================== Editor Fields ====================

        [Header("Editor Setup (Zero-Code Initialization)")]

        [Tooltip("Assign a GatrixSettings asset for editor-based configuration")]
        [SerializeField] private GatrixSettings _settings;

        [Tooltip("Automatically initialize the SDK on Awake")]
        [SerializeField] private bool _autoInitialize;

        [Tooltip("Don't destroy this GameObject on scene load")]
        [SerializeField] private bool _dontDestroyOnLoad = true;

        // ==================== Event Listeners ====================

        [Header("SDK Event Listeners")]

        [SerializeField] private SdkEventEntry _onReady = new SdkEventEntry("flags.ready");
        [SerializeField] private SdkEventEntry _onFlagsChanged = new SdkEventEntry("flags.change");
        [SerializeField] private SdkEventEntry _onError = new SdkEventEntry("flags.error");
        [SerializeField] private SdkEventEntry _onFetchStart = new SdkEventEntry("flags.fetch_start");
        [SerializeField] private SdkEventEntry _onFetchSuccess = new SdkEventEntry("flags.fetch_success");
        [SerializeField] private SdkEventEntry _onFetchError = new SdkEventEntry("flags.fetch_error");
        [SerializeField] private SdkEventEntry _onRecovered = new SdkEventEntry("flags.recovered");
        [SerializeField] private SdkEventEntry _onStreamingConnected = new SdkEventEntry("flags.streaming_connected");
        [SerializeField] private SdkEventEntry _onStreamingDisconnected = new SdkEventEntry("flags.streaming_disconnected");
        [SerializeField] private SdkEventEntry _onImpression = new SdkEventEntry("flags.impression");

        // ==================== Static State ====================

        private static GatrixBehaviour _instance;
        private static GatrixClient _client;
        private bool _initializedByEditor;
        private bool _eventsBound;

        /// <summary>Get the active GatrixClient instance</summary>
        public static GatrixClient Client => _client;

        /// <summary>Check if SDK is initialized</summary>
        public static bool IsInitialized => _client != null && _client.IsStarted;

        // ==================== Editor Properties ====================

        /// <summary>Get/set the settings asset (for editor use)</summary>
        public GatrixSettings Settings
        {
            get => _settings;
            set => _settings = value;
        }

        /// <summary>Get/set auto-initialize flag (for editor use)</summary>
        public bool AutoInitialize
        {
            get => _autoInitialize;
            set => _autoInitialize = value;
        }

        // ==================== Lifecycle ====================

        private async void Awake()
        {
            // Singleton enforcement
            if (_instance != null && _instance != this)
            {
                Debug.LogWarning("[GatrixSDK] Duplicate GatrixBehaviour detected. Destroying this instance.");
                Destroy(gameObject);
                return;
            }

            _instance = this;

            if (_dontDestroyOnLoad)
            {
                DontDestroyOnLoad(gameObject);
            }

            // Auto-initialize from editor settings
            if (_autoInitialize && _settings != null && _client == null)
            {
                if (!_settings.IsValid(out var error))
                {
                    Debug.LogError($"[GatrixSDK] Settings validation failed: {error}");
                    return;
                }

                MainThreadDispatcher.Initialize();

                var config = _settings.ToConfig();
                _client = new GatrixClient(config);
                _initializedByEditor = true;

                BindEvents();

                try
                {
                    await _client.StartAsync();
                    Debug.Log("[GatrixSDK] Auto-initialized from editor settings.");
                }
                catch (Exception e)
                {
                    Debug.LogError($"[GatrixSDK] Auto-initialization failed: {e.Message}");
                    UnbindEvents();
                    _client?.Dispose();
                    _client = null;
                    _initializedByEditor = false;
                }
            }
        }

        // ==================== Event Binding ====================

        private void BindEvents()
        {
            if (_eventsBound || _client == null) return;
            _eventsBound = true;

            BindEvent(_onReady);
            BindEvent(_onFlagsChanged);
            BindEvent(_onError);
            BindEvent(_onFetchStart);
            BindEvent(_onFetchSuccess);
            BindEvent(_onFetchError);
            BindEvent(_onRecovered);
            BindEvent(_onStreamingConnected);
            BindEvent(_onStreamingDisconnected);
            BindEvent(_onImpression);
        }

        private void UnbindEvents()
        {
            if (!_eventsBound || _client == null) return;
            _eventsBound = false;

            UnbindEvent(_onReady);
            UnbindEvent(_onFlagsChanged);
            UnbindEvent(_onError);
            UnbindEvent(_onFetchStart);
            UnbindEvent(_onFetchSuccess);
            UnbindEvent(_onFetchError);
            UnbindEvent(_onRecovered);
            UnbindEvent(_onStreamingConnected);
            UnbindEvent(_onStreamingDisconnected);
            UnbindEvent(_onImpression);
        }

        private void BindEvent(SdkEventEntry entry)
        {
            if (!entry.enabled || string.IsNullOrEmpty(entry.eventName)) return;
            entry.handler = (args) => entry.callback?.Invoke();
            _client.Events.On(entry.eventName, entry.handler);
        }

        private void UnbindEvent(SdkEventEntry entry)
        {
            if (entry.handler == null || string.IsNullOrEmpty(entry.eventName)) return;
            _client.Events.Off(entry.eventName, entry.handler);
            entry.handler = null;
        }

        // ==================== Code-Based Initialization ====================

        /// <summary>
        /// Initialize the SDK with the given config (code-based).
        /// Creates a persistent GameObject if none exists.
        /// </summary>
        public static async ValueTask InitializeAsync(GatrixClientConfig config)
        {
            if (_client != null)
            {
                Debug.LogWarning("[GatrixSDK] Already initialized. Call Shutdown() first.");
                return;
            }

            // Initialize main thread dispatcher first (must be on main thread)
            MainThreadDispatcher.Initialize();

            // Create persistent game object
            if (_instance == null)
            {
                var go = new GameObject("[GatrixSDK]");
                DontDestroyOnLoad(go);
                _instance = go.AddComponent<GatrixBehaviour>();
            }

            _client = new GatrixClient(config);

            // Bind events if any are configured on the instance
            _instance.BindEvents();

            await _client.StartAsync();
        }

        /// <summary>Shutdown the SDK and clean up</summary>
        public static void Shutdown()
        {
            if (_instance != null)
            {
                _instance.UnbindEvents();
            }

            if (_client != null)
            {
                _client.Dispose();
                _client = null;
            }

            if (_instance != null)
            {
                // Only destroy the GameObject if it was created by code
                if (!_instance._initializedByEditor)
                {
                    Destroy(_instance.gameObject);
                }
                _instance._initializedByEditor = false;
                _instance = null;
            }
        }

        private void OnApplicationQuit()
        {
            Shutdown();
        }

        private void OnDestroy()
        {
            if (_instance == this)
            {
                UnbindEvents();
                _client?.Dispose();
                _client = null;
                _instance = null;
            }
        }

        // ==================== Event Entry Definition ====================

        /// <summary>
        /// Serializable event entry with enable/disable toggle and UnityEvent callback.
        /// Each entry maps an SDK event name to a UnityEvent with a checkbox to toggle it.
        /// </summary>
        [Serializable]
        public class SdkEventEntry
        {
            [Tooltip("Enable/disable this event listener")]
            public bool enabled;

            [HideInInspector]
            public string eventName;

            [Tooltip("UnityEvent to fire when this SDK event occurs")]
            public UnityEvent callback = new UnityEvent();

            // Runtime-only: the delegate reference for unsubscribing
            [NonSerialized]
            public GatrixEventHandler handler;

            public SdkEventEntry() { }

            public SdkEventEntry(string eventName)
            {
                this.eventName = eventName;
                this.enabled = false;
            }
        }
    }
}
