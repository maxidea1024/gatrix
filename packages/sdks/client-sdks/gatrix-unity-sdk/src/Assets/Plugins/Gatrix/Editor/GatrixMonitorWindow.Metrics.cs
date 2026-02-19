// GatrixMonitorWindow - Metrics tab
// Dual view: Time-series graphs (Graph mode) and tabular report (Report mode)
// Streaming connection, impression metrics, delivery stats, and flag access summary

#if UNITY_EDITOR
using System.Collections.Generic;
using UnityEditor;
using UnityEngine;

namespace Gatrix.Unity.SDK.Editor
{
    public partial class GatrixMonitorWindow
    {
        // ==================== Metrics ====================

        private void DrawMetricsTab()
        {
            // Header with view mode toggle
            EditorGUILayout.BeginHorizontal();
            EditorGUILayout.LabelField("Metrics & Streaming", _headerStyle, GUILayout.ExpandWidth(true));

            var graphActive = _metricsViewMode == MetricsViewMode.Graph;
            var graphStyle = graphActive
                ? new GUIStyle(EditorStyles.miniButtonLeft) { fontStyle = FontStyle.Bold, normal = { textColor = new Color(0.4f, 0.7f, 1f) } }
                : EditorStyles.miniButtonLeft;
            var reportStyle = !graphActive
                ? new GUIStyle(EditorStyles.miniButtonRight) { fontStyle = FontStyle.Bold, normal = { textColor = new Color(0.4f, 0.7f, 1f) } }
                : EditorStyles.miniButtonRight;

            if (GUILayout.Button("Graph", graphStyle, GUILayout.Width(55)))
                _metricsViewMode = MetricsViewMode.Graph;
            if (GUILayout.Button("Report", reportStyle, GUILayout.Width(55)))
                _metricsViewMode = MetricsViewMode.Report;

            EditorGUILayout.EndHorizontal();
            EditorGUILayout.Space(4);

            var client = GatrixBehaviour.Client;
            if (client == null || _cachedStats == null)
            {
                GatrixEditorStyle.DrawHelpBox("No metrics data available.", MessageType.Info);
                return;
            }

            // Always show streaming connection status at top
            DrawStreamingStatus();

            if (_metricsViewMode == MetricsViewMode.Graph)
            {
                DrawMetricsGraphView();
            }
            else
            {
                DrawMetricsReportView();
            }
        }

        // ── Streaming Connection (shared between both views) ──

        private void DrawStreamingStatus()
        {
            var stats = _cachedStats;

            GatrixEditorStyle.DrawSection("Streaming Connection", "Real-time flag update channel");
            GatrixEditorStyle.BeginBox();

            var stateColor = stats.StreamingState == StreamingConnectionState.Connected
                ? "#88ff88"
                : stats.StreamingState == StreamingConnectionState.Disconnected
                    ? "gray"
                    : stats.StreamingState == StreamingConnectionState.Degraded
                        ? "#ff8888"
                        : "yellow";
            DrawField("State", $"<color={stateColor}>● {stats.StreamingState}</color>", true);
            DrawField("Transport", stats.StreamingTransport.ToString());
            DrawField("Reconnect Attempts", stats.StreamingReconnectCount.ToString());
            DrawField("Last Stream Event", FormatTime(stats.LastStreamingEventTime));

            GatrixEditorStyle.EndBox();
        }

        // ── Graph View ──

