// GatrixMonitorWindow - Missing Flags tab
// Shows flags that were requested by code but not found on the server

#if UNITY_EDITOR
using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEngine;

namespace Gatrix.Unity.SDK.Editor
{
    public partial class GatrixMonitorWindow
    {
        // ==================== Missing Flags ====================

        private string _missingFlagSearchFilter = "";

        private void DrawMissingFlagsTab()
        {
            EditorGUILayout.LabelField("Missing Flags", _headerStyle);
            EditorGUILayout.Space(4);

            var client = GatrixBehaviour.Client;
            if (client == null || _cachedStats == null)
            {
                GatrixEditorStyle.DrawHelpBox("No data available.", MessageType.Info);
                return;
            }

            var missingFlags = _cachedStats.MissingFlags;
            if (missingFlags == null || missingFlags.Count == 0)
            {
                GatrixEditorStyle.DrawHelpBox(
                    "No missing flags detected.\n" +
                    "Missing flags appear when code requests a flag that doesn't exist on the server.",
                    MessageType.Info);
                return;
            }

            // Warning banner
            var warningRect = GUILayoutUtility.GetRect(0, 26, GUILayout.ExpandWidth(true));
            if (Event.current.type == EventType.Repaint)
            {
                EditorGUI.DrawRect(warningRect, new Color(0.5f, 0.35f, 0f, 0.35f));
            }
            var warningStyle = new GUIStyle(EditorStyles.miniLabel)
            {
                richText = true,
                normal = { textColor = new Color(1f, 0.85f, 0.3f) }
            };
            GUI.Label(
                new Rect(warningRect.x + 6, warningRect.y, warningRect.width - 12, warningRect.height),
                $"\u26a0  {missingFlags.Count} missing flag(s) detected \u2014 these flags are requested in code but not found on the server",
                warningStyle);

            EditorGUILayout.Space(4);

            // Search filter
            EditorGUILayout.BeginHorizontal(EditorStyles.toolbar);
            EditorGUILayout.LabelField("\ud83d\udd0d", GUILayout.Width(20));
            _missingFlagSearchFilter = EditorGUILayout.TextField(
                _missingFlagSearchFilter, EditorStyles.toolbarSearchField);
            if (GUILayout.Button("\u2715", EditorStyles.toolbarButton, GUILayout.Width(20)))
            {
                _missingFlagSearchFilter = "";
                GUI.FocusControl(null);
            }
            EditorGUILayout.EndHorizontal();

            EditorGUILayout.Space(4);

            // Sort by request count descending
            var sorted = missingFlags
                .Where(kvp => string.IsNullOrEmpty(_missingFlagSearchFilter)
                    || kvp.Key.ToLowerInvariant().Contains(_missingFlagSearchFilter.ToLowerInvariant()))
                .OrderByDescending(kvp => kvp.Value)
                .ToList();

            if (sorted.Count == 0)
            {
                GatrixEditorStyle.DrawHelpBox("No flags match the search filter.", MessageType.Info);
                return;
            }

            // Table header
            GatrixEditorStyle.BeginBox();

            EditorGUILayout.BeginHorizontal(EditorStyles.toolbar);
            EditorGUILayout.LabelField("Flag Name", EditorStyles.miniLabel, GUILayout.MinWidth(200));
            EditorGUILayout.LabelField("Requests", EditorStyles.miniLabel, GUILayout.Width(70));
            EditorGUILayout.LabelField("", GUILayout.Width(40)); // Copy button column
            EditorGUILayout.EndHorizontal();

            // Table rows
            foreach (var kvp in sorted)
            {
                EditorGUILayout.BeginHorizontal();

                // Flag name with warning color
                var nameStyle = new GUIStyle(EditorStyles.label)
                {
                    richText = true
                };
                EditorGUILayout.LabelField(
                    $"<color=#ffcc66>{kvp.Key}</color>",
                    nameStyle, GUILayout.MinWidth(200));

                // Request count
                var countColor = kvp.Value >= 10 ? "#ff8888" : kvp.Value >= 3 ? "#ffcc66" : "#dddddd";
                EditorGUILayout.LabelField(
                    $"<color={countColor}>{kvp.Value}</color>",
                    _statusLabelStyle, GUILayout.Width(70));

                // Copy button
                if (GUILayout.Button("Copy", EditorStyles.miniButton, GUILayout.Width(40)))
                {
                    GUIUtility.systemCopyBuffer = kvp.Key;
                }

                EditorGUILayout.EndHorizontal();
            }

            GatrixEditorStyle.EndBox();

            EditorGUILayout.Space(8);

            // Summary info
            var totalRequests = sorted.Sum(kvp => kvp.Value);
            GatrixEditorStyle.DrawSection("Summary");
            GatrixEditorStyle.BeginBox();
            DrawField("Missing Flags", sorted.Count.ToString());
            DrawField("Total Requests", totalRequests.ToString());
            GatrixEditorStyle.EndBox();
        }
    }
}
#endif
