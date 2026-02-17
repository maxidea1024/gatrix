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
        private bool _showFlags = true;
        private bool _showContext = true;
        private bool _showStats = true;

        // Column widths for table-style alignment
        private const float LabelWidth = 120f;
        private const float FlagStateWidth = 40f;
        private const float FlagNameWidth = 140f;

        private bool _stylesInitialized;
        private GUIStyle _richLabelStyle;
        private GUIStyle _valueLabelStyle;

        private void InitStyles()
        {
            if (_stylesInitialized) return;

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

            // Header
            GatrixEditorStyle.DrawSection("Gatrix SDK", "Unity Integration Component");
            
            var client = GatrixBehaviour.Client;

            if (client == null)
            {
                if (!Application.isPlaying)
                {
                    DrawDefaultInspector();
                    EditorGUILayout.Space(10);
                    GatrixEditorStyle.DrawHelpBox("SDK will initialize automatically in Play Mode.", MessageType.Info);
                }
                else
                {
                    GatrixEditorStyle.DrawHelpBox("SDK is not initialized in Play Mode.", MessageType.Warning);
                }
                return;
            }

            // Status Box
            GatrixEditorStyle.BeginBox();
            
            // Status row
            var readyText = client.IsReady
                ? "<color=#88ff88><b>Ready</b></color>"
                : "<color=#ffcc66><b>Not Ready</b></color>";
            DrawRow("Status", readyText, true);
            DrawRow("Connection", client.ConnectionId ?? "N/A");
            
            EditorGUILayout.Space(4);

            // Buttons
            EditorGUILayout.BeginHorizontal();
            if (GUILayout.Button("Open Monitor", GUILayout.Height(24)))
            {
                GatrixMonitorWindow.ShowWindow();
            }
            if (GUILayout.Button("Force Fetch", GUILayout.Height(24)))
            {
                _ = client.Features.FetchFlagsAsync();
            }
            EditorGUILayout.EndHorizontal();

            // Sync Flags button (only when explicit sync mode has pending changes)
            if (client.Features.IsExplicitSync() && client.Features.HasPendingSyncFlags())
            {
                EditorGUILayout.Space(4);
                var prevBg = GUI.backgroundColor;
                GUI.backgroundColor = new Color(1f, 0.85f, 0.3f);
                if (GUILayout.Button("⚡ Sync Flags (Pending Changes)", GUILayout.Height(30)))
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

            GatrixEditorStyle.EndBox();

            // ==================== Flags ====================
            GatrixEditorStyle.DrawSection("Feature Flags");
            
            GatrixEditorStyle.BeginBox();
            
            // Custom simplified foldout/header
            _showFlags = EditorGUILayout.Foldout(_showFlags, $"Flags ({client.Features.GetAllFlags().Count})", true, EditorStyles.foldoutHeader);
            
            if (_showFlags)
            {
                var flags = client.Features.GetAllFlags();
                if (flags.Count == 0)
                {
                    EditorGUILayout.LabelField("No flags loaded", EditorStyles.centeredGreyMiniLabel);
                }
                else
                {
                    EditorGUILayout.Space(2);
                    
                    // Table header
                    EditorGUILayout.BeginHorizontal(EditorStyles.toolbar);
                    EditorGUILayout.LabelField("St", EditorStyles.miniLabel, GUILayout.Width(FlagStateWidth));
                    EditorGUILayout.LabelField("Name", EditorStyles.miniLabel, GUILayout.Width(FlagNameWidth));
                    EditorGUILayout.LabelField("Variant", EditorStyles.miniLabel);
                    EditorGUILayout.EndHorizontal();

                    // Table rows
                    foreach (var flag in flags)
                    {
                        EditorGUILayout.BeginHorizontal();
                        
                        // State column
                        var colorTag = flag.Enabled ? "#88ff88" : "#ff8888";
                        var state = flag.Enabled ? "ON" : "OFF";
                        EditorGUILayout.LabelField(
                            $"<color={colorTag}><b>{state}</b></color>",
                            _richLabelStyle, GUILayout.Width(FlagStateWidth));

                        // Name column
                        // Truncate if too long
                        var name = flag.Name;
                        if (name.Length > 25) name = name.Substring(0, 22) + "...";
                        EditorGUILayout.LabelField(new GUIContent(name, flag.Name), GUILayout.Width(FlagNameWidth));

                        // Variant column
                        if (flag.Variant != null)
                        {
                            var payloadStr = flag.Variant.Value?.ToString() ?? "";
                            if (payloadStr.Length > 30)
                                payloadStr = payloadStr.Substring(0, 27) + "...";
                            
                            var variantText = string.IsNullOrEmpty(flag.Variant.Name) 
                                ? payloadStr 
                                : $"{flag.Variant.Name}: {payloadStr}";
                                
                            EditorGUILayout.LabelField(variantText);
                        }
                        else
                        {
                            EditorGUILayout.LabelField("-");
                        }

                        EditorGUILayout.EndHorizontal();
                    }
                }
            }
            GatrixEditorStyle.EndBox();

            // ==================== Context ====================
            GatrixEditorStyle.DrawSection("Context");
            GatrixEditorStyle.BeginBox();
            
            _showContext = EditorGUILayout.Foldout(_showContext, "Evaluation Context", true, EditorStyles.foldoutHeader);
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
            GatrixEditorStyle.EndBox();

            // ==================== Statistics ====================
            GatrixEditorStyle.DrawSection("Statistics");
            GatrixEditorStyle.BeginBox();
            
            _showStats = EditorGUILayout.Foldout(_showStats, "Runtime Stats", true, EditorStyles.foldoutHeader);
            if (_showStats)
            {
                EditorGUI.indentLevel++;
                var stats = client.Features.GetStats();
                DrawRow("State", stats.SdkState.ToString());
                DrawRow("Total Flags", stats.TotalFlagCount.ToString());
                DrawRow("Fetches", stats.FetchFlagsCount.ToString());
                DrawRow("Updates", stats.UpdateCount.ToString());
                DrawRow("Errors", stats.ErrorCount.ToString());
                DrawRow("Impressions", stats.ImpressionCount.ToString());

                // Streaming
                var stateColor = stats.StreamingState == StreamingConnectionState.Connected
                    ? "#88ff88"
                    : stats.StreamingState == StreamingConnectionState.Disconnected
                        ? "gray"
                        : "yellow";
                DrawRow("Streaming",
                    $"<color={stateColor}>{stats.StreamingState}</color>", true);
                EditorGUI.indentLevel--;
            }
            GatrixEditorStyle.EndBox();

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
            EditorGUILayout.LabelField(label, EditorStyles.label, GUILayout.Width(LabelWidth));
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
