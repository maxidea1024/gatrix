// GatrixBehaviour - MonoBehaviour wrapper for GatrixClient lifecycle
// Attaches SDK to Unity's lifecycle (OnDestroy, OnApplicationQuit)

using System.Threading.Tasks;
using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// MonoBehaviour wrapper for GatrixClient.
    /// Manages SDK lifecycle tied to Unity's application lifecycle.
    /// Provides a singleton-like access pattern for convenience.
    /// </summary>
    public class GatrixBehaviour : MonoBehaviour
    {
        private static GatrixBehaviour _instance;
        private static GatrixClient _client;

        /// <summary>Get the active GatrixClient instance</summary>
        public static GatrixClient Client => _client;

        /// <summary>Check if SDK is initialized</summary>
        public static bool IsInitialized => _client != null && _client.IsStarted;

        /// <summary>
        /// Initialize the SDK with the given config.
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
                Destroy(_instance.gameObject);
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
