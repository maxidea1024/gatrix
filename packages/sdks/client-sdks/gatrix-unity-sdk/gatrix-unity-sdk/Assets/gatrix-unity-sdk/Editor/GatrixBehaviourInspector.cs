// GatrixBehaviourInspector - Custom inspector for GatrixBehaviour
// Emerald AI-inspired: color-coded section bars, badge ON/OFF, clean table layout

#if UNITY_EDITOR
using UnityEditor;
using UnityEngine;

namespace Gatrix.Unity.SDK.Editor
{
    /// <summary>
    /// Custom inspector for GatrixBehaviour showing live SDK state.
    /// Emerald AI-inspired: bold colored section headers outside boxes, badge ON/OFF, alternating rows.
    /// </summary>
    [CustomEditor(typeof(GatrixBehaviour))]
    public class GatrixBehaviourInspector : UnityEditor.Editor
    {
        private bool _showFlags   = true;
        private bool _showContext = false;
        private bool _showStats   = true;

        private const float LabelWidth    = 110f;
        private const float FlagStateWidth = 36f;
        private const float FlagNameWidth  = 150f;

        private bool _stylesInitialized;
        private GUIStyle _richLabel;
        private GUIStyle _flagOnStyle;
        private GUIStyle _flagOffStyle;
        private GUIStyle _rowLabelStyle;
        private GUIStyle _rowValueStyle;

        private void InitStyles()
        {
            if (_stylesInitialized) return;

            _richLabel = new GUIStyle(EditorStyles.label) { richText = true };

            _flagOnStyle = new GUIStyle(EditorStyles.miniLabel)
            {
                fontStyle = FontStyle.Bold,
                alignment = TextAnchor.MiddleCenter,
                normal    = { textColor = Color.white }
            };
            _flagOffStyle = new GUIStyle(EditorStyles.miniLabel)
            {
                fontStyle = FontStyle.Bold,
                alignment = TextAnchor.MiddleCenter,
                normal    = { textColor = Color.white }
            };

            bool isDark = EditorGUIUtility.isProSkin;
            _rowLabelStyle = new GUIStyle(EditorStyles.label)
            {
                fontSize = 11,
                normal   = { textColor = isDark ? new Color(0.58f, 0.63f, 0.70f) : new Color(0.32f, 0.35f, 0.40f) }
            };
            _rowValueStyle = new GUIStyle(EditorStyles.label)
            {
                fontSize = 11,
                normal   = { textColor = isDark ? new Color(0.88f, 0.90f, 0.92f) : new Color(0.08f, 0.10f, 0.12f) }
            };

            _stylesInitialized = true;
        }

        public override void OnInspectorGUI()
        {
            InitStyles();

            // ── Title Bar ───────────────────────────────────────
            DrawTitleBar();

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

            // ── Status ──────────────────────────────────────────
            DrawSectionBar("  Status", GatrixEditorStyle.AccentBlue);
            DrawStatusContent(client);

            // ── Feature Flags ────────────────────────────────────
            _showFlags = DrawCollapsibleSectionBar("  Feature Flags", _showFlags,
                $"({client.Features.GetAllFlags().Count})", GatrixEditorStyle.AccentGreen);
            if (_showFlags)
                DrawFlagsContent(client);

            // ── Context ──────────────────────────────────────────
            _showContext = DrawCollapsibleSectionBar("  Evaluation Context", _showContext,
                null, GatrixEditorStyle.AccentTeal);
            if (_showContext)
                DrawContextContent(client);

            // ── Statistics ───────────────────────────────────────
            _showStats = DrawCollapsibleSectionBar("  Runtime Stats", _showStats,
                null, GatrixEditorStyle.AccentOrange);
            if (_showStats)
                DrawStatsContent(client);

            if (EditorApplication.isPlaying)
                Repaint();
        }

        // ==================== Title Bar ====================

