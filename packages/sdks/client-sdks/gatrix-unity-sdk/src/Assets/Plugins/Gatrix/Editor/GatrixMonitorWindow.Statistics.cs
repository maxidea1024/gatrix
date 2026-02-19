// GatrixMonitorWindow - Statistics tab
// Detailed SDK statistics with timing, counters, flag access, variant hits, and event handlers

#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using UnityEditor;
using UnityEngine;

namespace Gatrix.Unity.SDK.Editor
{
    public partial class GatrixMonitorWindow
    {
        // ==================== Statistics ====================

        private void DrawStatistics()
        {
            EditorGUILayout.BeginHorizontal();
            EditorGUILayout.LabelField("SDK Statistics", _headerStyle);
            GUILayout.FlexibleSpace();
            _showAdvancedStats = EditorGUILayout.ToggleLeft("Advanced View", _showAdvancedStats, GUILayout.Width(110));
            EditorGUILayout.EndHorizontal();
            EditorGUILayout.Space(4);

            if (_cachedStats == null)
            {
                GatrixEditorStyle.DrawHelpBox("No statistics available.", MessageType.Info);
                return;
            }

            // Timing
            GatrixEditorStyle.DrawSection("Timing");
            GatrixEditorStyle.BeginBox();
            DrawField("Start Time", FormatTime(_cachedStats.StartTime));
            DrawField("Last Fetch", FormatTime(_cachedStats.LastFetchTime));
            DrawField("Last Update", FormatTime(_cachedStats.LastUpdateTime));
            if (_showAdvancedStats || _cachedStats.ErrorCount > 0)
            {
                DrawField("Last Error", FormatTime(_cachedStats.LastErrorTime));
                DrawField("Last Recovery", FormatTime(_cachedStats.LastRecoveryTime));
            }
            DrawField("Last Stream Event", FormatTime(_cachedStats.LastStreamingEventTime));
            GatrixEditorStyle.EndBox();

            // Counter Summary
            GatrixEditorStyle.DrawSection("Counters");
            GatrixEditorStyle.BeginBox();
            DrawField("Fetch Count", _cachedStats.FetchFlagsCount.ToString());
            DrawField("Updates (Changed)", _cachedStats.UpdateCount.ToString());
            DrawField("304 Not Modified", _cachedStats.NotModifiedCount.ToString());
            DrawField("Errors", _cachedStats.ErrorCount.ToString());

            if (_showAdvancedStats)
            {
                DrawField("Recoveries", _cachedStats.RecoveryCount.ToString());
                DrawField("Sync Count", _cachedStats.SyncFlagsCount.ToString());
                DrawField("Impression Count", _cachedStats.ImpressionCount.ToString());
                DrawField("Context Changes", _cachedStats.ContextChangeCount.ToString());
                DrawField("Metrics Sent", _cachedStats.MetricsSentCount.ToString());
                DrawField("Metrics Errors", _cachedStats.MetricsErrorCount.ToString());
                DrawField("ETag", _cachedStats.Etag ?? "-");
            }
            GatrixEditorStyle.EndBox();

            // Streaming Counters
            if (_cachedStats.StreamingEnabled)
            {
                GatrixEditorStyle.DrawSection("Streaming Counters");
                GatrixEditorStyle.BeginBox();
                DrawField("Events Received", _cachedStats.StreamingEventCount.ToString());
                DrawField("Reconnections", _cachedStats.StreamingReconnectCount.ToString());
                DrawField("Errors", _cachedStats.StreamingErrorCount > 0
                    ? $"<color=#ff8888>{_cachedStats.StreamingErrorCount}</color>"
                    : "0", true);
                DrawField("Recoveries", _cachedStats.StreamingRecoveryCount > 0
                    ? $"<color=#88ff88>{_cachedStats.StreamingRecoveryCount}</color>"
                    : "0", true);

                if (_showAdvancedStats)
                {
                    DrawField("Last Event", FormatTime(_cachedStats.LastStreamingEventTime));
                    if (_cachedStats.StreamingErrorCount > 0)
                    {
                        DrawField("Last Error", FormatTime(_cachedStats.LastStreamingErrorTime));
                        if (!string.IsNullOrEmpty(_cachedStats.LastStreamingError))
                        {
                            DrawField("Error Detail",
                                $"<color=#ff8888>{TruncateMiddle(_cachedStats.LastStreamingError, 50)}</color>", true);
                        }
                    }
                    if (_cachedStats.StreamingRecoveryCount > 0)
                    {
                        DrawField("Last Recovery", FormatTime(_cachedStats.LastStreamingRecoveryTime));
                    }
                }
                GatrixEditorStyle.EndBox();
            }

            // Flag access counts
            if (_cachedStats.FlagEnabledCounts != null && _cachedStats.FlagEnabledCounts.Count > 0)
            {
                GatrixEditorStyle.DrawSection("Flag Access Counts");
                GatrixEditorStyle.BeginBox();

                EditorGUILayout.BeginHorizontal(EditorStyles.toolbar);
                EditorGUILayout.LabelField("Flag", EditorStyles.miniLabel, GUILayout.MinWidth(150));
                EditorGUILayout.LabelField("Enabled", EditorStyles.miniLabel, GUILayout.Width(60));
                EditorGUILayout.LabelField("Disabled", EditorStyles.miniLabel, GUILayout.Width(60));
                if (_showAdvancedStats) EditorGUILayout.LabelField("Last Use", EditorStyles.miniLabel, GUILayout.Width(100));
                EditorGUILayout.EndHorizontal();

                foreach (var kvp in _cachedStats.FlagEnabledCounts)
                {
                    EditorGUILayout.BeginHorizontal();
                    EditorGUILayout.LabelField(kvp.Key, GUILayout.MinWidth(150));
                    EditorGUILayout.LabelField(kvp.Value.Yes.ToString(), GUILayout.Width(60));
                    EditorGUILayout.LabelField(kvp.Value.No.ToString(), GUILayout.Width(60));
                    if (_showAdvancedStats)
                    {
                        DateTime lastChanged;
                        string timeStr = "-";
                        if (_cachedStats.FlagLastChangedTimes.TryGetValue(kvp.Key, out lastChanged))
                            timeStr = FormatTime(lastChanged);
                        EditorGUILayout.LabelField(timeStr, GUILayout.Width(100));
                    }
                    EditorGUILayout.EndHorizontal();
                }
                GatrixEditorStyle.EndBox();
            }

            // Variant hit counts (Advanced only)
            if (_showAdvancedStats && _cachedStats.FlagVariantCounts != null && _cachedStats.FlagVariantCounts.Count > 0)
            {
                GatrixEditorStyle.DrawSection("Variant Hit Counts");
                GatrixEditorStyle.BeginBox();

                foreach (var flagKvp in _cachedStats.FlagVariantCounts)
                {
                    EditorGUILayout.LabelField($"  {flagKvp.Key}", EditorStyles.boldLabel);
                    foreach (var variantKvp in flagKvp.Value)
                    {
                        DrawField($"    {variantKvp.Key}", variantKvp.Value.ToString());
                    }
                }
                GatrixEditorStyle.EndBox();
            }

            // Missing flags
            if (_cachedStats.MissingFlags != null && _cachedStats.MissingFlags.Count > 0)
            {
                GatrixEditorStyle.DrawSection("Missing Flags");
                GatrixEditorStyle.BeginBox();

                foreach (var kvp in _cachedStats.MissingFlags)
                {
                    DrawField(kvp.Key, $"requested {kvp.Value} time(s)");
                }
                GatrixEditorStyle.EndBox();
            }

            // Event handler counts
            var client = GatrixBehaviour.Client;
            if (client != null)
            {
                var emitter = client.Events;
                var handlerStats = emitter.GetHandlerStats();
                var totalCount = 0;
                var listenerCounts = new Dictionary<string, int>();
                foreach (var kvp in handlerStats)
                {
                    listenerCounts[kvp.Key] = kvp.Value.Count;
                    totalCount += kvp.Value.Count;
                }

                GatrixEditorStyle.DrawSection($"Event Handlers (Total: {totalCount})");
                GatrixEditorStyle.BeginBox();

                if (listenerCounts.Count == 0)
                {
                    EditorGUILayout.LabelField("  No event listeners registered.");
                }
                else
                {
                    EditorGUILayout.BeginHorizontal(EditorStyles.toolbar);
                    EditorGUILayout.LabelField("Event", EditorStyles.miniLabel, GUILayout.MinWidth(200));
                    EditorGUILayout.LabelField("Handlers", EditorStyles.miniLabel, GUILayout.Width(60));
                    EditorGUILayout.EndHorizontal();

                    foreach (var kvp in listenerCounts)
                    {
                        EditorGUILayout.BeginHorizontal();
                        EditorGUILayout.LabelField(kvp.Key, GUILayout.MinWidth(200));

                        // Warn if handler count seems excessive (possible leak)
                        if (kvp.Value > 3)
                        {
                            EditorGUILayout.LabelField(
                                $"<color=#ff6666>{kvp.Value}</color>",
                                _statusLabelStyle, GUILayout.Width(60));
                        }
                        else
                        {
                            EditorGUILayout.LabelField(kvp.Value.ToString(), GUILayout.Width(60));
                        }

                        EditorGUILayout.EndHorizontal();
                    }
                }
                GatrixEditorStyle.EndBox();
            }
        }
    }
}
#endif
