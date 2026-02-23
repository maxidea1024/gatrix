// GatrixAboutWindow - About dialog for Gatrix Unity SDK
// Accessible from Window > Gatrix > About

#if UNITY_EDITOR
using UnityEditor;
using UnityEngine;

namespace Gatrix.Unity.SDK.Editor
{
    /// <summary>
    /// About window showing SDK information, version, and links.
    /// </summary>
    public class GatrixAboutWindow : EditorWindow
    {
        [MenuItem("Window/Gatrix/About", priority = 100)]
        public static void ShowWindow()
        {
            var window = GetWindow<GatrixAboutWindow>(true, "About Gatrix SDK", true);
            window.minSize = new Vector2(380, 340);
            window.maxSize = new Vector2(380, 340);
            window.ShowUtility();
        }

        private void OnGUI()
        {
            bool isDark = EditorGUIUtility.isProSkin;

            // ── Hero Banner ─────────────────────────────────────
            GatrixEditorStyle.DrawWindowHeader("Gatrix SDK", "Feature Flag Management for Unity", "\u25c6", 60);

            // Version badge (right-aligned below header)
            EditorGUILayout.BeginHorizontal();
            GUILayout.FlexibleSpace();
            var vBadgeRect = GUILayoutUtility.GetRect(80, 20);
            if (Event.current.type == EventType.Repaint)
                EditorGUI.DrawRect(vBadgeRect, new Color(GatrixEditorStyle.AccentBlue.r, GatrixEditorStyle.AccentBlue.g, GatrixEditorStyle.AccentBlue.b, 0.2f));
            var vStyle = new GUIStyle(EditorStyles.miniLabel)
            {
                alignment = TextAnchor.MiddleCenter,
                normal    = { textColor = GatrixEditorStyle.AccentBlue }
            };
            GUI.Label(vBadgeRect, "v" + SdkInfo.Version, vStyle);
            GUILayout.Space(8);
            EditorGUILayout.EndHorizontal();

            EditorGUILayout.Space(4);

            // ── SDK Info ────────────────────────────────────────
            GatrixEditorStyle.DrawSectionHeader("SDK Information", GatrixEditorStyle.AccentBlue);
            EditorGUILayout.Space(2);

            DrawInfoRow("SDK Name", SdkInfo.Name);
            DrawInfoRow("Version",  SdkInfo.Version);
            DrawInfoRow("Unity",    Application.unityVersion);
            DrawInfoRow("Platform", Application.platform.ToString());

            EditorGUILayout.Space(6);

            // ── Runtime Status ──────────────────────────────────
            GatrixEditorStyle.DrawSectionHeader("Runtime Status", GatrixEditorStyle.AccentGreen);
            EditorGUILayout.Space(2);

            var client = GatrixBehaviour.Client;
            if (client != null)
            {
                bool ready = client.IsReady;
                var statusColor = ready
                    ? (isDark ? new Color(0.30f, 0.90f, 0.40f) : new Color(0.10f, 0.55f, 0.20f))
                    : (isDark ? new Color(1f, 0.80f, 0.30f)    : new Color(0.60f, 0.45f, 0f));
                var statusText = ready ? "Ready" : "Initializing";

                EditorGUILayout.BeginHorizontal();
                EditorGUILayout.LabelField("Status:", GUILayout.Width(90));
                var statusStyle = new GUIStyle(EditorStyles.boldLabel)
                {
                    normal = { textColor = statusColor }
                };
                EditorGUILayout.LabelField(statusText, statusStyle);
                EditorGUILayout.EndHorizontal();

                DrawInfoRow("Connection", client.ConnectionId ?? "N/A");
            }
            else
            {
                DrawInfoRow("Status", "Not Initialized");
            }

            EditorGUILayout.Space(12);

            // ── Buttons ─────────────────────────────────────────
            EditorGUILayout.BeginHorizontal();
            GUILayout.Space(12);
            if (GUILayout.Button("Setup Wizard", GUILayout.Height(28)))
                GatrixSetupWindow.ShowWindow();
            GUILayout.Space(6);
            if (GUILayout.Button("Monitor", GUILayout.Height(28)))
                GatrixMonitorWindow.ShowWindow();
            GUILayout.Space(12);
            EditorGUILayout.EndHorizontal();
        }

        private static void DrawInfoRow(string label, string value)
        {
            EditorGUILayout.BeginHorizontal();
            GUILayout.Space(20);

            bool isDark = EditorGUIUtility.isProSkin;

            // Dot accent
            var dotRect = GUILayoutUtility.GetRect(6, 16, GUILayout.Width(6));
            if (Event.current.type == EventType.Repaint)
                EditorGUI.DrawRect(new Rect(dotRect.x, dotRect.y + 5, 4, 4), GatrixEditorStyle.AccentBlue);

            var labelStyle = new GUIStyle(EditorStyles.label)
            {
                normal = { textColor = isDark ? new Color(0.55f, 0.60f, 0.68f) : new Color(0.30f, 0.33f, 0.38f) }
            };
            EditorGUILayout.LabelField(label + ":", labelStyle, GUILayout.Width(80));
            EditorGUILayout.LabelField(value);
            EditorGUILayout.EndHorizontal();
        }
    }
}
#endif
