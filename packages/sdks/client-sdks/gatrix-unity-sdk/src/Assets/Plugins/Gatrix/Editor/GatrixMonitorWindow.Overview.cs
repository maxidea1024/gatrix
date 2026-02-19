// GatrixMonitorWindow - Overview tab
// SDK summary, network activity, and streaming status

#if UNITY_EDITOR
using UnityEditor;
using UnityEngine;

namespace Gatrix.Unity.SDK.Editor
{
    public partial class GatrixMonitorWindow
    {
        // ==================== Overview ====================

        private void DrawOverview()
        {
            var client = GatrixBehaviour.Client;
            if (client == null) return;

            var stats = _cachedStats;

            // ── Quick Actions ──
            EditorGUILayout.Space(4);
            EditorGUILayout.BeginHorizontal();

            if (GUILayout.Button("Force Fetch", GUILayout.Height(26)))
            {
                _ = client.Features.FetchFlagsAsync();
            }
            if (GUILayout.Button("Open Inspector", GUILayout.Height(26)))
            {
                // Select the GatrixBehaviour in hierarchy
#if UNITY_2023_1_OR_NEWER
                var go = UnityEngine.Object.FindFirstObjectByType<GatrixBehaviour>();
#else
                var go = UnityEngine.Object.FindObjectOfType<GatrixBehaviour>();
#endif
                if (go != null)
                {
                    UnityEditor.Selection.activeGameObject = go.gameObject;
                    EditorGUIUtility.PingObject(go.gameObject);
                }
            }
            if (GUILayout.Button("Setup Wizard", GUILayout.Height(26)))
            {
                GatrixSetupWindow.ShowWindow();
            }

            EditorGUILayout.EndHorizontal();
            EditorGUILayout.Space(4);

            // ── SDK Summary ──
            GatrixEditorStyle.DrawSection("SDK Summary", "Core connectivity and status");
            GatrixEditorStyle.BeginBox();

            DrawField("SDK Version", $"{GatrixClient.SdkName} v{GatrixClient.SdkVersion}");
            DrawFieldWithCopy("Connection ID", client.ConnectionId ?? "N/A");
            DrawField("Ready", client.IsReady ? "<color=#88ff88>● Yes</color>" : "<color=#ff8888>● No</color>", true);

            if (stats != null)
            {
                var stateColor = stats.SdkState == SdkState.Healthy ? "#88ff88" :
                                 stats.SdkState == SdkState.Error ? "#ff8888" : "white";
                DrawField("State", $"<color={stateColor}>{stats.SdkState}</color>", true);
                DrawField("Offline Mode", client.Features.IsOfflineMode() ? "<color=#ffcc66>Yes</color>" : "No", true);
                DrawField("Explicit Sync", _cachedExplicitSync ? "Yes" : "No");
                DrawField("Total Flags", stats.TotalFlagCount.ToString());
                DrawField("ETag", stats.Etag ?? "none");
            }
            GatrixEditorStyle.EndBox();

            // ── Network Activity ──
            GatrixEditorStyle.DrawSection("Network Activity", "Communication metrics");
            GatrixEditorStyle.BeginBox();

            if (stats != null)
            {
                DrawField("Fetch Count", stats.FetchFlagsCount.ToString());
                DrawField("Update Count", stats.UpdateCount.ToString());
                DrawField("304 Not Modified", stats.NotModifiedCount.ToString());
                DrawField("Error Count", stats.ErrorCount > 0 ? $"<color=#ff8888>{stats.ErrorCount}</color>" : "0", true);
                DrawField("Recovery Count", stats.RecoveryCount.ToString());
                DrawField("Last Fetch", FormatTime(stats.LastFetchTime));
                DrawField("Last Update", FormatTime(stats.LastUpdateTime));
                if (stats.LastError != null)
                {
                    DrawField("Last Error", $"<color=#ff8888>{stats.LastError.Message}</color>", true);
                }
            }
            GatrixEditorStyle.EndBox();

            // ── Streaming ──
            GatrixEditorStyle.DrawSection("Streaming", "Real-time flag updates");
            GatrixEditorStyle.BeginBox();

            if (stats != null)
            {
                if (!stats.StreamingEnabled)
                {
                    DrawField("Status", "<color=gray>Not Enabled</color>", true);
                }
                else
                {
                    var stateColor = stats.StreamingState == StreamingConnectionState.Connected
                        ? "#88ff88"
                        : stats.StreamingState == StreamingConnectionState.Disconnected
                            ? "gray"
                            : stats.StreamingState == StreamingConnectionState.Degraded
                                ? "#ff8888"
                                : "yellow";
                    DrawField("Status", $"<color={stateColor}>● {stats.StreamingState}</color>", true);
                    DrawField("Transport", stats.StreamingTransport.ToString());
                    DrawField("Reconnections", stats.StreamingReconnectCount.ToString());
                    DrawField("Last Event", FormatTime(stats.LastStreamingEventTime));
                }
            }

            GatrixEditorStyle.EndBox();

            // ── Metrics ──
            GatrixEditorStyle.DrawSection("Metrics", "Impression and delivery");
            GatrixEditorStyle.BeginBox();

            if (stats != null)
            {
                DrawField("Metrics Sent", stats.MetricsSentCount.ToString());
                DrawField("Metrics Errors", stats.MetricsErrorCount.ToString());
                DrawField("Impressions", stats.ImpressionCount.ToString());
            }

            GatrixEditorStyle.EndBox();
        }
    }
}
#endif
