// GatrixMonitorWindow - Unity Editor monitoring window
// Provides real-time SDK state, flags, events, and statistics monitoring

#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using UnityEditor;
using UnityEngine;

namespace Gatrix.Unity.SDK.Editor
{
    /// <summary>
    /// Editor window for monitoring Gatrix SDK state in real-time.
    /// Menu: Window > Gatrix > Monitor
    /// </summary>
    public class GatrixMonitorWindow : EditorWindow
    {
        private enum Tab
        {
            Overview,
            Flags,
            Events,
            Context,
            Statistics
        }

        private Tab _currentTab = Tab.Overview;
        private Vector2 _scrollPosition;
        private Vector2 _eventLogScroll;
        private string _flagSearchFilter = "";
        private bool _showAdvancedStats = false;
        private bool _autoRefresh = true;
        private float _lastRefreshTime;
        private const float RefreshInterval = 1.0f;

        // Event log
        private readonly List<EventLogEntry> _eventLog = new List<EventLogEntry>();
        private const int MaxEventLogEntries = 200;
        private GatrixAnyEventHandler _eventListener;
        private bool _isListening;

        // Cached data
        private FeaturesStats _cachedStats;
        private List<EvaluatedFlag> _cachedFlags;
        private List<EvaluatedFlag> _cachedRealtimeFlags;
        private GatrixContext _cachedContext;
        private bool _cachedExplicitSync;
        private bool _cachedPendingSync;

        // Flag change tracking
        private Dictionary<string, FlagSnapshot> _previousFlagStates = new Dictionary<string, FlagSnapshot>();
        private Dictionary<string, float> _changedFlagTimes = new Dictionary<string, float>();
        private const float HighlightDuration = 3.0f;

        // Styles
        private GUIStyle _headerStyle;
        private GUIStyle _subHeaderStyle;
        private GUIStyle _statusLabelStyle;
        private GUIStyle _eventBoxStyle;
        private GUIStyle _flagNameStyle;
        private GUIStyle _sectionBoxStyle;
        private bool _stylesInitialized;

        [MenuItem("Window/Gatrix/Monitor", priority = 40)]
        public static void ShowWindow()
        {
            var window = GetWindow<GatrixMonitorWindow>("Gatrix Monitor");
            window.minSize = new Vector2(450, 350);
        }

        /// <summary>Force immediate data refresh and repaint (called externally after sync)</summary>
        public void ForceRefresh()
        {
            RefreshData();
            Repaint();
        }

        private void OnEnable()
        {
            StartListening();
            EditorApplication.update += OnEditorUpdate;
        }

        private void OnDisable()
        {
            StopListening();
            EditorApplication.update -= OnEditorUpdate;
        }

        private void OnEditorUpdate()
        {
            // Auto-start listening when SDK becomes available
            if (!_isListening && GatrixBehaviour.IsInitialized)
            {
                StartListening();
            }

            if (_autoRefresh && Time.realtimeSinceStartup - _lastRefreshTime > RefreshInterval)
            {
                _lastRefreshTime = Time.realtimeSinceStartup;
                RefreshData();
                Repaint();
            }
            // Repaint more frequently while highlights are fading
            else if (_changedFlagTimes.Count > 0)
            {
                Repaint();
            }
        }

        private void InitStyles()
        {
            if (_stylesInitialized) return;
            _stylesInitialized = true;

            _headerStyle = new GUIStyle(EditorStyles.boldLabel)
            {
                fontSize = 14,
                margin = new RectOffset(0, 0, 8, 4)
            };

            _subHeaderStyle = new GUIStyle(EditorStyles.boldLabel)
            {
                fontSize = 12,
                margin = new RectOffset(0, 0, 4, 2)
            };

            _statusLabelStyle = new GUIStyle(EditorStyles.label)
            {
                richText = true
            };

            _eventBoxStyle = new GUIStyle(EditorStyles.helpBox)
            {
                fontSize = 10,
                richText = true,
                padding = new RectOffset(4, 4, 2, 2),
                margin = new RectOffset(0, 0, 1, 1)
            };

            _flagNameStyle = new GUIStyle(EditorStyles.label)
            {
                fontStyle = FontStyle.Bold
            };

            _sectionBoxStyle = new GUIStyle(EditorStyles.helpBox)
            {
                padding = new RectOffset(6, 6, 4, 4),
                margin = new RectOffset(0, 0, 2, 4)
            };
        }