        private void DrawMetricsGraphView()
        {
            InitTimeSeries();

            // Guard against null tracks (domain reload edge case)
            if (_tsFetchDelta == null) return;

            // -- Controls: Live button + time offset slider --
            float maxOffset = MetricsRetentionSec - 30f; // at least 30s visible
            EditorGUILayout.BeginHorizontal();
            {
                bool isDark = EditorGUIUtility.isProSkin;
                var labelStyle = new GUIStyle(EditorStyles.miniLabel)
                {
                    normal = { textColor = isDark ? new Color(0.55f, 0.58f, 0.63f) : new Color(0.42f, 0.45f, 0.50f) }
                };

                // "Live" button
                bool isLive = _metricsTimeOffset < 0.5f;
                var liveColor = GUI.backgroundColor;
                if (isLive) GUI.backgroundColor = new Color(0.3f, 0.8f, 0.4f, 0.6f);
                if (GUILayout.Button(isLive ? "\u25cf Live" : "\u25b6 Live", GUILayout.Width(52), GUILayout.Height(16)))
                {
                    _metricsTimeOffset = 0f;
                }
                GUI.backgroundColor = liveColor;

                // Time offset slider (scroll history)
                GUILayout.Label($"-{MetricsRetentionSec:F0}s", labelStyle, GUILayout.Width(32));
                _metricsTimeOffset = GUILayout.HorizontalSlider(_metricsTimeOffset, maxOffset, 0f);
                GUILayout.Label("now", labelStyle, GUILayout.Width(22));
            }
            EditorGUILayout.EndHorizontal();
            EditorGUILayout.Space(2);

            // Graphs: pixelsPerSec=3 → chart width determines visible time range
            const float pps = 3f;

            // Network Activity graph
            GatrixEditorStyle.DrawSection("Network Activity", "Events per second");
            var networkTracks = new List<TimeSeriesTrack> { _tsFetchDelta, _tsUpdateDelta, _tsErrorDelta };
            TimeSeriesGraphRenderer.DrawGraph(networkTracks,
                chartHeight: 60f, pixelsPerSec: pps, timeOffset: _metricsTimeOffset);
            EditorGUILayout.Space(4);

            // Impressions & Metrics graph
            GatrixEditorStyle.DrawSection("Impressions & Metrics Delivery", "Events per second");
            var impressionTracks = new List<TimeSeriesTrack> { _tsImpressionDelta, _tsMetricsSentDelta };
            TimeSeriesGraphRenderer.DrawGraph(impressionTracks,
                chartHeight: 60f, pixelsPerSec: pps, timeOffset: _metricsTimeOffset);
            EditorGUILayout.Space(4);

            // Reconnect graph (shown only if there have been reconnects)
            if (_tsStreamReconnectDelta != null && HasAnyActivity(_tsStreamReconnectDelta))
            {
                GatrixEditorStyle.DrawSection("Stream Reconnections");
                var reconnectTracks = new List<TimeSeriesTrack> { _tsStreamReconnectDelta };
                TimeSeriesGraphRenderer.DrawGraph(reconnectTracks,
                    chartHeight: 50f, pixelsPerSec: pps, timeOffset: _metricsTimeOffset);
                EditorGUILayout.Space(4);
            }

            // Flag state counts graph — how many flags are enabled/disabled/missing
            if (_tsFlagEnabled != null)
            {
                GatrixEditorStyle.DrawSection("Flag State Counts", "Number of flags per state");
                var flagStateTracks = new List<TimeSeriesTrack> { _tsFlagEnabled, _tsFlagDisabled, _tsFlagMissing };
                TimeSeriesGraphRenderer.DrawGraph(flagStateTracks,
                    chartHeight: 60f, pixelsPerSec: pps, timeOffset: _metricsTimeOffset);
                EditorGUILayout.Space(4);
            }

            // Compact current values summary
            DrawMetricsCurrentValues();
        }

        /// <summary>Check if a delta track has any non-zero value (indicating past activity)</summary>
        private static bool HasAnyActivity(TimeSeriesTrack track)
        {
            for (int i = 0; i < track.Points.Count; i++)
            {
                if (track.Points[i].Value > 0) return true;
            }
            return false;
        }

        // ── Report View ──

        private void DrawMetricsReportView()
        {
            var stats = _cachedStats;

            // ── Impression Metrics ──
            GatrixEditorStyle.DrawSection("Impression Metrics", "Flag evaluation tracking");
            GatrixEditorStyle.BeginBox();

            DrawField("Total Impressions", stats.ImpressionCount.ToString());
            DrawField("Context Changes", stats.ContextChangeCount.ToString());

            GatrixEditorStyle.EndBox();

            // ── Metrics Delivery ──
            GatrixEditorStyle.DrawSection("Metrics Delivery", "Backend reporting");
            GatrixEditorStyle.BeginBox();

            DrawField("Metrics Sent", stats.MetricsSentCount.ToString());
            var metricsErrColor = stats.MetricsErrorCount > 0 ? "#ff8888" : "white";
            DrawField("Metrics Errors",
                $"<color={metricsErrColor}>{stats.MetricsErrorCount}</color>", true);

            GatrixEditorStyle.EndBox();

            // ── Network Activity ──
            GatrixEditorStyle.DrawSection("Network Activity", "Fetch and update counters");
            GatrixEditorStyle.BeginBox();

            DrawField("Fetch Count", stats.FetchFlagsCount.ToString());
            DrawField("Update Count", stats.UpdateCount.ToString());
            DrawField("304 Not Modified", stats.NotModifiedCount.ToString());
            DrawField("Error Count", stats.ErrorCount > 0 ? $"<color=#ff8888>{stats.ErrorCount}</color>" : "0", true);
            DrawField("Recovery Count", stats.RecoveryCount.ToString());

            GatrixEditorStyle.EndBox();

            // ── Flag Access Summary ──
            if (stats.FlagEnabledCounts != null && stats.FlagEnabledCounts.Count > 0)
            {
                GatrixEditorStyle.DrawSection($"Flag Access Summary ({stats.FlagEnabledCounts.Count} flags)", "Evaluation hit counts");
                GatrixEditorStyle.BeginBox();

                EditorGUILayout.BeginHorizontal(EditorStyles.toolbar);
                EditorGUILayout.LabelField("Flag", EditorStyles.miniLabel, GUILayout.MinWidth(150));
                EditorGUILayout.LabelField("Enabled", EditorStyles.miniLabel, GUILayout.Width(60));
                EditorGUILayout.LabelField("Disabled", EditorStyles.miniLabel, GUILayout.Width(60));
                EditorGUILayout.LabelField("Total", EditorStyles.miniLabel, GUILayout.Width(60));
                EditorGUILayout.EndHorizontal();

                foreach (var kvp in stats.FlagEnabledCounts)
                {
                    EditorGUILayout.BeginHorizontal();
                    EditorGUILayout.LabelField(kvp.Key, GUILayout.MinWidth(150));
                    EditorGUILayout.LabelField(kvp.Value.Yes.ToString(), GUILayout.Width(60));
                    EditorGUILayout.LabelField(kvp.Value.No.ToString(), GUILayout.Width(60));
                    EditorGUILayout.LabelField((kvp.Value.Yes + kvp.Value.No).ToString(), GUILayout.Width(60));
                    EditorGUILayout.EndHorizontal();
                }

                GatrixEditorStyle.EndBox();
            }

            // ── Missing Flags ──
            if (stats.MissingFlags != null && stats.MissingFlags.Count > 0)
            {
                GatrixEditorStyle.DrawSection($"Missing Flags ({stats.MissingFlags.Count})", "Requested but not found on server");
                GatrixEditorStyle.BeginBox();

                foreach (var kvp in stats.MissingFlags)
                {
                    DrawField(kvp.Key, $"<color=#ffcc66>{kvp.Value} request(s)</color>", true);
                }
                GatrixEditorStyle.EndBox();
            }
        }

