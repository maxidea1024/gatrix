// GatrixBehaviourInspector - Custom inspector for GatrixBehaviour
// Emerald AI-inspired: color-coded sections, bold headers, clean table layout

#if UNITY_EDITOR
using UnityEditor;
using UnityEngine;

namespace Gatrix.Unity.SDK.Editor
{
    /// <summary>
    /// Custom inspector for GatrixBehaviour showing live SDK state.
    /// Emerald AI-inspired layout: color-coded sections, bold headers, clean table rows.
    /// </summary>
    [CustomEditor(typeof(GatrixBehaviour))]
    public class GatrixBehaviourInspector : UnityEditor.Editor
    {
        private bool _showFlags   = true;
        private bool _showContext = true;
        private bool _showStats   = true;

        private const float LabelWidth   = 120f;
        private const float FlagStateWidth = 36f;
        private const float FlagNameWidth  = 150f;

        private bool _stylesInitialized;
        private GUIStyle _richLabel;
        private GUIStyle _monoLabel;
        private GUIStyle _tableRowLabel;
        private GUIStyle _flagOnStyle;
        private GUIStyle _flagOffStyle;

        private void InitStyles()
        {
            if (_stylesInitialized) return;

            _richLabel = new GUIStyle(EditorStyles.label) { richText = true };

            _monoLabel = new GUIStyle(EditorStyles.label)
            {
                fontSize = 10,
                normal   = { textColor = EditorGUIUtility.isProSkin ? new Color(0.70f, 0.85f, 1f) : new Color(0.10f, 0.25f, 0.55f) }
            };

            _tableRowLabel = new GUIStyle(EditorStyles.label)
            {
                fontSize = 11,
                richText = true
            };

            _flagOnStyle = new GUIStyle(EditorStyles.miniLabel)
            {
                fontStyle = FontStyle.Bold,
                alignment = TextAnchor.MiddleCenter,
                normal    = { textColor = new Color(0.25f, 0.90f, 0.40f) }
            };

            _flagOffStyle = new GUIStyle(EditorStyles.miniLabel)
            {
                fontStyle = FontStyle.Bold,
                alignment = TextAnchor.MiddleCenter,
                normal    = { textColor = new Color(0.90f, 0.35f, 0.35f) }
            };

            _stylesInitialized = true;
        }