        private void OnGUI()
        {
            InitStyles();
            DrawToolbar();

            _scrollPosition = EditorGUILayout.BeginScrollView(_scrollPosition);

            if (!GatrixBehaviour.IsInitialized)
            {
                EditorGUILayout.HelpBox("Gatrix SDK is not initialized. Please call GatrixBehaviour.InitializeAsync() or add a GatrixBehaviour to your scene.", MessageType.Warning);
                EditorGUILayout.Space(2);
            }

            switch (_currentTab)
            {
                case Tab.Overview: DrawOverview(); break;
                case Tab.Flags: DrawFlags(); break;
                case Tab.Events: DrawEventsTab(); break;
                case Tab.Context: DrawContextTab(); break;
                case Tab.Statistics: DrawStatistics(); break;
            }

            EditorGUILayout.EndScrollView();
        }

        // ==================== Toolbar ====================

        private void DrawToolbar()
        {
            EditorGUILayout.BeginHorizontal(EditorStyles.toolbar);

            var tabNames = new[] { "Overview", "Flags", "Events", "Context", "Statistics" };
            for (int i = 0; i < tabNames.Length; i++)
            {
                var isActive = (int)_currentTab == i;
                if (GUILayout.Toggle(isActive, tabNames[i], EditorStyles.toolbarButton))
                {
                    _currentTab = (Tab)i;
                }
            }

            GUILayout.FlexibleSpace();

            _autoRefresh = GUILayout.Toggle(_autoRefresh, "Auto", EditorStyles.toolbarButton);

            if (GUILayout.Button("Refresh", EditorStyles.toolbarButton))
            {
                RefreshData();
            }

            EditorGUILayout.EndHorizontal();
        }

        // ==================== Not Initialized ====================

        private void DrawNotInitialized()
        {
            EditorGUILayout.Space(40);
            EditorGUILayout.BeginHorizontal();
            GUILayout.FlexibleSpace();

            EditorGUILayout.BeginVertical(GUILayout.MaxWidth(350));
            EditorGUILayout.LabelField("Gatrix SDK Not Running", _headerStyle);
            EditorGUILayout.Space(8);
            EditorGUILayout.HelpBox(
                "The Gatrix SDK is not currently initialized.\n\n" +
                "Initialize using:\n" +
                "  await GatrixBehaviour.InitializeAsync(config);\n\n" +
                "Or add a GatrixBehaviour to a GameObject and call StartAsync().",
                MessageType.Info);
            EditorGUILayout.EndVertical();

            GUILayout.FlexibleSpace();
            EditorGUILayout.EndHorizontal();
        }

        // ==================== Overview ====================