        // ── Current Values Summary (compact, used below graphs) ──

        private void DrawMetricsCurrentValues()
        {
            var stats = _cachedStats;

            GatrixEditorStyle.DrawSection("Current Values");

            bool isDark = EditorGUIUtility.isProSkin;
            var valueStyle = new GUIStyle(EditorStyles.boldLabel)
            {
                alignment = TextAnchor.MiddleCenter,
                fontSize = 13
            };
            var labelStyle = new GUIStyle(EditorStyles.centeredGreyMiniLabel)
            {
                fontSize = 9
            };
            var sepStyle = new GUIStyle(EditorStyles.miniLabel)
            {
                normal = { textColor = isDark ? new Color(0.30f, 0.30f, 0.33f) : new Color(0.70f, 0.70f, 0.73f) },
                alignment = TextAnchor.MiddleCenter
            };

            GatrixEditorStyle.BeginBox();
            EditorGUILayout.BeginHorizontal();
            GUILayout.FlexibleSpace();
            DrawMetricItem(valueStyle, labelStyle, "Fetches", stats.FetchFlagsCount, new Color(0.40f, 0.70f, 1.00f));
            GUILayout.Label("|", sepStyle, GUILayout.Width(8), GUILayout.Height(30));
            DrawMetricItem(valueStyle, labelStyle, "Updates", stats.UpdateCount, new Color(0.40f, 1.00f, 0.50f));
            GUILayout.Label("|", sepStyle, GUILayout.Width(8), GUILayout.Height(30));
            DrawMetricItem(valueStyle, labelStyle, "Errors", stats.ErrorCount, new Color(1.00f, 0.40f, 0.40f));
            GUILayout.Label("|", sepStyle, GUILayout.Width(8), GUILayout.Height(30));
            DrawMetricItem(valueStyle, labelStyle, "Impressions", stats.ImpressionCount, new Color(1.00f, 0.80f, 0.30f));
            GUILayout.Label("|", sepStyle, GUILayout.Width(8), GUILayout.Height(30));
            DrawMetricItem(valueStyle, labelStyle, "Metrics Sent", stats.MetricsSentCount, new Color(0.70f, 0.50f, 1.00f));
            GUILayout.FlexibleSpace();
            EditorGUILayout.EndHorizontal();
            GatrixEditorStyle.EndBox();
        }

        private static void DrawMetricItem(GUIStyle valueStyle, GUIStyle labelStyle,
            string label, int value, Color color)
        {
            float w = Mathf.Max(labelStyle.CalcSize(new GUIContent(label)).x + 8, 40f);
            valueStyle.normal.textColor = color;

            EditorGUILayout.BeginVertical(GUILayout.Width(w));
            GUILayout.Label(value.ToString(), valueStyle, GUILayout.Height(18));
            GUILayout.Label(label, labelStyle, GUILayout.Height(12));
            EditorGUILayout.EndVertical();
        }
    }
}
#endif