        private void DrawTitleBar()
        {
            bool isDark = EditorGUIUtility.isProSkin;
            float fullWidth = EditorGUIUtility.currentViewWidth;

            var rect = GUILayoutUtility.GetRect(0, 48, GUILayout.ExpandWidth(true));

            if (Event.current.type == EventType.Repaint)
            {
                // Dark background
                EditorGUI.DrawRect(new Rect(0, rect.y, fullWidth, rect.height),
                    isDark ? new Color(0.12f, 0.12f, 0.14f, 1f) : new Color(0.80f, 0.80f, 0.82f, 1f));
                // Left accent bar (5px, blue)
                EditorGUI.DrawRect(new Rect(0, rect.y, 5, rect.height), GatrixEditorStyle.AccentBlue);
                // Bottom border
                EditorGUI.DrawRect(new Rect(0, rect.yMax - 1, fullWidth, 1),
                    new Color(GatrixEditorStyle.AccentBlue.r, GatrixEditorStyle.AccentBlue.g, GatrixEditorStyle.AccentBlue.b, 0.6f));
            }

            // Diamond icon
            var iconStyle = new GUIStyle(EditorStyles.boldLabel)
            {
                fontSize  = 14,
                alignment = TextAnchor.MiddleCenter,
                normal    = { textColor = GatrixEditorStyle.AccentBlue }
            };
            GUI.Label(new Rect(rect.x + 10, rect.y, 20, rect.height), "\u25c6", iconStyle);

            // Component name
            var nameStyle = new GUIStyle(EditorStyles.boldLabel)
            {
                fontSize  = 13,
                alignment = TextAnchor.UpperLeft,
                normal    = { textColor = Color.white }
            };
            GUI.Label(new Rect(rect.x + 34, rect.y + 8, rect.width - 130, 20), "GATRIX BEHAVIOUR", nameStyle);

            // Subtitle
            var subStyle = new GUIStyle(EditorStyles.miniLabel)
            {
                normal = { textColor = new Color(0.60f, 0.75f, 1f) }
            };
            GUI.Label(new Rect(rect.x + 34, rect.y + 27, rect.width - 130, 14), "Feature Flag SDK Entry Point", subStyle);

            // LIVE badge
            if (Application.isPlaying && GatrixBehaviour.IsInitialized)
            {
                var liveBg = new Color(0.10f, 0.55f, 0.20f, 0.85f);
                var liveBadgeRect = new Rect(rect.xMax - 62, rect.y + (rect.height - 18) / 2f, 56, 18);
                if (Event.current.type == EventType.Repaint)
                    EditorGUI.DrawRect(liveBadgeRect, liveBg);
                var liveStyle = new GUIStyle(EditorStyles.miniLabel)
                {
                    fontStyle = FontStyle.Bold,
                    alignment = TextAnchor.MiddleCenter,
                    normal    = { textColor = new Color(0.55f, 1f, 0.60f) }
                };
                GUI.Label(liveBadgeRect, "\u25cf  LIVE", liveStyle);
            }

            EditorGUILayout.Space(4);
        }

        // ==================== Section Bars ====================

        /// <summary>Draws a solid colored section bar (non-collapsible).</summary>
        private static void DrawSectionBar(string title, Color accentColor)
        {
            bool isDark = EditorGUIUtility.isProSkin;
            float fullWidth = EditorGUIUtility.currentViewWidth;

            var rect = GUILayoutUtility.GetRect(0, 24, GUILayout.ExpandWidth(true));

            if (Event.current.type == EventType.Repaint)
            {
                EditorGUI.DrawRect(new Rect(0, rect.y, fullWidth, rect.height),
                    isDark ? new Color(0.17f, 0.17f, 0.19f, 1f) : new Color(0.75f, 0.75f, 0.77f, 1f));
                // Left accent (4px)
                EditorGUI.DrawRect(new Rect(0, rect.y, 4, rect.height), accentColor);
                // Bottom line
                EditorGUI.DrawRect(new Rect(0, rect.yMax - 1, fullWidth, 1),
                    new Color(accentColor.r, accentColor.g, accentColor.b, 0.4f));
            }

            var style = new GUIStyle(EditorStyles.boldLabel)
            {
                fontSize  = 11,
                alignment = TextAnchor.MiddleLeft,
                normal    = { textColor = isDark ? new Color(0.88f, 0.90f, 0.92f) : new Color(0.08f, 0.10f, 0.12f) }
            };
            GUI.Label(new Rect(rect.x + 8, rect.y, rect.width - 16, rect.height), title, style);
        }