        private void DrawOverview()
        {
            var client = GatrixBehaviour.Client;
            if (client == null) return;

            EditorGUILayout.LabelField("SDK Overview", _headerStyle);
            EditorGUILayout.Space(4);

            // Status
            var stats = _cachedStats;
            DrawField("SDK Version", $"{GatrixClient.SdkName} v{GatrixClient.SdkVersion}");
            DrawField("Connection ID", client.ConnectionId ?? "N/A");
            DrawField("Ready", client.IsReady ? "<color=green>Yes</color>" : "<color=red>No</color>", true);

            if (stats != null)
            {
                DrawField("State",
                    stats.SdkState == SdkState.Healthy
                        ? "<color=green>Healthy</color>"
                        : stats.SdkState == SdkState.Error
                            ? "<color=red>Error</color>"
                            : stats.SdkState.ToString(), true);
                DrawField("Offline Mode", client.Features.IsOfflineMode() ? "Yes" : "No");
                DrawField("Total Flags", stats.TotalFlagCount.ToString());
                DrawField("ETag", stats.Etag ?? "none");
            }

            EditorGUILayout.Space(8);
            EditorGUILayout.LabelField("Network", _subHeaderStyle);

            if (stats != null)
            {
                DrawField("Fetch Count", stats.FetchFlagsCount.ToString());
                DrawField("Update Count", stats.UpdateCount.ToString());
                DrawField("304 Not Modified", stats.NotModifiedCount.ToString());
                DrawField("Error Count", stats.ErrorCount.ToString());
                DrawField("Recovery Count", stats.RecoveryCount.ToString());
                DrawField("Last Fetch", FormatTime(stats.LastFetchTime));
                DrawField("Last Update", FormatTime(stats.LastUpdateTime));
                if (stats.LastError != null)
                {
                    DrawField("Last Error", stats.LastError.Message);
                }
            }

            EditorGUILayout.Space(8);
            EditorGUILayout.LabelField("Metrics", _subHeaderStyle);

            if (stats != null)
            {
                DrawField("Metrics Sent", stats.MetricsSentCount.ToString());
                DrawField("Metrics Errors", stats.MetricsErrorCount.ToString());
                DrawField("Impressions", stats.ImpressionCount.ToString());
                DrawField("Context Changes", stats.ContextChangeCount.ToString());
            }

            EditorGUILayout.Space(8);
            EditorGUILayout.LabelField("Streaming (SSE)", _subHeaderStyle);

            if (stats != null)
            {
                var stateColor = stats.StreamingState == StreamingConnectionState.Connected
                    ? "green"
                    : stats.StreamingState == StreamingConnectionState.Disconnected
                        ? "gray"
                        : stats.StreamingState == StreamingConnectionState.Degraded
                            ? "red"
                            : "yellow";
                DrawField("State",
                    $"<color={stateColor}>{stats.StreamingState}</color>", true);
                DrawField("Reconnections", stats.StreamingReconnectCount.ToString());
                DrawField("Last Event", FormatTime(stats.LastStreamingEventTime));
            }
        }

        // ==================== Flags ====================

        private void DrawFlags()
        {
            EditorGUILayout.BeginHorizontal();
            EditorGUILayout.LabelField("Feature Flags", _headerStyle, GUILayout.ExpandWidth(true));

            if (_cachedFlags != null)
            {
                EditorGUILayout.LabelField(
                    $"({_cachedFlags.Count} flags)",
                    GUILayout.Width(80));
            }
            EditorGUILayout.EndHorizontal();

            // Search
            EditorGUILayout.BeginHorizontal();
            EditorGUILayout.LabelField("Search:", GUILayout.Width(50));
            _flagSearchFilter = EditorGUILayout.TextField(_flagSearchFilter);
            if (GUILayout.Button("Clear", GUILayout.Width(50)))
            {
                _flagSearchFilter = "";
            }
            EditorGUILayout.EndHorizontal();

            EditorGUILayout.Space(4);

            if (_cachedFlags == null || _cachedFlags.Count == 0)
            {
                EditorGUILayout.HelpBox("No flags loaded yet.", MessageType.Info);
                return;
            }

            var filter = _flagSearchFilter?.ToLowerInvariant() ?? "";

            // Explicit sync mode: show two sections
            if (_cachedExplicitSync)
            {
                DrawExplicitSyncView(filter);
            }
            else
            {
                DrawFlagTable(_cachedFlags, filter);
            }
        }

        private void DrawExplicitSyncView(string filter)
        {
            // Sync control bar
            EditorGUILayout.BeginHorizontal();
            EditorGUILayout.LabelField(
                _cachedPendingSync
                    ? "<color=#ffcc66>● Pending changes available</color>"
                    : "<color=#88cc88>● Synchronized</color>",
                _statusLabelStyle, GUILayout.ExpandWidth(true));

            GUI.enabled = _cachedPendingSync;
            if (GUILayout.Button("Sync Flags", GUILayout.Width(90)))
            {
                var client = GatrixBehaviour.Client;
                if (client != null)
                {
                    _ = client.Features.SyncFlagsAsync(false);
                    RefreshData();
                }
            }
            GUI.enabled = true;
            EditorGUILayout.EndHorizontal();

            EditorGUILayout.Space(4);

            // Synchronized flags section
            EditorGUILayout.LabelField("Synchronized Flags (Active)", _subHeaderStyle);
            EditorGUILayout.BeginVertical(_sectionBoxStyle);
            DrawFlagTable(_cachedFlags, filter);
            EditorGUILayout.EndVertical();

            // Realtime flags section (pending)
            if (_cachedRealtimeFlags != null && _cachedPendingSync)
            {
                // Horizontal divider
                EditorGUILayout.Space(4);
                var dividerRect = GUILayoutUtility.GetRect(1, 1, GUILayout.ExpandWidth(true));
                EditorGUI.DrawRect(dividerRect, new Color(0.4f, 0.4f, 0.4f, 0.6f));
                EditorGUILayout.Space(4);

                EditorGUILayout.LabelField("Realtime Flags (Pending)", _subHeaderStyle);
                EditorGUILayout.BeginVertical(_sectionBoxStyle);
                DrawFlagTable(_cachedRealtimeFlags, filter);
                EditorGUILayout.EndVertical();
            }
        }

