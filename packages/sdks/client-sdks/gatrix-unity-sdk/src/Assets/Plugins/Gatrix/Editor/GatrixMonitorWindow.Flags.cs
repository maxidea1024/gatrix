// GatrixMonitorWindow - Flags tab
// Feature flag table with search, explicit sync view, and change highlighting

#if UNITY_EDITOR
using System.Collections.Generic;
using UnityEditor;
using UnityEngine;

namespace Gatrix.Unity.SDK.Editor
{
    public partial class GatrixMonitorWindow
    {
        // ==================== Flags ====================

        private void DrawFlags()
        {
            EditorGUILayout.BeginHorizontal();
            EditorGUILayout.LabelField("Feature Flags", _headerStyle, GUILayout.ExpandWidth(true));

            if (_cachedFlags != null)
            {
                EditorGUILayout.LabelField(
                    $"({_cachedFlags.Count} flags)",
                    GUILayout.Width(80));
            }
            EditorGUILayout.EndHorizontal();

            // Search
            EditorGUILayout.BeginHorizontal();
            EditorGUILayout.LabelField("Search:", GUILayout.Width(50));
            _flagSearchFilter = EditorGUILayout.TextField(_flagSearchFilter);
            if (GUILayout.Button("Clear", GUILayout.Width(50)))
            {
                _flagSearchFilter = "";
            }
            EditorGUILayout.EndHorizontal();

            EditorGUILayout.Space(4);

            if (_cachedFlags == null || _cachedFlags.Count == 0)
            {
                EditorGUILayout.HelpBox("No flags loaded yet.", MessageType.Info);
                return;
            }

            var filter = _flagSearchFilter?.ToLowerInvariant() ?? "";

            // Explicit sync mode is only relevant during Play Mode
            if (Application.isPlaying && _cachedExplicitSync)
            {
                DrawExplicitSyncView(filter);
            }
            else
            {
                DrawFlagTable(_cachedFlags, filter);
            }
        }

        private void DrawExplicitSyncView(string filter)
        {
            // Sync control bar
            GatrixEditorStyle.BeginBox();
            EditorGUILayout.BeginHorizontal();
            EditorGUILayout.LabelField(
                _cachedPendingSync
                    ? "<color=#ffcc66>● Pending changes available</color>"
                    : "<color=#88ff88>● Synchronized</color>",
                _statusLabelStyle, GUILayout.ExpandWidth(true));

            GUI.enabled = _cachedPendingSync;
            if (GUILayout.Button("Sync Flags", GUILayout.Width(90)))
            {
                var client = GatrixBehaviour.Client;
                if (client != null)
                {
                    _ = client.Features.SyncFlagsAsync(false);
                    RefreshData();
                }
            }
            GUI.enabled = true;
            EditorGUILayout.EndHorizontal();
            GatrixEditorStyle.EndBox();

            // Build pending map for inline sub-row rendering
            Dictionary<string, EvaluatedFlag> pendingMap = null;
            if (_cachedRealtimeFlags != null && _cachedPendingSync)
            {
                pendingMap = new Dictionary<string, EvaluatedFlag>(_cachedRealtimeFlags.Count);
                foreach (var f in _cachedRealtimeFlags)
                    pendingMap[f.Name] = f;
            }

            GatrixEditorStyle.DrawSection("Feature Flags");
            DrawFlagTable(_cachedFlags, filter, pendingMap);
        }

        private void DrawFlagTable(List<EvaluatedFlag> flags, string filter,
            Dictionary<string, EvaluatedFlag> pendingMap = null)
        {
            GatrixFlagTable.Draw(flags, filter, _changedFlagTimes, HighlightDuration, pendingMap);
        }
    }
}
#endif
