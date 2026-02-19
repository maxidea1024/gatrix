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
            if (_tsFetchCount == null) return;

            // -- Time range slider --
            float maxOffset = MetricsRetentionSec - MetricsGraphTimeWindowSec;
            EditorGUILayout.BeginHorizontal();
            {
                bool isDark = EditorGUIUtility.isProSkin;
                var labelStyle = new GUIStyle(EditorStyles.miniLabel)
                {
                    normal = { textColor = isDark ? new Color(0.55f, 0.58f, 0.63f) : new Color(0.42f, 0.45f, 0.50f) }
                };

                // "Live" button to jump to current
                bool isLive = _metricsTimeOffset < 0.5f;
                var liveColor = GUI.backgroundColor;
                if (isLive) GUI.backgroundColor = new Color(0.3f, 0.8f, 0.4f, 0.6f);
                if (GUILayout.Button(isLive ? "\u25cf Live" : "\u25b6 Live", GUILayout.Width(52), GUILayout.Height(16)))
                {
                    _metricsTimeOffset = 0f;
                }
                GUI.backgroundColor = liveColor;

                // Slider
                GUILayout.Label($"-{MetricsRetentionSec:F0}s", labelStyle, GUILayout.Width(32));
                _metricsTimeOffset = GUILayout.HorizontalSlider(_metricsTimeOffset, maxOffset, 0f);
                GUILayout.Label("now", labelStyle, GUILayout.Width(22));

                // Current range indicator
                if (_metricsTimeOffset > 0.5f)
                {
                    float viewEnd = _metricsTimeOffset;
                    float viewStart = _metricsTimeOffset + MetricsGraphTimeWindowSec;
                    var rangeStyle = new GUIStyle(EditorStyles.miniLabel)
                    {
                        fontStyle = FontStyle.Bold,
                        normal = { textColor = isDark ? new Color(0.75f, 0.65f, 0.40f) : new Color(0.55f, 0.45f, 0.20f) }
                    };
                    GUILayout.Label($"-{viewStart:F0}s ~ -{viewEnd:F0}s", rangeStyle, GUILayout.Width(90));
                }
            }
            EditorGUILayout.EndHorizontal();
            EditorGUILayout.Space(2);

            // Network Activity graph (Fetches, Updates, Errors)
            GatrixEditorStyle.DrawSection("Network Activity", $"Window {MetricsGraphTimeWindowSec:F0}s \u00b7 Interval {MetricsCollectIntervalSec:F0}s \u00b7 Retained {MetricsRetentionSec:F0}s");
            var networkTracks = new List<TimeSeriesTrack> { _tsFetchCount, _tsUpdateCount, _tsErrorCount };
            TimeSeriesGraphRenderer.DrawGraph(networkTracks,
                chartHeight: 100f, timeWindowSec: MetricsGraphTimeWindowSec, timeOffset: _metricsTimeOffset);
            EditorGUILayout.Space(4);

            // Impressions & Metrics graph
            GatrixEditorStyle.DrawSection("Impressions & Metrics Delivery");
            var impressionTracks = new List<TimeSeriesTrack> { _tsImpressionCount, _tsMetricsSentCount };
            TimeSeriesGraphRenderer.DrawGraph(impressionTracks,
                chartHeight: 100f, timeWindowSec: MetricsGraphTimeWindowSec, timeOffset: _metricsTimeOffset);
            EditorGUILayout.Space(4);

            // Reconnect graph (shown only if there have been reconnects)
            if (_tsStreamReconnectCount != null && _tsStreamReconnectCount.GetLatest() > 0)
            {
                GatrixEditorStyle.DrawSection("Stream Reconnections");
                var reconnectTracks = new List<TimeSeriesTrack> { _tsStreamReconnectCount };
                TimeSeriesGraphRenderer.DrawGraph(reconnectTracks,
                    chartHeight: 70f, timeWindowSec: MetricsGraphTimeWindowSec, timeOffset: _metricsTimeOffset);
                EditorGUILayout.Space(4);
            }

            // Flag state timelines
            if (_flagTimelines != null && _flagTimelines.Count > 0)
            {
                GatrixEditorStyle.DrawSection("Flag State Timeline", $"{_flagTimelines.Count} flags tracked");
                FlagTimelineRenderer.DrawTimelines(_flagTimelines, MetricsGraphTimeWindowSec, _metricsTimeOffset);
                EditorGUILayout.Space(4);
            }

            // Compact current values summary
            DrawMetricsCurrentValues();
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
            GatrixEditorStyle.BeginBox();

            EditorGUILayout.BeginHorizontal();
            DrawCompactMetric("Fetches", stats.FetchFlagsCount, new Color(0.40f, 0.70f, 1.00f));
            DrawCompactMetric("Updates", stats.UpdateCount, new Color(0.40f, 1.00f, 0.50f));
            DrawCompactMetric("Errors", stats.ErrorCount, new Color(1.00f, 0.40f, 0.40f));
            DrawCompactMetric("Impressions", stats.ImpressionCount, new Color(1.00f, 0.80f, 0.30f));
            DrawCompactMetric("Sent", stats.MetricsSentCount, new Color(0.70f, 0.50f, 1.00f));
            EditorGUILayout.EndHorizontal();

            GatrixEditorStyle.EndBox();
        }

        private static void DrawCompactMetric(string label, int value, Color color)
        {
            EditorGUILayout.BeginVertical(GUILayout.MinWidth(60));
            var valueStyle = new GUIStyle(EditorStyles.boldLabel)
            {
                alignment = TextAnchor.MiddleCenter,
                fontSize = 14,
                normal = { textColor = color }
            };
            var labelStyle = new GUIStyle(EditorStyles.centeredGreyMiniLabel);
            EditorGUILayout.LabelField(value.ToString(), valueStyle, GUILayout.Height(22));
            EditorGUILayout.LabelField(label, labelStyle, GUILayout.Height(14));
            EditorGUILayout.EndVertical();
        }
    }
}
#endif