        private void DrawFlagTable(List<EvaluatedFlag> flags, string filter)
        {
            // Table header
            EditorGUILayout.BeginHorizontal(EditorStyles.toolbar);
            EditorGUILayout.LabelField("Flag Name", EditorStyles.miniLabel, GUILayout.MinWidth(120));
            EditorGUILayout.LabelField("ON", EditorStyles.miniLabel, GUILayout.Width(30));
            EditorGUILayout.LabelField("Variant", EditorStyles.miniLabel, GUILayout.Width(90));
            EditorGUILayout.LabelField("Type", EditorStyles.miniLabel, GUILayout.Width(50));
            EditorGUILayout.LabelField("Value", EditorStyles.miniLabel, GUILayout.MinWidth(80));
            EditorGUILayout.LabelField("Reason", EditorStyles.miniLabel, GUILayout.Width(80));
            EditorGUILayout.LabelField("Revision", EditorStyles.miniLabel, GUILayout.Width(50));
            EditorGUILayout.EndHorizontal();

            int visibleIndex = 0;
            for (int i = 0; i < flags.Count; i++)
            {
                var flag = flags[i];
                if (!string.IsNullOrEmpty(filter) &&
                    !flag.Name.ToLowerInvariant().Contains(filter))
                {
                    continue;
                }

                DrawFlagRow(flag, visibleIndex);
                visibleIndex++;
            }
        }

        private void DrawFlagRow(EvaluatedFlag flag, int index)
        {
            // Check if this flag was recently changed
            bool isChanged = _changedFlagTimes.TryGetValue(flag.Name, out float changeTime);
            float elapsed = isChanged ? (float)EditorApplication.timeSinceStartup - changeTime : HighlightDuration;
            bool showHighlight = isChanged && elapsed < HighlightDuration;

            Color bgColor;
            if (showHighlight)
            {
                float alpha = Mathf.Lerp(0.35f, 0f, elapsed / HighlightDuration);
                bgColor = new Color(1f, 0.85f, 0f, alpha);
            }
            else
            {
                bgColor = index % 2 == 0
                    ? new Color(0.22f, 0.22f, 0.22f, 0.3f)
                    : Color.clear;
            }

            var rect = EditorGUILayout.BeginHorizontal();
            if (bgColor != Color.clear)
            {
                EditorGUI.DrawRect(rect, bgColor);
            }

            // Flag name
            EditorGUILayout.LabelField(flag.Name, _flagNameStyle, GUILayout.MinWidth(120));

            // Enabled
            var enabledColor = flag.Enabled ? "green" : "red";
            var enabledText = flag.Enabled ? "ON" : "OFF";
            EditorGUILayout.LabelField(
                $"<color={enabledColor}>{enabledText}</color>",
                _statusLabelStyle, GUILayout.Width(30));

            // Variant name
            EditorGUILayout.LabelField(
                flag.Variant?.Name ?? "-", GUILayout.Width(90));

            // Type
            EditorGUILayout.LabelField(
                ValueTypeHelper.ToApiString(flag.ValueType), GUILayout.Width(50));

            // Value (bordered box)
            var payloadStr = FormatPayload(flag.Variant?.Value);
            var valueRect = EditorGUILayout.GetControlRect(false, EditorGUIUtility.singleLineHeight, GUILayout.MinWidth(80));
            DrawDashedBorderBox(valueRect, payloadStr);

            // Reason
            var reason = string.IsNullOrEmpty(flag.Reason) ? "evaluated" : flag.Reason;
            if (reason.Length > 20) reason = reason.Substring(0, 17) + "...";
            EditorGUILayout.LabelField(reason, GUILayout.Width(80));

            // Revision
            EditorGUILayout.LabelField(flag.Version.ToString(), GUILayout.Width(50));

            EditorGUILayout.EndHorizontal();
        }