        /// <summary>Draws a collapsible section bar. Returns new expanded state.</summary>
        private static bool DrawCollapsibleSectionBar(string title, bool expanded, string badge, Color accentColor)
        {
            bool isDark = EditorGUIUtility.isProSkin;
            float fullWidth = EditorGUIUtility.currentViewWidth;

            var rect = GUILayoutUtility.GetRect(0, 24, GUILayout.ExpandWidth(true));

            if (Event.current.type == EventType.Repaint)
            {
                EditorGUI.DrawRect(new Rect(0, rect.y, fullWidth, rect.height),
                    isDark ? new Color(0.17f, 0.17f, 0.19f, 1f) : new Color(0.75f, 0.75f, 0.77f, 1f));
                EditorGUI.DrawRect(new Rect(0, rect.y, 4, rect.height), accentColor);
                EditorGUI.DrawRect(new Rect(0, rect.yMax - 1, fullWidth, 1),
                    new Color(accentColor.r, accentColor.g, accentColor.b, 0.4f));
            }

            // Arrow
            var arrowStyle = new GUIStyle(EditorStyles.boldLabel)
            {
                fontSize  = 10,
                alignment = TextAnchor.MiddleLeft,
                normal    = { textColor = isDark ? new Color(0.70f, 0.72f, 0.75f) : new Color(0.30f, 0.32f, 0.35f) }
            };
            GUI.Label(new Rect(rect.x + 8, rect.y, 14, rect.height), expanded ? "\u25bc" : "\u25b6", arrowStyle);

            // Title
            var titleStyle = new GUIStyle(EditorStyles.boldLabel)
            {
                fontSize  = 11,
                alignment = TextAnchor.MiddleLeft,
                normal    = { textColor = isDark ? new Color(0.88f, 0.90f, 0.92f) : new Color(0.08f, 0.10f, 0.12f) }
            };
            GUI.Label(new Rect(rect.x + 22, rect.y, rect.width - 80, rect.height), title, titleStyle);

            // Badge (e.g. flag count)
            if (!string.IsNullOrEmpty(badge))
            {
                var badgeStyle = new GUIStyle(EditorStyles.miniLabel)
                {
                    alignment = TextAnchor.MiddleRight,
                    normal    = { textColor = new Color(accentColor.r, accentColor.g, accentColor.b, 0.85f) }
                };
                GUI.Label(new Rect(rect.x, rect.y, rect.width - 8, rect.height), badge, badgeStyle);
            }

            // Click to toggle
            if (Event.current.type == EventType.MouseDown && rect.Contains(Event.current.mousePosition))
            {
                expanded = !expanded;
                Event.current.Use();
            }

            return expanded;
        }

        // ==================== Section Contents ====================

        private void DrawStatusContent(GatrixClient client)
        {
            EditorGUILayout.Space(2);

            DrawRow("Status",
                client.IsReady ? "<color=#44ee66><b>Ready</b></color>" : "<color=#ffcc44><b>Not Ready</b></color>",
                richText: true);
            DrawRow("Connection", client.ConnectionId ?? "N/A");

            EditorGUILayout.Space(4);

            EditorGUILayout.BeginHorizontal();
            if (GUILayout.Button("Open Monitor", GUILayout.Height(26)))
                GatrixMonitorWindow.ShowWindow();
            if (GUILayout.Button("Force Fetch", GUILayout.Height(26)))
                _ = client.Features.FetchFlagsAsync();
            EditorGUILayout.EndHorizontal();

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

            EditorGUILayout.Space(4);
        }

