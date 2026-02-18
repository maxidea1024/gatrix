// GatrixAboutWindow - About dialog for Gatrix Unity SDK
// Accessible from Window > Gatrix > About

#if UNITY_EDITOR
using UnityEditor;
using UnityEngine;

namespace Gatrix.Unity.SDK.Editor
{
    /// <summary>
    /// About window showing SDK information, version, and links.
    /// Emerald AI-inspired: hero banner, color-coded info rows, action buttons.
    /// </summary>
    public class GatrixAboutWindow : EditorWindow
    {
        [MenuItem("Window/Gatrix/About", priority = 0)]
        public static void ShowWindow()
        {
            var window = GetWindow<GatrixAboutWindow>(true, "About Gatrix SDK", true);
            window.minSize = new Vector2(380, 360);
            window.maxSize = new Vector2(380, 360);
            window.ShowUtility();
        }

        private void OnGUI()
        {
            bool isDark    = EditorGUIUtility.isProSkin;
            float w        = position.width;

            // ── Hero Banner ─────────────────────────────────────
            var bannerRect = new Rect(0, 0, w, 90);
            if (Event.current.type == EventType.Repaint)
            {
                // Dark gradient background
                EditorGUI.DrawRect(bannerRect,
                    isDark ? new Color(0.10f, 0.10f, 0.13f, 1f) : new Color(0.78f, 0.78f, 0.82f, 1f));
                // Bottom accent line
                EditorGUI.DrawRect(new Rect(0, bannerRect.yMax - 3, w, 3), GatrixEditorStyle.AccentBlue);
                // Left accent bar
                EditorGUI.DrawRect(new Rect(0, 0, 5, bannerRect.height), GatrixEditorStyle.AccentBlue);
            }

            // Diamond icon (large)
            var iconStyle = new GUIStyle(EditorStyles.boldLabel)
            {
                fontSize  = 32,
                alignment = TextAnchor.MiddleCenter,
                normal    = { textColor = GatrixEditorStyle.AccentBlue }
            };
            GUI.Label(new Rect(10, 0, 60, 90), "\u25c6", iconStyle);

            // SDK name
            var titleStyle = new GUIStyle(EditorStyles.boldLabel)
            {
                fontSize  = 22,
                alignment = TextAnchor.UpperLeft,
                normal    = { textColor = Color.white }
            };
            GUI.Label(new Rect(72, 14, w - 82, 32), "Gatrix SDK", titleStyle);

            // Tagline
            var tagStyle = new GUIStyle(EditorStyles.label)
            {
                fontSize  = 11,
                alignment = TextAnchor.UpperLeft,
                normal    = { textColor = new Color(0.60f, 0.75f, 1f) }
            };
            GUI.Label(new Rect(74, 46, w - 84, 18), "Feature Flag Management for Unity", tagStyle);

            // Version badge
            var versionBadgeRect = new Rect(w - 90, 60, 82, 18);
            if (Event.current.type == EventType.Repaint)
                EditorGUI.DrawRect(versionBadgeRect, new Color(0.22f, 0.52f, 0.95f, 0.25f));
            var versionStyle = new GUIStyle(EditorStyles.miniLabel)
            {
                alignment = TextAnchor.MiddleCenter,
                normal    = { textColor = new Color(0.70f, 0.85f, 1f) }
            };
            GUI.Label(versionBadgeRect, "v" + SdkInfo.Version, versionStyle);

            GUILayout.Space(90);

            // ── Info Section ────────────────────────────────────
            DrawSectionBar("  SDK Information", GatrixEditorStyle.AccentBlue);
            EditorGUILayout.Space(4);

            DrawInfoRow("SDK Name",  SdkInfo.Name,                          GatrixEditorStyle.AccentBlue);
            DrawInfoRow("Version",   SdkInfo.Version,                       GatrixEditorStyle.AccentBlue);
            DrawInfoRow("Unity",     "Unity " + Application.unityVersion,   GatrixEditorStyle.AccentTeal);
            DrawInfoRow("Platform",  Application.platform.ToString(),        GatrixEditorStyle.AccentTeal);

            EditorGUILayout.Space(6);

            // ── Status Section ──────────────────────────────────
            DrawSectionBar("  Runtime Status", GatrixEditorStyle.AccentGreen);
            EditorGUILayout.Space(4);

            var client = GatrixBehaviour.Client;
            if (client != null)
            {
                bool ready = client.IsReady;
                DrawInfoRow("Status",
                    ready ? "Ready" : "Initializing",
                    ready ? GatrixEditorStyle.AccentGreen : GatrixEditorStyle.AccentOrange,
                    bold: true);
                DrawInfoRow("Connection", client.ConnectionId ?? "N/A", GatrixEditorStyle.AccentGray);
            }
            else
            {
                DrawInfoRow("Status", "Not Initialized", GatrixEditorStyle.AccentGray);
            }

            EditorGUILayout.Space(8);

            // ── Buttons ─────────────────────────────────────────
            EditorGUILayout.BeginHorizontal();
            GUILayout.Space(12);

            if (GUILayout.Button("Setup Wizard", GUILayout.Height(28)))
                GatrixSetupWindow.ShowWindow();

            GUILayout.Space(6);

            if (GUILayout.Button("Monitor", GUILayout.Height(28)))
                GatrixMonitorWindow.ShowWindow();

            GUILayout.Space(6);

            var prevBg = GUI.backgroundColor;
            GUI.backgroundColor = new Color(0.35f, 0.35f, 0.40f);
            if (GUILayout.Button("Close", GUILayout.Height(28), GUILayout.Width(60)))
                Close();
            GUI.backgroundColor = prevBg;

            GUILayout.Space(12);
            EditorGUILayout.EndHorizontal();

            EditorGUILayout.Space(4);
        }

