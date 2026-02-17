// GatrixBehaviourInspector - Custom inspector for GatrixBehaviour
// Shows SDK status and controls in the Inspector panel

#if UNITY_EDITOR
using UnityEditor;
using UnityEngine;

namespace Gatrix.Unity.SDK.Editor
{
    /// <summary>
    /// Custom inspector for GatrixBehaviour showing live SDK state.
    /// </summary>
    [CustomEditor(typeof(GatrixBehaviour))]
    public class GatrixBehaviourInspector : UnityEditor.Editor
    {
        private bool _showFlags;
        private bool _showContext;
        private bool _showStats;

        public override void OnInspectorGUI()
        {
            var headerStyle = new GUIStyle(EditorStyles.boldLabel) { fontSize = 14 };
            var statusStyle = new GUIStyle(EditorStyles.label) { richText = true };

            EditorGUILayout.LabelField("Gatrix SDK", headerStyle);
            EditorGUILayout.Space(4);

            var client = GatrixBehaviour.Client;

            if (client == null)
            {
                EditorGUILayout.HelpBox(
                    "SDK is not initialized. Call GatrixBehaviour.InitializeAsync(config) to start.",
                    MessageType.Info);
                return;
            }

            // Status
            var readyText = client.IsReady
                ? "<color=green><b>Ready</b></color>"
                : "<color=yellow><b>Not Ready</b></color>";
            EditorGUILayout.LabelField($"Status: {readyText}", statusStyle);
            EditorGUILayout.LabelField($"Connection: {client.ConnectionId ?? "N/A"}");

            EditorGUILayout.Space(4);

            // Buttons
            EditorGUILayout.BeginHorizontal();
            if (GUILayout.Button("Open Monitor"))
            {
                GatrixMonitorWindow.ShowWindow();
            }
            if (GUILayout.Button("Force Fetch"))
            {
                _ = client.Features.FetchFlagsAsync();
            }
            if (GUILayout.Button("Shutdown"))
            {
                GatrixBehaviour.Shutdown();
            }
            EditorGUILayout.EndHorizontal();

            EditorGUILayout.Space(8);

            // Flags foldout
            _showFlags = EditorGUILayout.Foldout(_showFlags, "Feature Flags", true);
            if (_showFlags)
            {
                EditorGUI.indentLevel++;
                var flags = client.Features.GetAllFlags();
                if (flags.Count == 0)
                {
                    EditorGUILayout.LabelField("No flags loaded");
                }
                else
                {
                    foreach (var flag in flags)
                    {
                        EditorGUILayout.BeginHorizontal();
                        var colorTag = flag.Enabled ? "green" : "red";
                        var state = flag.Enabled ? "ON" : "OFF";
                        EditorGUILayout.LabelField(
                            $"<color={colorTag}>[{state}]</color> {flag.Name}",
                            statusStyle, GUILayout.MinWidth(200));

                        if (flag.Variant != null)
                        {
                            var payloadStr = flag.Variant.Value?.ToString() ?? "";
                            if (payloadStr.Length > 30)
                                payloadStr = payloadStr.Substring(0, 27) + "...";
                            EditorGUILayout.LabelField(
                                $"{flag.Variant.Name}: {payloadStr}",
                                GUILayout.MinWidth(100));
                        }
                        EditorGUILayout.EndHorizontal();
                    }
                }
                EditorGUI.indentLevel--;
            }

            // Context foldout
            _showContext = EditorGUILayout.Foldout(_showContext, "Context", true);
            if (_showContext)
            {
                EditorGUI.indentLevel++;
                var ctx = client.Features.GetContext();
                EditorGUILayout.LabelField($"AppName: {ctx.AppName ?? "-"}");
                EditorGUILayout.LabelField($"Environment: {ctx.Environment ?? "-"}");
                EditorGUILayout.LabelField($"UserId: {ctx.UserId ?? "-"}");
                EditorGUILayout.LabelField($"SessionId: {ctx.SessionId ?? "-"}");
                if (ctx.Properties != null)
                {
                    foreach (var kvp in ctx.Properties)
                    {
                        EditorGUILayout.LabelField($"  {kvp.Key}: {kvp.Value}");
                    }
                }
                EditorGUI.indentLevel--;
            }

            // Stats foldout
            _showStats = EditorGUILayout.Foldout(_showStats, "Statistics", true);
            if (_showStats)
            {
                EditorGUI.indentLevel++;
                var stats = client.Features.GetStats();
                EditorGUILayout.LabelField($"State: {stats.SdkState}");
                EditorGUILayout.LabelField($"Total Flags: {stats.TotalFlagCount}");
                EditorGUILayout.LabelField($"Fetch Count: {stats.FetchFlagsCount}");
                EditorGUILayout.LabelField($"Updates: {stats.UpdateCount}");
                EditorGUILayout.LabelField($"304s: {stats.NotModifiedCount}");
                EditorGUILayout.LabelField($"Errors: {stats.ErrorCount}");
                EditorGUILayout.LabelField($"Impressions: {stats.ImpressionCount}");
                EditorGUI.indentLevel--;
            }

            // Auto-repaint in play mode
            if (EditorApplication.isPlaying)
            {
                Repaint();
            }
        }
    }
}
#endif
