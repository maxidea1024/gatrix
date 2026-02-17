// GatrixBehaviourInspector - Custom inspector for GatrixBehaviour
// Shows SDK status and controls in the Inspector panel

#if UNITY_EDITOR
using UnityEditor;
using UnityEngine;

namespace Gatrix.Unity.SDK.Editor
{
    /// <summary>
    /// Custom inspector for GatrixBehaviour showing live SDK state.
    /// Uses table-style layout for aligned display of labels and values.
    /// </summary>
    [CustomEditor(typeof(GatrixBehaviour))]
    public class GatrixBehaviourInspector : UnityEditor.Editor
    {
        private bool _showFlags;
        private bool _showContext;
        private bool _showStats;

        // Column widths for table-style alignment
        private const float LabelWidth = 120f;
        private const float FlagStateWidth = 50f;
        private const float FlagNameWidth = 160f;

        private GUIStyle _headerStyle;
        private GUIStyle _richLabelStyle;
        private GUIStyle _valueLabelStyle;
        private bool _stylesInitialized;

        private void InitStyles()
        {
            if (_stylesInitialized) return;

            _headerStyle = new GUIStyle(EditorStyles.boldLabel) { fontSize = 14 };

            _richLabelStyle = new GUIStyle(EditorStyles.label) { richText = true };

            _valueLabelStyle = new GUIStyle(EditorStyles.label)
            {
                fontStyle = FontStyle.Normal,
                richText = true
            };

            _stylesInitialized = true;
        }