        private static string FormatPayload(object payload)
        {
            if (payload == null) return "-";
            if (payload is bool boolVal) return boolVal ? "true" : "false";
            var str = payload.ToString();
            if (str == "") return "\"\"";
            if (str.Length > 50) str = str.Substring(0, 47) + "...";
            return str;
        }

        private static void DrawDashedBorderBox(Rect rect, string text)
        {
            // Background fill
            var bgRect = new Rect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
            EditorGUI.DrawRect(bgRect, new Color(0.15f, 0.15f, 0.15f, 0.5f));

            // Solid border
            var borderColor = new Color(0.5f, 0.5f, 0.5f, 0.6f);
            EditorGUI.DrawRect(new Rect(rect.x, rect.y, rect.width, 1), borderColor);           // Top
            EditorGUI.DrawRect(new Rect(rect.x, rect.yMax - 1, rect.width, 1), borderColor);    // Bottom
            EditorGUI.DrawRect(new Rect(rect.x, rect.y, 1, rect.height), borderColor);           // Left
            EditorGUI.DrawRect(new Rect(rect.xMax - 1, rect.y, 1, rect.height), borderColor);   // Right

            // Text inside
            var labelRect = new Rect(rect.x + 4, rect.y, rect.width - 8, rect.height);
            var style = new GUIStyle(EditorStyles.miniLabel)
            {
                normal = { textColor = new Color(0.85f, 0.85f, 0.85f) }
            };
            GUI.Label(labelRect, text, style);
        }

        // ==================== Events ====================

        private void DrawEventsTab()
        {
            EditorGUILayout.BeginHorizontal();
            EditorGUILayout.LabelField("Event Log", _headerStyle, GUILayout.ExpandWidth(true));

            if (GUILayout.Button("Clear", GUILayout.Width(50)))
            {
                _eventLog.Clear();
            }

            var listeningLabel = _isListening ? "Listening" : "Stopped";
            if (GUILayout.Button(listeningLabel, GUILayout.Width(70)))
            {
                if (_isListening) StopListening();
                else StartListening();
            }

            EditorGUILayout.EndHorizontal();

            EditorGUILayout.Space(4);

            if (_eventLog.Count == 0)
            {
                EditorGUILayout.HelpBox(
                    "No events captured yet. Start the SDK and interact with flags.",
                    MessageType.Info);
                return;
            }

            _eventLogScroll = EditorGUILayout.BeginScrollView(
                _eventLogScroll, GUILayout.ExpandHeight(true));

            // Draw events in reverse (newest first)
            for (int i = _eventLog.Count - 1; i >= 0; i--)
            {
                var entry = _eventLog[i];
                var timeStr = entry.Time.ToString("HH:mm:ss.fff");
                var color = GetEventColor(entry.EventName);

                EditorGUILayout.LabelField(
                    $"<color=#888>{timeStr}</color> <color={color}>{entry.EventName}</color> {entry.Details}",
                    _eventBoxStyle);
            }

            EditorGUILayout.EndScrollView();
        }

        // ==================== Context ====================

        private void DrawContextTab()
        {
            EditorGUILayout.LabelField("Evaluation Context", _headerStyle);
            EditorGUILayout.Space(4);

            if (_cachedContext == null)
            {
                EditorGUILayout.HelpBox("No context loaded.", MessageType.Info);
                return;
            }

            EditorGUILayout.LabelField("System Fields", _subHeaderStyle);
            DrawField("AppName", _cachedContext.AppName ?? "-");
            DrawField("Environment", _cachedContext.Environment ?? "-");

            EditorGUILayout.Space(4);
            EditorGUILayout.LabelField("Context Fields", _subHeaderStyle);
            DrawField("UserId", _cachedContext.UserId ?? "-");
            DrawField("SessionId", _cachedContext.SessionId ?? "-");
            DrawField("CurrentTime", _cachedContext.CurrentTime ?? "-");

            if (_cachedContext.Properties != null && _cachedContext.Properties.Count > 0)
            {
                EditorGUILayout.Space(4);
                EditorGUILayout.LabelField("Custom Properties", _subHeaderStyle);
                foreach (var kvp in _cachedContext.Properties)
                {
                    DrawField(kvp.Key, kvp.Value?.ToString() ?? "null");
                }
            }
        }

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
                EditorGUILayout.HelpBox("No statistics available.", MessageType.Info);
                return;
            }

