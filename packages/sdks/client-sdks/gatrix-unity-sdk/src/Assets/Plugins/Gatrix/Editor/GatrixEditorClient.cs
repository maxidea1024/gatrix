// GatrixEditorClient - Editor-only flag client for Edit Mode preview
// Initialized from the local cache on every assembly reload so that
// GatrixBehaviour.Client is non-null even outside Play Mode.

#if UNITY_EDITOR
using Cysharp.Threading.Tasks;
using UnityEditor;
using UnityEngine;

namespace Gatrix.Unity.SDK.Editor
{
    /// <summary>
    /// Maintains a lightweight, offline-only GatrixClient in Edit Mode.
    /// Initialized automatically on domain reload via [InitializeOnLoad].
    /// Disposed when Play Mode starts and re-created when it ends.
    ///
    /// This allows GatrixBehaviour.Client to be non-null in Edit Mode so
    /// that editor tools, inspector components, and previews can call
    /// GetFlagRaw() / GetAllFlags() without any extra JSON-parsing code.
    /// </summary>
    [InitializeOnLoad]
    public static class GatrixEditorClient
    {
        private static GatrixClient _client;

        /// <summary>The offline editor client, or null if no GatrixSettings is found.</summary>
        public static GatrixClient Client => _client;

        static GatrixEditorClient()
        {
            EditorApplication.playModeStateChanged += OnPlayModeStateChanged;

            // On every domain reload, populate the client from cache immediately.
            InitFromCache();
        }

        /// <summary>
        /// Creates an offline GatrixClient and loads flags from local storage (PlayerPrefs).
        /// Async operations on PlayerPrefs complete synchronously so this is effectively instant.
        /// </summary>
        private static void InitFromCache()
        {
            if (Application.isPlaying) return;

            _client?.Dispose();
            _client = null;

            var behaviour = Object.FindFirstObjectByType<GatrixBehaviour>();
            if (behaviour?.Settings == null) return;
            if (!behaviour.Settings.IsValid(out _)) return;

            var config = behaviour.Settings.ToConfig();

            // Offline mode: never make network requests in Edit Mode
            config.OfflineMode = true;

            _client = new GatrixClient(config);

            // InitAsync only reads from local storage (PlayerPrefs) — effectively synchronous
            _client.Features.InitAsync().Forget();
        }

        /// <summary>Re-initializes the editor client (e.g. after Play Mode changes cached data).</summary>
        public static void Refresh() => InitFromCache();

        private static void OnPlayModeStateChanged(PlayModeStateChange state)
        {
            switch (state)
            {
                case PlayModeStateChange.ExitingEditMode:
                    // Tear down editor client before Play Mode takes over
                    _client?.Dispose();
                    _client = null;
                    break;

                case PlayModeStateChange.EnteredEditMode:
                    // Re-build from the (possibly updated) cache after Play Mode ends
                    InitFromCache();
                    break;
            }
        }
    }
}
#endif
