// GatrixEditorExtensions - Professional UI helpers for Gatrix components
// Inspired by MoreMountains "Feel" framework editor style

#if UNITY_EDITOR
using UnityEditor;
using UnityEngine;

namespace Gatrix.Unity.SDK.Editor
{
    public static class GatrixEditorExtensions
    {
        private static readonly Color _gatrixBlue = new Color(0.18f, 0.48f, 0.92f, 1f);
        private static readonly Color _groupHeaderBgDark = new Color(0.22f, 0.22f, 0.22f, 1f);
        private static readonly Color _groupHeaderBgLight = new Color(0.78f, 0.78f, 0.78f, 1f);

        private static GUIStyle _groupHeaderStyle;
        private static GUIStyle _groupBodyStyle;

        private static void EnsureStyles()
        {
            if (_groupHeaderStyle == null)
            {
                _groupHeaderStyle = new GUIStyle(EditorStyles.boldLabel)
                {
                    fontSize = 11,
                    alignment = TextAnchor.MiddleLeft,
                    padding = new RectOffset(6, 4, 0, 0),
                };
                _groupHeaderStyle.normal.textColor = EditorGUIUtility.isProSkin
                    ? new Color(0.85f, 0.85f, 0.85f)
                    : new Color(0.1f, 0.1f, 0.1f);
            }

            if (_groupBodyStyle == null)
            {
                _groupBodyStyle = new GUIStyle(EditorStyles.helpBox)
                {
                    padding = new RectOffset(8, 8, 6, 6),
                    margin = new RectOffset(0, 0, 0, 4),
                };
            }
        }

        /// <summary>
        /// Draws a Feel-style component header (delegates to GatrixEditorStyle.DrawTitleBar).
        /// </summary>
        public static void DrawHeader(string title, string subtitle = null)
        {
            GatrixEditorStyle.DrawTitleBar(title, subtitle);
        }

        /// <summary>
        /// Begins a styled group with a labeled header bar.
        /// </summary>
        public static void BeginGroup(string label, string icon = "")
        {
            EnsureStyles();

            EditorGUILayout.BeginVertical(_groupBodyStyle);

            // Group header row
            var headerRect = EditorGUILayout.GetControlRect(false, 18);
            var bgColor = EditorGUIUtility.isProSkin ? _groupHeaderBgDark : _groupHeaderBgLight;
            EditorGUI.DrawRect(headerRect, bgColor);
            // Left accent
            EditorGUI.DrawRect(new Rect(headerRect.x, headerRect.y, 2, headerRect.height), _gatrixBlue);

            var labelRect = new Rect(headerRect.x + 6, headerRect.y, headerRect.width - 6, headerRect.height);
            var displayLabel = string.IsNullOrEmpty(icon) ? label : $"{icon}  {label}";
            GUI.Label(labelRect, displayLabel, _groupHeaderStyle);

            EditorGUILayout.Space(4);
        }

        /// <summary>
        /// Ends a styled group.
        /// </summary>
        public static void EndGroup()
        {
            EditorGUILayout.Space(2);
            EditorGUILayout.EndVertical();
            EditorGUILayout.Space(4);
        }

        /// <summary>
        /// Draws a thin separator line.
        /// </summary>
        public static void DrawSeparator()
        {
            var rect = EditorGUILayout.GetControlRect(false, 1);
            rect.height = 1;
            EditorGUI.DrawRect(rect, new Color(0.5f, 0.5f, 0.5f, 0.3f));
            EditorGUILayout.Space(4);
        }

        /// <summary>
        /// Draws a live flag status badge (only in Play Mode when SDK is ready).
        /// </summary>
        public static void DrawFlagStatus(string flagName)
        {
            if (!Application.isPlaying || !GatrixBehaviour.IsInitialized || string.IsNullOrEmpty(flagName))
                return;

            var client = GatrixBehaviour.Client;
            var flag = client.Features.GetFlagProxy(flagName);

            EditorGUILayout.BeginHorizontal(EditorStyles.helpBox);
            EditorGUILayout.LabelField("Live State:", GUILayout.Width(72));

            var style = new GUIStyle(EditorStyles.boldLabel) { richText = true };
            string statusText = flag.Enabled
                ? $"<color=#66FF66>● ON</color>  <color=#aaaaaa>{flag.Variant?.Name ?? "none"}</color>"
                : "<color=#FF6666>● OFF</color>";

            EditorGUILayout.LabelField(statusText, style);

            // Quick-open Monitor button
            if (GUILayout.Button("Monitor ↗", EditorStyles.miniButton, GUILayout.Width(70)))
            {
                GatrixMonitorWindow.ShowWindow();
            }

            EditorGUILayout.EndHorizontal();
            EditorGUILayout.Space(2);
        }
    }
}
#endif
