// GatrixSettingsProvider - Unity Project Settings integration
// Provides a persistent ScriptableObject for SDK configuration in the editor

#if UNITY_EDITOR
using UnityEditor;
using UnityEngine;

namespace Gatrix.Unity.SDK.Editor
{
    /// <summary>
    /// Project Settings page for Gatrix SDK (Edit > Project Settings > Gatrix)
    /// </summary>
    public class GatrixSettingsProvider : SettingsProvider
    {
        private SerializedObject _settingsObject;

        public GatrixSettingsProvider(string path, SettingsScope scope)
            : base(path, scope) { }

        [SettingsProvider]
        public static SettingsProvider CreateProvider()
        {
            return new GatrixSettingsProvider("Project/Gatrix SDK", SettingsScope.Project)
            {
                keywords = new[] { "Gatrix", "Feature", "Flags", "SDK", "Toggle" }
            };
        }

        public override void OnGUI(string searchContext)
        {
            EditorGUILayout.Space(10);

            // Header
            var headerStyle = new GUIStyle(EditorStyles.boldLabel) { fontSize = 16 };
            EditorGUILayout.LabelField("Gatrix SDK Configuration", headerStyle);
            EditorGUILayout.Space(8);

            // Runtime status
            DrawRuntimeStatus();

            EditorGUILayout.Space(8);
            DrawHorizontalLine();
            EditorGUILayout.Space(8);

            // Configuration help
            EditorGUILayout.LabelField("Configuration", EditorStyles.boldLabel);
            EditorGUILayout.Space(4);

            EditorGUILayout.HelpBox(
                "Gatrix SDK is configured programmatically via GatrixClientConfig.\n\n" +
                "Example:\n" +
                "  var config = new GatrixClientConfig\n" +
                "  {\n" +
                "      ApiUrl = \"https://your-api.example.com/api/v1\",\n" +
                "      ApiToken = \"your-api-token\",\n" +
                "      AppName = \"your-app\",\n" +
                "      Environment = \"production\"\n" +
                "  };\n" +
                "  await GatrixBehaviour.InitializeAsync(config);",
                MessageType.Info);

            EditorGUILayout.Space(8);
            DrawHorizontalLine();
            EditorGUILayout.Space(8);

            // Quick links
            EditorGUILayout.LabelField("Tools", EditorStyles.boldLabel);
            EditorGUILayout.Space(4);

            EditorGUILayout.BeginHorizontal();
            if (GUILayout.Button("Open Monitor Window", GUILayout.Height(30)))
            {
                GatrixMonitorWindow.ShowWindow();
            }
            EditorGUILayout.EndHorizontal();

            EditorGUILayout.Space(8);

            // Info section
            EditorGUILayout.LabelField("SDK Information", EditorStyles.boldLabel);
            EditorGUILayout.Space(4);
            DrawInfoField("SDK Name", GatrixClient.SdkName);
            DrawInfoField("SDK Version", GatrixClient.SdkVersion);
            DrawInfoField("Unity Version", Application.unityVersion);
            DrawInfoField("Platform", Application.platform.ToString());

            EditorGUILayout.Space(8);

            // Storage info
            EditorGUILayout.LabelField("Storage Paths", EditorStyles.boldLabel);
            EditorGUILayout.Space(4);
            DrawInfoField("Persistent Path", Application.persistentDataPath);
            DrawInfoField("Data Path", Application.dataPath);
        }

        private void DrawRuntimeStatus()
        {
            EditorGUILayout.LabelField("Runtime Status", EditorStyles.boldLabel);
            EditorGUILayout.Space(4);

            var isPlaying = EditorApplication.isPlaying;
            var isInitialized = isPlaying && GatrixBehaviour.IsInitialized;

            var statusColor = isInitialized ? "green" : isPlaying ? "yellow" : "gray";
            var statusText = isInitialized
                ? "Running"
                : isPlaying
                    ? "Play Mode (SDK not initialized)"
                    : "Editor Mode (not running)";

            var style = new GUIStyle(EditorStyles.label) { richText = true };
            EditorGUILayout.LabelField(
                $"Status: <color={statusColor}><b>{statusText}</b></color>", style);

            if (isInitialized)
            {
                var client = GatrixBehaviour.Client;
                if (client != null)
                {
                    DrawInfoField("Ready", client.IsReady ? "Yes" : "No");
                    DrawInfoField("Connection ID", client.ConnectionId ?? "N/A");
                }
            }
        }

        private static void DrawInfoField(string label, string value)
        {
            EditorGUILayout.BeginHorizontal();
            EditorGUILayout.LabelField(label, GUILayout.Width(150));
            EditorGUILayout.SelectableLabel(value, EditorStyles.label, GUILayout.Height(18));
            EditorGUILayout.EndHorizontal();
        }

        private static void DrawHorizontalLine()
        {
            var rect = EditorGUILayout.GetControlRect(false, 1);
            EditorGUI.DrawRect(rect, new Color(0.5f, 0.5f, 0.5f, 0.5f));
        }
    }
}
#endif
