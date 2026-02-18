// GatrixEditorExtensions - Professional UI helpers for Gatrix components
// Emerald AI-inspired: color-coded group headers, live status badge, separator

#if UNITY_EDITOR
using UnityEditor;
using UnityEngine;

namespace Gatrix.Unity.SDK.Editor
{
    public static class GatrixEditorExtensions
    {
        // ==================== Header ====================

        /// <summary>
        /// Draws a Gatrix title bar (delegates to GatrixEditorStyle.DrawTitleBar).
        /// </summary>
        public static void DrawHeader(string title, string subtitle = null)
        {
            GatrixEditorStyle.DrawTitleBar(title, subtitle);
        }

        /// <summary>
        /// Draws a Gatrix title bar with a custom accent color.
        /// </summary>
        public static void DrawHeader(string title, string subtitle, Color accentColor)
        {
            GatrixEditorStyle.DrawTitleBar(title, subtitle, true, accentColor);
        }

        // ==================== Group ====================

        /// <summary>
        /// Begins a styled group with a labeled header bar (Emerald AI style).
        /// Uses the default blue accent color.
        /// </summary>
        public static void BeginGroup(string label, string icon = "")
        {
            GatrixEditorStyle.BeginGroup(label, GatrixEditorStyle.AccentBlue, icon);
        }

        /// <summary>
        /// Begins a styled group with a custom accent color.
        /// </summary>
        public static void BeginGroup(string label, Color accentColor, string icon = "")
        {
            GatrixEditorStyle.BeginGroup(label, accentColor, icon);
        }

        /// <summary>
        /// Ends a styled group.
        /// </summary>
        public static void EndGroup()
        {
            GatrixEditorStyle.EndGroup();
        }

        // ==================== Separator ====================

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

        // ==================== Live Flag Status Badge ====================

        /// <summary>
        /// Draws a live flag status badge (only in Play Mode when SDK is ready).
        /// Shows current enabled state, variant name, and a quick Monitor button.
        /// </summary>
        public static void DrawFlagStatus(string flagName)
        {
            if (!Application.isPlaying || !GatrixBehaviour.IsInitialized || string.IsNullOrEmpty(flagName))
                return;

            var client = GatrixBehaviour.Client;
            var flag   = client.Features.GetFlagProxy(flagName);

            // Status row
            var statusRect = EditorGUILayout.GetControlRect(false, 22);
            bool isDark    = EditorGUIUtility.isProSkin;
            var bgColor    = flag.Enabled
                ? (isDark ? new Color(0.10f, 0.30f, 0.12f, 0.6f) : new Color(0.80f, 0.95f, 0.82f, 1f))
                : (isDark ? new Color(0.30f, 0.10f, 0.10f, 0.6f) : new Color(0.95f, 0.82f, 0.82f, 1f));
            var accentColor = flag.Enabled
                ? GatrixEditorStyle.AccentGreen
                : GatrixEditorStyle.AccentRed;

            if (Event.current.type == EventType.Repaint)
            {
                EditorGUI.DrawRect(statusRect, bgColor);
                EditorGUI.DrawRect(new Rect(statusRect.x, statusRect.y, 3, statusRect.height), accentColor);
            }

            // State label
            var stateStyle = new GUIStyle(EditorStyles.boldLabel)
            {
                fontSize  = 10,
                alignment = TextAnchor.MiddleLeft,
                richText  = true,
                normal    = { textColor = accentColor }
            };
            var stateText = flag.Enabled ? "\u25cf  ON" : "\u25cf  OFF";
            GUI.Label(new Rect(statusRect.x + 8, statusRect.y, 50, statusRect.height), stateText, stateStyle);

            // Variant name
            if (flag.Variant != null && !string.IsNullOrEmpty(flag.Variant.Name))
            {
                var varStyle = new GUIStyle(EditorStyles.miniLabel)
                {
                    normal = { textColor = isDark ? new Color(0.75f, 0.80f, 0.85f) : new Color(0.25f, 0.28f, 0.32f) }
                };
                GUI.Label(new Rect(statusRect.x + 58, statusRect.y, statusRect.width - 120, statusRect.height),
                    flag.Variant.Name, varStyle);
            }

            // Monitor button
            if (GUI.Button(new Rect(statusRect.xMax - 68, statusRect.y + 2, 66, 18), "Monitor \u2197", EditorStyles.miniButton))
            {
                GatrixMonitorWindow.ShowWindow();
            }

            EditorGUILayout.Space(2);
        }
    }
}
#endif
