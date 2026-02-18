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
            window.minSize = new Vector2(480, 380);
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

            // Use GatrixEditorStyle for shared styles
            _headerStyle = GatrixEditorStyle.HeaderLabel;
            _subHeaderStyle = GatrixEditorStyle.SubHeaderLabel;

            _statusLabelStyle = new GUIStyle(EditorStyles.label)
            {
                richText = true,
                alignment = TextAnchor.MiddleLeft
            };

            _eventBoxStyle = new GUIStyle(EditorStyles.helpBox)
            {
                fontSize = 11,
                richText = true,
                padding = new RectOffset(6, 6, 4, 4),
                margin = new RectOffset(0, 0, 2, 2),
                alignment = TextAnchor.MiddleLeft
            };

            _flagNameStyle = new GUIStyle(EditorStyles.label)
            {
                fontStyle = FontStyle.Bold,
                alignment = TextAnchor.MiddleLeft
            };

            _sectionBoxStyle = new GUIStyle(EditorStyles.helpBox)
            {
                padding = new RectOffset(10, 10, 8, 8),
                margin = new RectOffset(0, 0, 5, 10)
            };
        }

        private void OnGUI()
        {
            InitStyles();
            DrawWindowTitleBar();
            DrawToolbar();

            _scrollPosition = EditorGUILayout.BeginScrollView(_scrollPosition);

            if (!GatrixBehaviour.IsInitialized)
            {
                DrawSdkNotInitializedBanner();
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

        private void DrawWindowTitleBar()
        {
            // Use GetControlRect to avoid GUIClip imbalance from BeginHorizontal(GUILayout.Height)
            var rect = GUILayoutUtility.GetRect(0, 28, GUILayout.ExpandWidth(true));

            if (Event.current.type == EventType.Repaint)
            {
                var bgColor = EditorGUIUtility.isProSkin
                    ? new Color(0.14f, 0.14f, 0.14f, 1f)
                    : new Color(0.80f, 0.80f, 0.80f, 1f);
                EditorGUI.DrawRect(new Rect(0, rect.y, position.width, 28), bgColor);
                EditorGUI.DrawRect(new Rect(0, rect.y, 3, 28), new Color(0.18f, 0.48f, 0.92f, 1f));
                EditorGUI.DrawRect(new Rect(0, rect.yMax - 1, position.width, 1), new Color(0.1f, 0.1f, 0.1f, 1f));
            }

            var titleStyle = new GUIStyle(EditorStyles.boldLabel)
            {
                fontSize = 11,
                normal = { textColor = EditorGUIUtility.isProSkin ? new Color(0.9f, 0.9f, 0.9f) : new Color(0.1f, 0.1f, 0.1f) }
            };

            // Draw title text
            var titleRect = new Rect(rect.x + 10, rect.y + 5, 200, 18);
            GUI.Label(titleRect, "\u25c6  GATRIX MONITOR", titleStyle);

            // Quick access buttons (right-aligned)
            var btnWidth = 44f;
            var btnHeight = 18f;
            var btnY = rect.y + (rect.height - btnHeight) / 2f;

            var aboutRect = new Rect(rect.xMax - btnWidth - 4, btnY, btnWidth, btnHeight);
            var setupRect = new Rect(aboutRect.x - btnWidth - 2, btnY, btnWidth, btnHeight);

            if (GUI.Button(setupRect, "Setup", EditorStyles.miniButton))
            {
                GatrixSetupWindow.ShowWindow();
            }
            if (GUI.Button(aboutRect, "About", EditorStyles.miniButton))
            {
                GatrixAboutWindow.ShowWindow();
            }
        }

        private void DrawSdkNotInitializedBanner()
        {
            // Use GetControlRect to avoid GUIClip imbalance
            var rect = GUILayoutUtility.GetRect(0, 26, GUILayout.ExpandWidth(true));

            if (Event.current.type == EventType.Repaint)
            {
                EditorGUI.DrawRect(rect, new Color(0.5f, 0.35f, 0f, 0.35f));
            }

            var style = new GUIStyle(EditorStyles.miniLabel)
            {
                richText = true,
                normal = { textColor = new Color(1f, 0.85f, 0.3f) },
                clipping = TextClipping.Clip
            };

            var btnWidth = 60f;
            var btnHeight = 18f;
            var btnRect = new Rect(rect.xMax - btnWidth - 4, rect.y + (rect.height - btnHeight) / 2f, btnWidth, btnHeight);
            var labelRect = new Rect(rect.x + 6, rect.y, rect.width - btnWidth - 12, rect.height);

            GUI.Label(labelRect, "\u26a0  SDK not initialized \u2014 add GatrixBehaviour to scene or call GatrixBehaviour.InitializeAsync()", style);

            if (GUI.Button(btnRect, "Setup \u2197", EditorStyles.miniButton))
            {
                GatrixSetupWindow.ShowWindow();
            }

            EditorGUILayout.Space(2);
        }

        // ==================== Toolbar ====================

        private void DrawToolbar()
        {
            EditorGUILayout.BeginHorizontal(EditorStyles.toolbar);

            var tabNames = new[] { "Overview", "Flags", "Events", "Context", "Stats" };
            for (int i = 0; i < tabNames.Length; i++)
            {
                var isActive = (int)_currentTab == i;
                if (GUILayout.Toggle(isActive, tabNames[i], EditorStyles.toolbarButton))
                {
                    _currentTab = (Tab)i;
                }
            }

            GUILayout.FlexibleSpace();

            // Pending sync indicator
            if (_cachedPendingSync)
            {
                var pendingStyle = new GUIStyle(EditorStyles.toolbarButton)
                {
                    normal = { textColor = new Color(1f, 0.85f, 0.3f) },
                    fontStyle = FontStyle.Bold
                };
                if (GUILayout.Button("⚡ Sync", pendingStyle, GUILayout.Width(60)))
                {
                    var c = GatrixBehaviour.Client;
                    if (c != null) _ = c.Features.SyncFlagsAsync(false);
                }
            }

            _autoRefresh = GUILayout.Toggle(_autoRefresh, "Auto", EditorStyles.toolbarButton, GUILayout.Width(40));

            if (GUILayout.Button("↻", EditorStyles.toolbarButton, GUILayout.Width(22)))
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
                var go = UnityEngine.Object.FindObjectOfType<GatrixBehaviour>();
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

            // ── Metrics & Streaming ──
            GatrixEditorStyle.DrawSection("Metrics & Streaming", "Real-time data flow");
            GatrixEditorStyle.BeginBox();

            if (stats != null)
            {
                DrawField("Metrics Sent", stats.MetricsSentCount.ToString());
                DrawField("Metrics Errors", stats.MetricsErrorCount.ToString());
                DrawField("Impressions", stats.ImpressionCount.ToString());

                var stateColor = stats.StreamingState == StreamingConnectionState.Connected
                    ? "#88ff88"
                    : stats.StreamingState == StreamingConnectionState.Disconnected
                        ? "gray"
                        : stats.StreamingState == StreamingConnectionState.Degraded
                            ? "#ff8888"
                            : "yellow";
                DrawField("Streaming", $"<color={stateColor}>● {stats.StreamingState}</color>", true);
                DrawField("Reconnections", stats.StreamingReconnectCount.ToString());
                DrawField("Last Event", FormatTime(stats.LastStreamingEventTime));
            }

            GatrixEditorStyle.EndBox();
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
            GatrixEditorStyle.BeginBox();
            EditorGUILayout.BeginHorizontal();
            EditorGUILayout.LabelField(
                _cachedPendingSync
                    ? "<color=#ffcc66>● Pending changes available</color>"
                    : "<color=#88ff88>● Synchronized</color>",
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
            GatrixEditorStyle.EndBox();

            // Synchronized flags section
            GatrixEditorStyle.DrawSection("Synchronized Flags (Active)");
            DrawFlagTable(_cachedFlags, filter);

            // Realtime flags section (pending)
            if (_cachedRealtimeFlags != null && _cachedPendingSync)
            {
                GatrixEditorStyle.DrawSection("Realtime Flags (Pending Sync)");
                DrawFlagTable(_cachedRealtimeFlags, filter);
            }
        }

        private void DrawFlagTable(List<EvaluatedFlag> flags, string filter)
        {
            GatrixEditorStyle.BeginBox();
            
            // Table header
            EditorGUILayout.BeginHorizontal(EditorStyles.toolbar);
            EditorGUILayout.LabelField("Name", EditorStyles.miniLabel, GUILayout.MinWidth(120));
            EditorGUILayout.LabelField("State", EditorStyles.miniLabel, GUILayout.Width(30));
            EditorGUILayout.LabelField("Variant", EditorStyles.miniLabel, GUILayout.Width(90));
            EditorGUILayout.LabelField("Val", EditorStyles.miniLabel, GUILayout.MinWidth(80));
            EditorGUILayout.LabelField("Type", EditorStyles.miniLabel, GUILayout.Width(50));
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
            
            if (visibleIndex == 0)
            {
                GatrixEditorStyle.DrawHelpBox("No flags found matching filter.", MessageType.Info);
            }
            
            GatrixEditorStyle.EndBox();
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
                    ? (EditorGUIUtility.isProSkin ? new Color(0.18f, 0.18f, 0.18f, 0.3f) : new Color(0.9f, 0.9f, 0.9f, 0.3f))
                    : Color.clear;
            }

            var rect = EditorGUILayout.BeginHorizontal();
            if (bgColor != Color.clear)
            {
                EditorGUI.DrawRect(rect, bgColor);
            }

            // Flag name
            EditorGUILayout.LabelField(new GUIContent(flag.Name, flag.Name), _flagNameStyle, GUILayout.MinWidth(120));

            // Enabled
            var enabledColor = flag.Enabled ? "#88ff88" : "#ff8888";
            var enabledText = flag.Enabled ? "ON" : "OFF";
            EditorGUILayout.LabelField(
                $"<color={enabledColor}>{enabledText}</color>",
                _statusLabelStyle, GUILayout.Width(30));

            // Variant name
            var variantName = flag.Variant?.Name ?? "-";
            if(variantName.Length > 15) variantName = variantName.Substring(0, 12) + "...";
            EditorGUILayout.LabelField(new GUIContent(variantName, flag.Variant?.Name), GUILayout.Width(90));

            // Value (bordered box)
            var payloadStr = FormatPayload(flag.Variant?.Value);
            var valueRect = EditorGUILayout.GetControlRect(false, EditorGUIUtility.singleLineHeight, GUILayout.MinWidth(80));
            DrawDashedBorderBox(valueRect, payloadStr);
            
            // Type
            EditorGUILayout.LabelField(
                ValueTypeHelper.ToApiString(flag.ValueType), EditorStyles.miniLabel, GUILayout.Width(50));

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
            if (Event.current.type != EventType.Repaint)
            {
                // Still draw the label even during layout
                var labelRectLayout = new Rect(rect.x + 4, rect.y, rect.width - 8, rect.height);
                var layoutStyle = new GUIStyle(EditorStyles.miniLabel)
                {
                    normal = { textColor = new Color(0.85f, 0.85f, 0.85f) }
                };
                GUI.Label(labelRectLayout, text, layoutStyle);
                return;
            }

            // Clamp to avoid overflow
            var clampedRect = new Rect(
                rect.x,
                rect.y,
                Mathf.Max(0, rect.width - 1),
                rect.height);

            // Background fill
            var bgRect = new Rect(clampedRect.x + 1, clampedRect.y + 1, clampedRect.width - 2, clampedRect.height - 2);
            EditorGUI.DrawRect(bgRect, new Color(0.15f, 0.15f, 0.15f, 0.5f));

            // Solid border
            var borderColor = new Color(0.5f, 0.5f, 0.5f, 0.6f);
            EditorGUI.DrawRect(new Rect(clampedRect.x, clampedRect.y, clampedRect.width, 1), borderColor);
            EditorGUI.DrawRect(new Rect(clampedRect.x, clampedRect.yMax - 1, clampedRect.width, 1), borderColor);
            EditorGUI.DrawRect(new Rect(clampedRect.x, clampedRect.y, 1, clampedRect.height), borderColor);
            EditorGUI.DrawRect(new Rect(clampedRect.xMax - 1, clampedRect.y, 1, clampedRect.height), borderColor);

            // Text inside
            var labelRect = new Rect(clampedRect.x + 4, clampedRect.y, clampedRect.width - 8, clampedRect.height);
            var style = new GUIStyle(EditorStyles.miniLabel)
            {
                normal = { textColor = new Color(0.85f, 0.85f, 0.85f) }
            };
            GUI.Label(labelRect, text, style);
        }

        // ==================== Events ====================

        private void DrawEventsTab()
        {
            // Control bar
            EditorGUILayout.BeginHorizontal(EditorStyles.toolbar);
            EditorGUILayout.LabelField(
                $"Event Log  <color=#888888>({_eventLog.Count}/{MaxEventLogEntries})</color>",
                new GUIStyle(EditorStyles.toolbarButton) { richText = true, alignment = TextAnchor.MiddleLeft },
                GUILayout.ExpandWidth(true));
            GUILayout.FlexibleSpace();

            if (GUILayout.Button("Clear", EditorStyles.toolbarButton, GUILayout.Width(44)))
            {
                _eventLog.Clear();
            }

            var listeningLabel = _isListening ? "● Listening" : "○ Stopped";
            var listeningColor = _isListening ? new Color(0.4f, 1f, 0.4f) : new Color(0.7f, 0.7f, 0.7f);
            var listeningStyle = new GUIStyle(EditorStyles.toolbarButton)
            {
                normal = { textColor = listeningColor },
                fontStyle = FontStyle.Bold
            };
            if (GUILayout.Button(listeningLabel, listeningStyle, GUILayout.Width(80)))
            {
                if (_isListening) StopListening();
                else StartListening();
            }
            EditorGUILayout.EndHorizontal();

            EditorGUILayout.Space(2);

            if (_eventLog.Count == 0)
            {
                EditorGUILayout.Space(20);
                EditorGUILayout.BeginHorizontal();
                GUILayout.FlexibleSpace();
                EditorGUILayout.LabelField("No events captured yet.", EditorStyles.centeredGreyMiniLabel, GUILayout.Width(200));
                GUILayout.FlexibleSpace();
                EditorGUILayout.EndHorizontal();
                EditorGUILayout.Space(4);
                EditorGUILayout.BeginHorizontal();
                GUILayout.FlexibleSpace();
                EditorGUILayout.LabelField("Start the SDK and interact with flags.", EditorStyles.centeredGreyMiniLabel, GUILayout.Width(250));
                GUILayout.FlexibleSpace();
                EditorGUILayout.EndHorizontal();
                return;
            }

            _eventLogScroll = EditorGUILayout.BeginScrollView(_eventLogScroll, GUILayout.ExpandHeight(true));

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
            if (_cachedContext == null)
            {
                GatrixEditorStyle.DrawHelpBox("No context loaded.", MessageType.Info);
                return;
            }

            GatrixEditorStyle.DrawSection("System Fields");
            GatrixEditorStyle.BeginBox();
            DrawField("AppName", _cachedContext.AppName ?? "-");
            DrawField("Environment", _cachedContext.Environment ?? "-");
            GatrixEditorStyle.EndBox();

            GatrixEditorStyle.DrawSection("Context Fields");
            GatrixEditorStyle.BeginBox();
            DrawField("UserId", _cachedContext.UserId ?? "-");
            DrawField("SessionId", _cachedContext.SessionId ?? "-");
            DrawField("CurrentTime", _cachedContext.CurrentTime ?? "-");
            GatrixEditorStyle.EndBox();

            if (_cachedContext.Properties != null && _cachedContext.Properties.Count > 0)
            {
                GatrixEditorStyle.DrawSection("Custom Properties");
                GatrixEditorStyle.BeginBox();
                foreach (var kvp in _cachedContext.Properties)
                {
                    DrawField(kvp.Key, kvp.Value?.ToString() ?? "null");
                }
                GatrixEditorStyle.EndBox();
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

        private void DrawFieldWithCopy(string label, string value)
        {
            EditorGUILayout.BeginHorizontal();
            EditorGUILayout.LabelField(label, GUILayout.Width(150));
            EditorGUILayout.LabelField(value);
            if (GUILayout.Button("Copy", EditorStyles.miniButton, GUILayout.Width(40)))
            {
                GUIUtility.systemCopyBuffer = value;
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