            // Timing
            EditorGUILayout.LabelField("Timing", _subHeaderStyle);
            DrawField("Start Time", FormatTime(_cachedStats.StartTime));
            DrawField("Last Fetch", FormatTime(_cachedStats.LastFetchTime));
            DrawField("Last Update", FormatTime(_cachedStats.LastUpdateTime));
            if (_showAdvancedStats || _cachedStats.ErrorCount > 0)
            {
                DrawField("Last Error", FormatTime(_cachedStats.LastErrorTime));
                DrawField("Last Recovery", FormatTime(_cachedStats.LastRecoveryTime));
            }
            DrawField("Last Stream Event", FormatTime(_cachedStats.LastStreamingEventTime));

            EditorGUILayout.Space(8);

            // Counter Summary
            EditorGUILayout.LabelField("Counters", _subHeaderStyle);
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

            // Flag access counts
            if (_cachedStats.FlagEnabledCounts != null && _cachedStats.FlagEnabledCounts.Count > 0)
            {
                EditorGUILayout.Space(8);
                EditorGUILayout.LabelField("Flag Access Counts", _subHeaderStyle);

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
            }

            // Variant hit counts (Advanced only)
            if (_showAdvancedStats && _cachedStats.FlagVariantCounts != null && _cachedStats.FlagVariantCounts.Count > 0)
            {
                EditorGUILayout.Space(8);
                EditorGUILayout.LabelField("Variant Hit Counts", _subHeaderStyle);

                foreach (var flagKvp in _cachedStats.FlagVariantCounts)
                {
                    EditorGUILayout.LabelField($"  {flagKvp.Key}", EditorStyles.boldLabel);
                    foreach (var variantKvp in flagKvp.Value)
                    {
                        DrawField($"    {variantKvp.Key}", variantKvp.Value.ToString());
                    }
                }
            }

            // Missing flags
            if (_cachedStats.MissingFlags != null && _cachedStats.MissingFlags.Count > 0)
            {
                EditorGUILayout.Space(8);
                EditorGUILayout.LabelField("Missing Flags (Requested but Not Found)", _subHeaderStyle);

                foreach (var kvp in _cachedStats.MissingFlags)
                {
                    DrawField(kvp.Key, $"requested {kvp.Value} time(s)");
                }
            }

            // Flag change times (Removed as it's integrated into Flag Access Counts)

            // Watch groups
            if (_cachedStats.ActiveWatchGroups != null && _cachedStats.ActiveWatchGroups.Count > 0)
            {
                EditorGUILayout.Space(8);
                EditorGUILayout.LabelField("Active Watch Groups", _subHeaderStyle);

                foreach (var name in _cachedStats.ActiveWatchGroups)
                {
                    EditorGUILayout.LabelField($"  • {name}");
                }
            }

            // Event handler counts - useful for detecting leaked/duplicate listeners
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

