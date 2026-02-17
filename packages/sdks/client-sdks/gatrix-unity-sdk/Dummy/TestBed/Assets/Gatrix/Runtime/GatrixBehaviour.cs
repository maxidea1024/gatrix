// GatrixBehaviour - MonoBehaviour wrapper for GatrixClient lifecycle
// Attaches SDK to Unity's lifecycle (OnDestroy, OnApplicationQuit)
// Supports both code-based and editor-based (zero-code) initialization

using System.Threading.Tasks;
using UnityEngine;

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

        // ==================== Static State ====================

        private static GatrixBehaviour _instance;
        private static GatrixClient _client;
        private bool _initializedByEditor;

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

                try
                {
                    await _client.StartAsync();
                    Debug.Log("[GatrixSDK] Auto-initialized from editor settings.");
                }
                catch (System.Exception e)
                {
                    Debug.LogError($"[GatrixSDK] Auto-initialization failed: {e.Message}");
                    _client?.Dispose();
                    _client = null;
                    _initializedByEditor = false;
                }
            }
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
            await _client.StartAsync();
        }

        /// <summary>Shutdown the SDK and clean up</summary>
        public static void Shutdown()
        {
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
                _client?.Dispose();
                _client = null;
                _instance = null;
            }
        }
    }
}