        // ==================== Helpers ====================

        private static void DrawSectionBar(string title, Color accentColor)
        {
            bool isDark    = EditorGUIUtility.isProSkin;
            float fullWidth = EditorGUIUtility.currentViewWidth;

            var rect = EditorGUILayout.GetControlRect(false, 22);

            if (Event.current.type == EventType.Repaint)
            {
                EditorGUI.DrawRect(rect,
                    isDark ? new Color(0.17f, 0.17f, 0.19f, 1f) : new Color(0.74f, 0.74f, 0.76f, 1f));
                EditorGUI.DrawRect(new Rect(rect.x, rect.y, 3, rect.height), accentColor);
                EditorGUI.DrawRect(new Rect(rect.x, rect.yMax - 1, fullWidth, 1),
                    new Color(accentColor.r, accentColor.g, accentColor.b, 0.35f));
            }

            var style = new GUIStyle(EditorStyles.boldLabel)
            {
                fontSize  = 10,
                alignment = TextAnchor.MiddleLeft,
                normal    = { textColor = isDark ? new Color(0.80f, 0.82f, 0.85f) : new Color(0.12f, 0.14f, 0.16f) }
            };
            GUI.Label(new Rect(rect.x + 8, rect.y, rect.width - 16, rect.height), title, style);
        }

        private static void DrawInfoRow(string label, string value, Color accentColor, bool bold = false)
        {
            bool isDark = EditorGUIUtility.isProSkin;

            var rowRect = EditorGUILayout.GetControlRect(false, 20);

            // Left dot accent
            if (Event.current.type == EventType.Repaint)
            {
                EditorGUI.DrawRect(new Rect(rowRect.x + 12, rowRect.y + 7, 5, 5), accentColor);
            }

            var labelStyle = new GUIStyle(EditorStyles.label)
            {
                fontSize = 11,
                normal   = { textColor = isDark ? new Color(0.58f, 0.63f, 0.70f) : new Color(0.32f, 0.35f, 0.40f) }
            };
            var valueStyle = new GUIStyle(EditorStyles.label)
            {
                fontSize  = 11,
                fontStyle = bold ? FontStyle.Bold : FontStyle.Normal,
                normal    = { textColor = bold ? accentColor : (isDark ? new Color(0.88f, 0.90f, 0.92f) : new Color(0.08f, 0.10f, 0.12f)) }
            };

            GUI.Label(new Rect(rowRect.x + 22, rowRect.y, 100, rowRect.height), label + ":", labelStyle);
            GUI.Label(new Rect(rowRect.x + 122, rowRect.y, rowRect.width - 130, rowRect.height), value, valueStyle);
        }
    }
}
#endif