        public override void OnInspectorGUI()
        {
            InitStyles();

            // Title bar (blue accent)
            GatrixEditorStyle.DrawTitleBar("Gatrix Behaviour", "Feature Flag SDK Entry Point", true, GatrixEditorStyle.AccentBlue);

            var client = GatrixBehaviour.Client;

            if (client == null)
            {
                if (!Application.isPlaying)
                {
                    DrawDefaultInspector();
                    EditorGUILayout.Space(10);
                    GatrixEditorStyle.DrawHelpBox("SDK will initialize automatically in Play Mode.", MessageType.Info);
                    EditorGUILayout.Space(4);
                    if (GUILayout.Button("Open Setup Wizard", GUILayout.Height(28)))
                        GatrixSetupWindow.ShowWindow();
                }
                else
                {
                    GatrixEditorStyle.DrawHelpBox("SDK is not initialized in Play Mode.", MessageType.Warning);
                }
                return;
            }

            // ── Status Section ──────────────────────────────────
            GatrixEditorStyle.DrawSection("Status", null, GatrixEditorStyle.AccentBlue);
            GatrixEditorStyle.BeginBox();

            DrawStatusRow("Status",
                client.IsReady
                    ? "<color=#44ee66><b>Ready</b></color>"
                    : "<color=#ffcc44><b>Not Ready</b></color>",
                richText: true);
            DrawStatusRow("Connection", client.ConnectionId ?? "N/A");

            EditorGUILayout.Space(4);

            // Action buttons
            EditorGUILayout.BeginHorizontal();
            if (GUILayout.Button("Open Monitor", GUILayout.Height(26)))
                GatrixMonitorWindow.ShowWindow();
            if (GUILayout.Button("Force Fetch", GUILayout.Height(26)))
                _ = client.Features.FetchFlagsAsync();
            EditorGUILayout.EndHorizontal();

            // Pending sync button
            if (client.Features.IsExplicitSync() && client.Features.HasPendingSyncFlags())
            {
                EditorGUILayout.Space(4);
                var prevBg = GUI.backgroundColor;
                GUI.backgroundColor = new Color(1f, 0.82f, 0.20f);
                if (GUILayout.Button("\u26a1 Sync Flags  (Pending Changes)", GUILayout.Height(28)))
                {
                    _ = client.Features.SyncFlagsAsync(false);
                    if (EditorWindow.HasOpenInstances<GatrixMonitorWindow>())
                        EditorWindow.GetWindow<GatrixMonitorWindow>(false, null, false).ForceRefresh();
                }
                GUI.backgroundColor = prevBg;
            }

            GatrixEditorStyle.EndBox();

            // ── Feature Flags Section ────────────────────────────
            GatrixEditorStyle.DrawSection("Feature Flags", null, GatrixEditorStyle.AccentGreen);
            GatrixEditorStyle.BeginBox();

            _showFlags = DrawFoldoutHeader($"Flags  ({client.Features.GetAllFlags().Count})", _showFlags, GatrixEditorStyle.AccentGreen);

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
                    var headerRect = EditorGUILayout.GetControlRect(false, 18);
                    bool isDark    = EditorGUIUtility.isProSkin;
                    if (Event.current.type == EventType.Repaint)
                    {
                        EditorGUI.DrawRect(headerRect,
                            isDark ? new Color(0.14f, 0.14f, 0.16f, 1f) : new Color(0.72f, 0.72f, 0.74f, 1f));
                    }
                    var hStyle = new GUIStyle(EditorStyles.miniLabel)
                    {
                        fontStyle = FontStyle.Bold,
                        normal    = { textColor = isDark ? new Color(0.65f, 0.70f, 0.75f) : new Color(0.30f, 0.32f, 0.35f) }
                    };
                    GUI.Label(new Rect(headerRect.x + 4,  headerRect.y, FlagStateWidth, headerRect.height), "St",      hStyle);
                    GUI.Label(new Rect(headerRect.x + 44, headerRect.y, FlagNameWidth,  headerRect.height), "Name",    hStyle);
                    GUI.Label(new Rect(headerRect.x + 44 + FlagNameWidth, headerRect.y, 200, headerRect.height), "Variant", hStyle);

                    // Rows
                    for (int i = 0; i < flags.Count; i++)
                    {
                        var flag    = flags[i];
                        var rowRect = EditorGUILayout.GetControlRect(false, 18);

                        // Alternating row background
                        if (Event.current.type == EventType.Repaint && i % 2 == 0)
                        {
                            EditorGUI.DrawRect(rowRect,
                                isDark ? new Color(0.18f, 0.18f, 0.20f, 0.4f) : new Color(0.86f, 0.86f, 0.88f, 0.4f));
                        }

                        // State badge
                        var badgeBg = flag.Enabled
                            ? new Color(0.10f, 0.38f, 0.14f, 0.8f)
                            : new Color(0.38f, 0.10f, 0.10f, 0.8f);
                        var badgeRect = new Rect(rowRect.x + 4, rowRect.y + 2, 32, 14);
                        if (Event.current.type == EventType.Repaint)
                            EditorGUI.DrawRect(badgeRect, badgeBg);
                        GUI.Label(badgeRect, flag.Enabled ? "ON" : "OFF", flag.Enabled ? _flagOnStyle : _flagOffStyle);

                        // Flag name
                        var name = flag.Name.Length > 26 ? flag.Name.Substring(0, 23) + "..." : flag.Name;
                        GUI.Label(new Rect(rowRect.x + 44, rowRect.y, FlagNameWidth, rowRect.height),
                            new GUIContent(name, flag.Name), _tableRowLabel);

                        // Variant
                        if (flag.Variant != null)
                        {
                            var payload = flag.Variant.Value?.ToString() ?? "";
                            if (payload.Length > 30) payload = payload.Substring(0, 27) + "...";
                            var variantText = string.IsNullOrEmpty(flag.Variant.Name)
                                ? payload
                                : $"{flag.Variant.Name}: {payload}";
                            GUI.Label(new Rect(rowRect.x + 44 + FlagNameWidth, rowRect.y, 200, rowRect.height),
                                variantText, _tableRowLabel);
                        }
                    }
                }
            }
            GatrixEditorStyle.EndBox();

            // ── Context Section ──────────────────────────────────
            GatrixEditorStyle.DrawSection("Context", null, GatrixEditorStyle.AccentTeal);
            GatrixEditorStyle.BeginBox();

