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
        private GUIStyle _titleStyle;
        private GUIStyle _versionStyle;
        private GUIStyle _labelStyle;
        private GUIStyle _linkStyle;
        private bool _stylesInitialized;

        [MenuItem("Window/Gatrix/About", priority = 0)]
        public static void ShowWindow()
        {
            var window = GetWindow<GatrixAboutWindow>(true, "About Gatrix SDK", true);
            window.minSize = new Vector2(360, 300);
            window.maxSize = new Vector2(360, 300);
            window.ShowUtility();
        }

        private void InitStyles()
        {
            if (_stylesInitialized) return;

            _titleStyle = new GUIStyle(EditorStyles.boldLabel)
            {
                fontSize = 22,
                alignment = TextAnchor.MiddleCenter,
                margin = new RectOffset(0, 0, 16, 4)
            };

            _versionStyle = new GUIStyle(EditorStyles.label)
            {
                fontSize = 13,
                alignment = TextAnchor.MiddleCenter,
                margin = new RectOffset(0, 0, 0, 16)
            };

            _labelStyle = new GUIStyle(EditorStyles.label)
            {
                fontSize = 12,
                alignment = TextAnchor.MiddleLeft,
                margin = new RectOffset(20, 20, 2, 2)
            };

            _linkStyle = new GUIStyle(EditorStyles.label)
            {
                fontSize = 12,
                alignment = TextAnchor.MiddleLeft,
                margin = new RectOffset(20, 20, 2, 2),
                normal = { textColor = new Color(0.3f, 0.5f, 1.0f) }
            };

            _stylesInitialized = true;
        }

        private void OnGUI()
        {
            InitStyles();

            EditorGUILayout.Space(8);

            // Title
            EditorGUILayout.LabelField("Gatrix SDK", _titleStyle);
            EditorGUILayout.LabelField("Feature Flag Management for Unity", _versionStyle);

            // Separator
            var rect = EditorGUILayout.GetControlRect(false, 1);
            EditorGUI.DrawRect(rect, new Color(0.5f, 0.5f, 0.5f, 0.3f));
            EditorGUILayout.Space(8);

            // Info
            DrawInfoRow("SDK Name", SdkInfo.Name);
            DrawInfoRow("Version", SdkInfo.Version);
            DrawInfoRow("Platform", "Unity " + Application.unityVersion);
            DrawInfoRow("Runtime", Application.platform.ToString());

            EditorGUILayout.Space(8);

            // Separator
            rect = EditorGUILayout.GetControlRect(false, 1);
            EditorGUI.DrawRect(rect, new Color(0.5f, 0.5f, 0.5f, 0.3f));
            EditorGUILayout.Space(8);

            // Status
            var client = GatrixBehaviour.Client;
            if (client != null)
            {
                var statusColor = client.IsReady ? "green" : "yellow";
                var statusText = client.IsReady ? "Ready" : "Initializing";
                var richStyle = new GUIStyle(_labelStyle) { richText = true };
                EditorGUILayout.LabelField(
                    $"Status: <color={statusColor}><b>{statusText}</b></color>", richStyle);
                EditorGUILayout.LabelField(
                    $"Connection: {client.ConnectionId ?? "N/A"}", _labelStyle);
            }
            else
            {
                EditorGUILayout.LabelField("Status: Not Initialized", _labelStyle);
            }

            EditorGUILayout.Space(12);

            // Buttons
            EditorGUILayout.BeginHorizontal();
            GUILayout.FlexibleSpace();
            if (GUILayout.Button("Setup Wizard", GUILayout.Width(110), GUILayout.Height(26)))
            {
                GatrixSetupWindow.ShowWindow();
            }
            if (GUILayout.Button("Monitor", GUILayout.Width(90), GUILayout.Height(26)))
            {
                GatrixMonitorWindow.ShowWindow();
            }
            if (GUILayout.Button("Close", GUILayout.Width(70), GUILayout.Height(26)))
            {
                Close();
            }
            GUILayout.FlexibleSpace();
            EditorGUILayout.EndHorizontal();
        }

        private void DrawInfoRow(string label, string value)
        {
            EditorGUILayout.BeginHorizontal();
            EditorGUILayout.LabelField(label + ":", _labelStyle, GUILayout.Width(100));
            EditorGUILayout.LabelField(value, _labelStyle);
            EditorGUILayout.EndHorizontal();
        }
    }
}
#endif