        private void DrawFlagsContent(GatrixClient client)
        {
            var flags = client.Features.GetAllFlags();
            bool isDark = EditorGUIUtility.isProSkin;

            if (flags.Count == 0)
            {
                EditorGUILayout.Space(4);
                EditorGUILayout.LabelField("No flags loaded yet.", EditorStyles.centeredGreyMiniLabel);
                EditorGUILayout.Space(4);
                return;
            }

            // Table header
            var headerRect = EditorGUILayout.GetControlRect(false, 18);
            if (Event.current.type == EventType.Repaint)
            {
                EditorGUI.DrawRect(headerRect,
                    isDark ? new Color(0.13f, 0.13f, 0.15f, 1f) : new Color(0.70f, 0.70f, 0.72f, 1f));
            }
            var hStyle = new GUIStyle(EditorStyles.miniLabel)
            {
                fontStyle = FontStyle.Bold,
                normal    = { textColor = isDark ? new Color(0.55f, 0.60f, 0.65f) : new Color(0.28f, 0.30f, 0.33f) }
            };
            GUI.Label(new Rect(headerRect.x + 4,  headerRect.y, 40,           headerRect.height), "State",   hStyle);
            GUI.Label(new Rect(headerRect.x + 48, headerRect.y, FlagNameWidth, headerRect.height), "Name",    hStyle);
            GUI.Label(new Rect(headerRect.x + 48 + FlagNameWidth, headerRect.y, 200, headerRect.height), "Variant", hStyle);

            // Rows
            for (int i = 0; i < flags.Count; i++)
            {
                var flag    = flags[i];
                var rowRect = EditorGUILayout.GetControlRect(false, 20);

                // Alternating row tint
                if (Event.current.type == EventType.Repaint && i % 2 == 0)
                {
                    EditorGUI.DrawRect(rowRect,
                        isDark ? new Color(0.16f, 0.16f, 0.18f, 0.5f) : new Color(0.84f, 0.84f, 0.86f, 0.5f));
                }

                // ON/OFF badge
                bool on = flag.Enabled;
                var badgeColor = on ? new Color(0.10f, 0.45f, 0.18f, 1f) : new Color(0.45f, 0.10f, 0.10f, 1f);
                var badgeRect  = new Rect(rowRect.x + 4, rowRect.y + 3, 38, 14);
                if (Event.current.type == EventType.Repaint)
                    EditorGUI.DrawRect(badgeRect, badgeColor);
                GUI.Label(badgeRect, on ? "ON" : "OFF", on ? _flagOnStyle : _flagOffStyle);

                // Flag name
                var name = flag.Name.Length > 24 ? flag.Name.Substring(0, 21) + "..." : flag.Name;
                GUI.Label(new Rect(rowRect.x + 48, rowRect.y, FlagNameWidth, rowRect.height),
                    new GUIContent(name, flag.Name), _rowValueStyle);

                // Variant
                if (flag.Variant != null)
                {
                    var payload = flag.Variant.Value?.ToString() ?? "";
                    if (payload.Length > 28) payload = payload.Substring(0, 25) + "...";
                    var variantText = string.IsNullOrEmpty(flag.Variant.Name)
                        ? payload
                        : $"{flag.Variant.Name}: {payload}";
                    GUI.Label(new Rect(rowRect.x + 48 + FlagNameWidth, rowRect.y, 200, rowRect.height),
                        variantText, _rowValueStyle);
                }
            }

            EditorGUILayout.Space(4);
        }

        private void DrawContextContent(GatrixClient client)
        {
            EditorGUILayout.Space(2);
            var ctx = client.Features.GetContext();
            DrawRow("AppName",     ctx.AppName     ?? "-");
            DrawRow("Environment", ctx.Environment ?? "-");
            DrawRow("UserId",      ctx.UserId      ?? "-");
            DrawRow("SessionId",   ctx.SessionId   ?? "-");
            if (ctx.Properties != null)
            {
                foreach (var kvp in ctx.Properties)
                    DrawRow(kvp.Key, kvp.Value?.ToString() ?? "-");
            }
            EditorGUILayout.Space(4);
        }

        private void DrawStatsContent(GatrixClient client)
        {
            EditorGUILayout.Space(2);
            var stats = client.Features.GetStats();
            DrawRow("State",       stats.SdkState.ToString());
            DrawRow("Total Flags", stats.TotalFlagCount.ToString());
            DrawRow("Fetches",     stats.FetchFlagsCount.ToString());
            DrawRow("Updates",     stats.UpdateCount.ToString());
            DrawRow("Errors",      stats.ErrorCount.ToString());
            DrawRow("Impressions", stats.ImpressionCount.ToString());

            var streamColor = stats.StreamingState == StreamingConnectionState.Connected
                ? "#44ee66"
                : stats.StreamingState == StreamingConnectionState.Disconnected
                    ? "#888888"
                    : "#ffcc44";
            DrawRow("Streaming", $"<color={streamColor}>{stats.StreamingState}</color>", richText: true);
            EditorGUILayout.Space(4);
        }

        // ==================== Row Helper ====================

        private void DrawRow(string label, string value, bool richText = false)
        {
            EditorGUILayout.BeginHorizontal();
            EditorGUILayout.LabelField(label, _rowLabelStyle, GUILayout.Width(LabelWidth));
            if (richText)
                EditorGUILayout.LabelField(value, _richLabel);
            else
                EditorGUILayout.LabelField(value, _rowValueStyle);
            EditorGUILayout.EndHorizontal();
        }
    }
}
#endif