        public override void OnInspectorGUI()
        {
            InitStyles();

            GatrixEditorExtensions.DrawHeader("Gatrix SDK", "Unity Integration Component");
            var client = GatrixBehaviour.Client;

            if (client == null)
            {
                if (!Application.isPlaying)
                {
                    DrawDefaultInspector();
                }
                else
                {
                    EditorGUILayout.HelpBox("SDK is not initialized in Play Mode.", MessageType.None);
                }
                return;
            }

            // Status row
            var readyText = client.IsReady
                ? "<color=green><b>Ready</b></color>"
                : "<color=yellow><b>Not Ready</b></color>";
            DrawRow("Status", readyText, true);
            DrawRow("Connection", client.ConnectionId ?? "N/A");

            EditorGUILayout.Space(4);

            // Buttons
            EditorGUILayout.BeginHorizontal();
            if (GUILayout.Button("Open Monitor"))
            {
                GatrixMonitorWindow.ShowWindow();
            }
            if (GUILayout.Button("Force Fetch"))
            {
                _ = client.Features.FetchFlagsAsync();
            }
            EditorGUILayout.EndHorizontal();

            // Sync Flags button (only when explicit sync mode has pending changes)
            if (client.Features.IsExplicitSync() && client.Features.HasPendingSyncFlags())
            {
                EditorGUILayout.Space(2);
                var prevBg = GUI.backgroundColor;
                GUI.backgroundColor = new Color(1f, 0.85f, 0.3f);
                if (GUILayout.Button("⚡ Sync Flags (Pending Changes)"))
                {
                    _ = client.Features.SyncFlagsAsync(false);
                    // Force Monitor window to refresh immediately
                    if (EditorWindow.HasOpenInstances<GatrixMonitorWindow>())
                    {
                        EditorWindow.GetWindow<GatrixMonitorWindow>(false, null, false).ForceRefresh();
                    }
                }
                GUI.backgroundColor = prevBg;
            }

            EditorGUILayout.Space(8);

            // ==================== Flags ====================
            _showFlags = EditorGUILayout.Foldout(_showFlags, "Feature Flags", true);
            if (_showFlags)
            {
                EditorGUI.indentLevel++;
                var flags = client.Features.GetAllFlags();
                if (flags.Count == 0)
                {
                    EditorGUILayout.LabelField("No flags loaded");
                }
                else
                {
                    // Table header
                    EditorGUILayout.BeginHorizontal(EditorStyles.toolbar);
                    GUILayout.Space(EditorGUI.indentLevel * 15f);
                    EditorGUILayout.LabelField("State", EditorStyles.miniLabel, GUILayout.Width(FlagStateWidth));
                    EditorGUILayout.LabelField("Flag Name", EditorStyles.miniLabel, GUILayout.Width(FlagNameWidth));
                    EditorGUILayout.LabelField("Variant", EditorStyles.miniLabel);
                    EditorGUILayout.EndHorizontal();

                    // Table rows
                    foreach (var flag in flags)
                    {
                        EditorGUILayout.BeginHorizontal();
                        GUILayout.Space(EditorGUI.indentLevel * 15f);

                        // State column
                        var colorTag = flag.Enabled ? "green" : "red";
                        var state = flag.Enabled ? "ON" : "OFF";
                        EditorGUILayout.LabelField(
                            $"<color={colorTag}><b>[{state}]</b></color>",
                            _richLabelStyle, GUILayout.Width(FlagStateWidth));

                        // Name column
                        EditorGUILayout.LabelField(flag.Name, GUILayout.Width(FlagNameWidth));

                        // Variant column
                        if (flag.Variant != null)
                        {
                            var payloadStr = flag.Variant.Value?.ToString() ?? "";
                            if (payloadStr.Length > 30)
                                payloadStr = payloadStr.Substring(0, 27) + "...";
                            EditorGUILayout.LabelField($"{flag.Variant.Name}: {payloadStr}");
                        }
                        else
                        {
                            EditorGUILayout.LabelField("-");
                        }

                        EditorGUILayout.EndHorizontal();
                    }
                }
                EditorGUI.indentLevel--;
            }

            // ==================== Context ====================
            _showContext = EditorGUILayout.Foldout(_showContext, "Context", true);
            if (_showContext)
            {
                EditorGUI.indentLevel++;
                var ctx = client.Features.GetContext();
                DrawRow("AppName", ctx.AppName ?? "-");
                DrawRow("Environment", ctx.Environment ?? "-");
                DrawRow("UserId", ctx.UserId ?? "-");
                DrawRow("SessionId", ctx.SessionId ?? "-");
                if (ctx.Properties != null)
                {
                    foreach (var kvp in ctx.Properties)
                    {
                        DrawRow(kvp.Key, kvp.Value?.ToString() ?? "-");
                    }
                }
                EditorGUI.indentLevel--;
            }

            // ==================== Statistics ====================
            _showStats = EditorGUILayout.Foldout(_showStats, "Statistics", true);
            if (_showStats)
            {
                EditorGUI.indentLevel++;
                var stats = client.Features.GetStats();
                DrawRow("State", stats.SdkState.ToString());
                DrawRow("Total Flags", stats.TotalFlagCount.ToString());
                DrawRow("Fetch Count", stats.FetchFlagsCount.ToString());
                DrawRow("Updates", stats.UpdateCount.ToString());
                DrawRow("304s", stats.NotModifiedCount.ToString());
                DrawRow("Errors", stats.ErrorCount.ToString());
                DrawRow("Impressions", stats.ImpressionCount.ToString());

                // Streaming
                var stateColor = stats.StreamingState == StreamingConnectionState.Connected
                    ? "green"
                    : stats.StreamingState == StreamingConnectionState.Disconnected
                        ? "gray"
                        : "yellow";
                DrawRow("Streaming",
                    $"<color={stateColor}>{stats.StreamingState}</color>", true);
                DrawRow("Reconnects", stats.StreamingReconnectCount.ToString());
                EditorGUI.indentLevel--;
            }

            // Auto-repaint in play mode
            if (EditorApplication.isPlaying)
            {
                Repaint();
            }
        }

        /// <summary>Draw a label-value row with fixed column alignment</summary>
        private void DrawRow(string label, string value, bool richValue = false)
        {
            EditorGUILayout.BeginHorizontal();
            EditorGUILayout.LabelField(label, EditorStyles.boldLabel, GUILayout.Width(LabelWidth));
            if (richValue)
            {
                EditorGUILayout.LabelField(value, _richLabelStyle);
            }
            else
            {
                EditorGUILayout.LabelField(value, _valueLabelStyle);
            }
            EditorGUILayout.EndHorizontal();
        }
    }
}
#endif