            _showContext = DrawFoldoutHeader("Evaluation Context", _showContext, GatrixEditorStyle.AccentTeal);
            if (_showContext)
            {
                var ctx = client.Features.GetContext();
                DrawStatusRow("AppName",     ctx.AppName     ?? "-");
                DrawStatusRow("Environment", ctx.Environment ?? "-");
                DrawStatusRow("UserId",      ctx.UserId      ?? "-");
                DrawStatusRow("SessionId",   ctx.SessionId   ?? "-");
                if (ctx.Properties != null)
                {
                    foreach (var kvp in ctx.Properties)
                        DrawStatusRow(kvp.Key, kvp.Value?.ToString() ?? "-");
                }
            }
            GatrixEditorStyle.EndBox();

            // ── Statistics Section ───────────────────────────────
            GatrixEditorStyle.DrawSection("Statistics", null, GatrixEditorStyle.AccentOrange);
            GatrixEditorStyle.BeginBox();

            _showStats = DrawFoldoutHeader("Runtime Stats", _showStats, GatrixEditorStyle.AccentOrange);
            if (_showStats)
            {
                var stats = client.Features.GetStats();
                DrawStatusRow("State",       stats.SdkState.ToString());
                DrawStatusRow("Total Flags", stats.TotalFlagCount.ToString());
                DrawStatusRow("Fetches",     stats.FetchFlagsCount.ToString());
                DrawStatusRow("Updates",     stats.UpdateCount.ToString());
                DrawStatusRow("Errors",      stats.ErrorCount.ToString());
                DrawStatusRow("Impressions", stats.ImpressionCount.ToString());

                var streamColor = stats.StreamingState == StreamingConnectionState.Connected
                    ? "#44ee66"
                    : stats.StreamingState == StreamingConnectionState.Disconnected
                        ? "#888888"
                        : "#ffcc44";
                DrawStatusRow("Streaming",
                    $"<color={streamColor}>{stats.StreamingState}</color>", richText: true);
            }
            GatrixEditorStyle.EndBox();

            if (EditorApplication.isPlaying)
                Repaint();
        }

        // ==================== Helpers ====================

        /// <summary>Draws a label-value row with fixed column alignment.</summary>
        private void DrawStatusRow(string label, string value, bool richText = false)
        {
            EditorGUILayout.BeginHorizontal();
            var labelStyle = new GUIStyle(EditorStyles.label)
            {
                normal = { textColor = EditorGUIUtility.isProSkin
                    ? new Color(0.60f, 0.65f, 0.72f)
                    : new Color(0.35f, 0.38f, 0.42f) }
            };
            EditorGUILayout.LabelField(label, labelStyle, GUILayout.Width(LabelWidth));
            if (richText)
                EditorGUILayout.LabelField(value, _richLabel);
            else
                EditorGUILayout.LabelField(value);
            EditorGUILayout.EndHorizontal();
        }

        /// <summary>
        /// Draws a foldout header row with a colored left accent bar.
        /// Returns the new foldout state.
        /// </summary>
        private static bool DrawFoldoutHeader(string label, bool expanded, Color accentColor)
        {
            var rect = EditorGUILayout.GetControlRect(false, 20);
            bool isDark = EditorGUIUtility.isProSkin;

            if (Event.current.type == EventType.Repaint)
            {
                EditorGUI.DrawRect(rect,
                    isDark ? new Color(0.16f, 0.16f, 0.18f, 0.8f) : new Color(0.76f, 0.76f, 0.78f, 0.8f));
                EditorGUI.DrawRect(new Rect(rect.x, rect.y, 3, rect.height), accentColor);
            }

            // Arrow
            var arrowStyle = new GUIStyle(EditorStyles.foldout)
            {
                fontStyle = FontStyle.Bold,
                fontSize  = 11,
            };
            arrowStyle.normal.textColor   = isDark ? new Color(0.85f, 0.85f, 0.85f) : new Color(0.10f, 0.10f, 0.10f);
            arrowStyle.onNormal.textColor = arrowStyle.normal.textColor;

            expanded = EditorGUI.Foldout(new Rect(rect.x + 8, rect.y, rect.width - 8, rect.height),
                expanded, label, true, arrowStyle);

            return expanded;
        }
    }
}
#endif
