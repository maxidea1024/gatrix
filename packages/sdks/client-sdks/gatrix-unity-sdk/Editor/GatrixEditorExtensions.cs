// GatrixEditorExtensions - Professional UI helpers for Gatrix components
// Inspired by stylized editors like NGUI/Odin

#if UNITY_EDITOR
using UnityEditor;
using UnityEngine;

namespace Gatrix.Unity.SDK.Editor
{
    public static class GatrixEditorExtensions
    {
        private static GUIStyle _headerStyle;
        private static GUIStyle _boxStyle;
        private static Color _gatrixBlue = new Color(0.12f, 0.45f, 0.85f);
        private static Color _gatrixHeaderBg = new Color(0.15f, 0.15f, 0.15f, 0.8f);

        public static void DrawHeader(string title, string subtitle = null)
        {
            if (_headerStyle == null)
            {
                _headerStyle = new GUIStyle(EditorStyles.boldLabel)
                {
                    fontSize = 13,
                    alignment = TextAnchor.MiddleLeft
                };
                _headerStyle.normal.textColor = Color.white;
            }

            var rect = EditorGUILayout.BeginHorizontal(GUILayout.Height(30));
            var fullWidth = rect.width > 0 ? rect.width : Screen.width - 40;
            
            // Background fill for header
            var bgRect = new Rect(rect.x - 5, rect.y - 2, fullWidth + 10, 32);
            EditorGUI.DrawRect(bgRect, _gatrixHeaderBg);
            EditorGUI.DrawRect(new Rect(bgRect.x, bgRect.y, 4, bgRect.height), _gatrixBlue);

            EditorGUILayout.Space(10);
            EditorGUILayout.BeginVertical();
            EditorGUILayout.Space(2);
            EditorGUILayout.LabelField(title.ToUpper(), _headerStyle);
            if (!string.IsNullOrEmpty(subtitle))
            {
                var subStyle = new GUIStyle(EditorStyles.miniLabel);
                subStyle.normal.textColor = new Color(0.7f, 0.7f, 0.7f);
                EditorGUILayout.LabelField(subtitle, subStyle);
            }
            EditorGUILayout.EndVertical();

            // Status icon (if running)
            if (Application.isPlaying && GatrixBehaviour.IsInitialized)
            {
                GUILayout.FlexibleSpace();
                EditorGUILayout.BeginVertical();
                EditorGUILayout.Space(8);
                var dotColor = new Color(0.4f, 1f, 0.4f);
                var prevColor = GUI.color;
                GUI.color = dotColor;
                EditorGUILayout.LabelField("\u25CF LIVE", EditorStyles.boldLabel, GUILayout.Width(50));
                GUI.color = prevColor;
                EditorGUILayout.EndVertical();
            }

            EditorGUILayout.EndHorizontal();
            EditorGUILayout.Space(10);
        }

        public static void BeginGroup(string label, string icon = "")
        {
            EditorGUILayout.BeginVertical(EditorStyles.helpBox);
            EditorGUILayout.LabelField(new GUIContent(" " + label, icon), EditorStyles.boldLabel);
            EditorGUILayout.Space(2);
        }

        public static void EndGroup()
        {
            EditorGUILayout.Space(2);
            EditorGUILayout.EndVertical();
            EditorGUILayout.Space(5);
        }

        public static void DrawSeparator()
        {
            var rect = EditorGUILayout.GetControlRect(false, 1);
            rect.height = 1;
            EditorGUI.DrawRect(rect, new Color(0.5f, 0.5f, 0.5f, 0.3f));
            EditorGUILayout.Space(5);
        }

        public static void DrawFlagStatus(string flagName)
        {
            if (!Application.isPlaying || !GatrixBehaviour.IsInitialized || string.IsNullOrEmpty(flagName)) return;

            var client = GatrixBehaviour.Client;
            var flag = client.Features.GetFlagProxy(flagName);
            
            EditorGUILayout.BeginHorizontal(EditorStyles.helpBox);
            EditorGUILayout.LabelField("Current State:", GUILayout.Width(100));
            
            var statusColor = flag.Enabled ? new Color(0.4f, 0.9f, 0.4f) : new Color(0.9f, 0.4f, 0.4f);
            var style = new GUIStyle(EditorStyles.boldLabel) { richText = true };
            
            string statusText = flag.Enabled 
                ? $"<color=#66FF66>ON</color> ({flag.Variant?.Name ?? "none"})" 
                : "<color=#FF6666>OFF</color>";
                
            EditorGUILayout.LabelField(statusText, style);
            EditorGUILayout.EndHorizontal();
            EditorGUILayout.Space(2);
        }
    }
}
#endif
