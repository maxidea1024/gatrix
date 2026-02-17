// GatrixFlagNameCache - Caches known feature flag names for editor autocomplete
// Sources: runtime SDK cache, last fetched flags, manual additions

#if UNITY_EDITOR
using System.Collections.Generic;
using UnityEditor;
using UnityEngine;

namespace Gatrix.Unity.SDK.Editor
{
    /// <summary>
    /// Singleton cache of known feature flag names for editor tooling.
    /// Automatically syncs with the runtime SDK when available,
    /// and persists names across editor sessions via EditorPrefs.
    /// </summary>
    [InitializeOnLoad]
    public static class GatrixFlagNameCache
    {
        private const string PrefsKey = "GatrixFlagNames";
        private const string PrefsSeparator = "||";

        private static readonly SortedSet<string> _flagNames = new SortedSet<string>();
        private static double _lastSyncTime;
        private const double SyncInterval = 2.0;

        static GatrixFlagNameCache()
        {
            LoadFromPrefs();
            EditorApplication.update += OnEditorUpdate;
        }

        /// <summary>All known flag names (sorted)</summary>
        public static IReadOnlyCollection<string> FlagNames => _flagNames;

        /// <summary>Number of cached flag names</summary>
        public static int Count => _flagNames.Count;

        /// <summary>Search flag names by partial match</summary>
        public static List<string> Search(string query)
        {
            var result = new List<string>();
            foreach (var name in _flagNames)
            {
                if (string.IsNullOrEmpty(query) || name.ToLowerInvariant().Contains(query.ToLowerInvariant()))
                {
                    result.Add(name);
                }
            }
            return result;
        }

        /// <summary>Add a flag name manually</summary>
        public static void Add(string flagName)
        {
            if (string.IsNullOrEmpty(flagName)) return;
            if (_flagNames.Add(flagName))
            {
                SaveToPrefs();
            }
        }

        /// <summary>Clear all cached names</summary>
        public static void Clear()
        {
            _flagNames.Clear();
            SaveToPrefs();
        }

        /// <summary>Force sync from the runtime SDK right now</summary>
        public static void ForceSync()
        {
            SyncFromRuntime();
        }

        private static void OnEditorUpdate()
        {
            if (!Application.isPlaying) return;
            if (EditorApplication.timeSinceStartup - _lastSyncTime < SyncInterval) return;
            _lastSyncTime = EditorApplication.timeSinceStartup;

            SyncFromRuntime();
        }

        private static void SyncFromRuntime()
        {
            if (!GatrixBehaviour.IsInitialized) return;

            var client = GatrixBehaviour.Client;
            if (client == null) return;

            var flags = client.Features.GetAllFlags(forceRealtime: true);
            if (flags == null || flags.Count == 0) return;

            bool changed = false;
            foreach (var flag in flags)
            {
                if (!string.IsNullOrEmpty(flag.Name) && _flagNames.Add(flag.Name))
                {
                    changed = true;
                }
            }

            if (changed)
            {
                SaveToPrefs();
            }
        }

        private static void SaveToPrefs()
        {
            var joined = string.Join(PrefsSeparator, _flagNames);
            EditorPrefs.SetString(PrefsKey, joined);
        }

        private static void LoadFromPrefs()
        {
            var stored = EditorPrefs.GetString(PrefsKey, "");
            if (string.IsNullOrEmpty(stored)) return;

            var names = stored.Split(new[] { PrefsSeparator }, System.StringSplitOptions.RemoveEmptyEntries);
            foreach (var name in names)
            {
                _flagNames.Add(name);
            }
        }
    }
}
#endif