                EditorGUILayout.Space(8);
                EditorGUILayout.LabelField($"Event Handlers (Total: {totalCount})", _subHeaderStyle);

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
            }
        }

        // ==================== Helpers ====================

        private void DrawField(string label, string value, bool richText = false)
        {
            EditorGUILayout.BeginHorizontal();
            EditorGUILayout.LabelField(label, GUILayout.Width(150));
            if (richText)
            {
                EditorGUILayout.LabelField(value, _statusLabelStyle);
            }
            else
            {
                EditorGUILayout.LabelField(value);
            }
            EditorGUILayout.EndHorizontal();
        }

        private static string FormatTime(DateTime? time)
        {
            if (!time.HasValue) return "-";
            return time.Value.ToLocalTime().ToString("yyyy-MM-dd HH:mm:ss");
        }

        private static string GetEventColor(string eventName)
        {
            if (eventName.Contains("error") || eventName.Contains("Error"))
                return "#ff6666";
            if (eventName.Contains("success") || eventName.Contains("ready") || eventName.Contains("recovered"))
                return "#66ff66";
            if (eventName.Contains("change") || eventName.Contains("sync"))
                return "#ffcc66";
            if (eventName.Contains("fetch"))
                return "#66ccff";
            return "#cccccc";
        }

        private void RefreshData()
        {
            var client = GatrixBehaviour.Client;
            if (client == null) return;

            _cachedStats = client.Features.GetStats();
            _cachedContext = client.Features.GetContext();
            _cachedExplicitSync = client.Features.IsExplicitSync();
            _cachedPendingSync = client.Features.HasPendingSyncFlags();

            // In explicit sync mode, get both synchronized and realtime flags
            var newFlags = client.Features.GetAllFlags();
            if (_cachedExplicitSync)
            {
                _cachedRealtimeFlags = client.Features.GetAllFlags(forceRealtime: true);
            }
            else
            {
                _cachedRealtimeFlags = null;
            }

            // Detect changed flags by comparing with previous state
            // Track changes from realtime flags (most up-to-date source)
            var trackingFlags = _cachedExplicitSync && _cachedRealtimeFlags != null
                ? _cachedRealtimeFlags : newFlags;

            if (trackingFlags != null)
            {
                foreach (var flag in trackingFlags)
                {
                    if (_previousFlagStates.TryGetValue(flag.Name, out var prev))
                    {
                        bool changed = prev.Enabled != flag.Enabled
                            || prev.VariantName != (flag.Variant?.Name ?? "")
                            || prev.VariantValue != (flag.Variant?.Value?.ToString() ?? "")
                            || prev.Version != flag.Version;

                        if (changed)
                        {
                            _changedFlagTimes[flag.Name] = (float)EditorApplication.timeSinceStartup;
                        }
                    }

                    // Update snapshot
                    _previousFlagStates[flag.Name] = new FlagSnapshot
                    {
                        Enabled = flag.Enabled,
                        VariantName = flag.Variant?.Name ?? "",
                        VariantValue = flag.Variant?.Value?.ToString() ?? "",
                        Version = flag.Version
                    };
                }

                // Prune expired highlights
                var now = (float)EditorApplication.timeSinceStartup;
                var expired = new List<string>();
                foreach (var kvp in _changedFlagTimes)
                {
                    if (now - kvp.Value >= HighlightDuration)
                        expired.Add(kvp.Key);
                }
                foreach (var key in expired)
                    _changedFlagTimes.Remove(key);
            }

            _cachedFlags = newFlags;
        }

        /// <summary>Lightweight snapshot for change detection</summary>
        private struct FlagSnapshot
        {
            public bool Enabled;
            public string VariantName;
            public string VariantValue;
            public int Version;
        }

        private void StartListening()
        {
            if (_isListening) return;

            var client = GatrixBehaviour.Client;
            if (client == null) return;

            _eventListener = (eventName, args) =>
            {
                var details = args != null && args.Length > 0 ? args[0]?.ToString() ?? "" : "";
                if (details.Length > 100) details = details.Substring(0, 97) + "...";

                _eventLog.Add(new EventLogEntry
                {
                    Time = DateTime.Now,
                    EventName = eventName,
                    Details = details
                });

                // Trim old entries
                while (_eventLog.Count > MaxEventLogEntries)
                {
                    _eventLog.RemoveAt(0);
                }

                // Immediately refresh data when flags change
                if (eventName == GatrixEvents.FlagsChange ||
                    eventName == GatrixEvents.FlagsFetchEnd ||
                    eventName == GatrixEvents.FlagsPendingSync)
                {
                    RefreshData();
                    Repaint();
                }
            };

            client.Events.OnAny(_eventListener);
            _isListening = true;

            // Refresh immediately when starting to listen
            RefreshData();
            Repaint();
        }

        private void StopListening()
        {
            if (!_isListening) return;

            var client = GatrixBehaviour.Client;
            if (client != null && _eventListener != null)
            {
                client.Events.OffAny(_eventListener);
            }

            _eventListener = null;
            _isListening = false;
        }

        private struct EventLogEntry
        {
            public DateTime Time;
            public string EventName;
            public string Details;
        }
    }
}
#endif
