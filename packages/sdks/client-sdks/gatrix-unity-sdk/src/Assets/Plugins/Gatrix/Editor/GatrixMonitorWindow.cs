// GatrixMonitorWindow - Unity Editor monitoring window (Core)
// Provides real-time SDK state, flags, events, and statistics monitoring
// Tab implementations are in separate partial class files:
//   - GatrixMonitorWindow.Overview.cs
//   - GatrixMonitorWindow.Flags.cs
//   - GatrixMonitorWindow.Events.cs
//   - GatrixMonitorWindow.Context.cs
//   - GatrixMonitorWindow.Metrics.cs
//   - GatrixMonitorWindow.Statistics.cs

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
    public partial class GatrixMonitorWindow : EditorWindow
    {
        private enum Tab
        {
            Overview,
            Flags,
            Events,
            Context,
            Metrics,
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
        [NonSerialized] private List<EventLogEntry> _eventLog = new List<EventLogEntry>();
        private const int MaxEventLogEntries = 200;
        [NonSerialized] private GatrixAnyEventHandler _eventListener;
        [NonSerialized] private bool _isListening;

        // Cached data (non-serialized: reconstructed on refresh)
        [NonSerialized] private FeaturesStats _cachedStats;
        [NonSerialized] private List<EvaluatedFlag> _cachedFlags;
        [NonSerialized] private List<EvaluatedFlag> _cachedRealtimeFlags;
        [NonSerialized] private GatrixContext _cachedContext;
        [NonSerialized] private bool _cachedExplicitSync;
        [NonSerialized] private bool _cachedPendingSync;

        // Flag change tracking (non-serialized: reconstructed on refresh)
        [NonSerialized] private Dictionary<string, FlagSnapshot> _previousFlagStates = new Dictionary<string, FlagSnapshot>();
        [NonSerialized] private Dictionary<string, float> _changedFlagTimes = new Dictionary<string, float>();
        private const float HighlightDuration = 3.0f;

        // Time-series metrics collection
        private const float MetricsCollectIntervalSec = 1.0f;
        private const float MetricsRetentionSec = 300.0f;

        private enum MetricsViewMode { Graph, Report }
        private MetricsViewMode _metricsViewMode = MetricsViewMode.Graph;
        [NonSerialized] private float _metricsTimeOffset; // 0 = now, positive = looking back

        // Delta-based tracks: show activity per interval (not cumulative)
        private TimeSeriesTrack _tsFetchDelta;
        private TimeSeriesTrack _tsUpdateDelta;
        private TimeSeriesTrack _tsErrorDelta;
        private TimeSeriesTrack _tsImpressionDelta;
        private TimeSeriesTrack _tsMetricsSentDelta;
        private TimeSeriesTrack _tsStreamReconnectDelta;

        // Previous cumulative values for delta computation
        [NonSerialized] private int _prevFetchCount;
        [NonSerialized] private int _prevUpdateCount;
        [NonSerialized] private int _prevErrorCount;
        [NonSerialized] private int _prevImpressionCount;
        [NonSerialized] private int _prevMetricsSentCount;
        [NonSerialized] private int _prevStreamReconnectCount;
        [NonSerialized] private bool _prevValuesInitialized;

        // Flag state count tracks: how many flags are enabled/disabled/missing at each second
        private TimeSeriesTrack _tsFlagEnabled;
        private TimeSeriesTrack _tsFlagDisabled;
        private TimeSeriesTrack _tsFlagMissing;

        private void InitTimeSeries()
        {
            // Check actual track instance, not a bool flag.
            // Unity hot-reload serializes bool fields but not custom objects,
            // so a flag could remain true while tracks become null.
            if (_tsFetchDelta != null) return;

            int maxPoints = (int)(MetricsRetentionSec / MetricsCollectIntervalSec) + 10;
            _tsFetchDelta           = new TimeSeriesTrack("Fetches",    new Color(0.40f, 0.70f, 1.00f), maxPoints);
            _tsUpdateDelta          = new TimeSeriesTrack("Updates",    new Color(0.40f, 1.00f, 0.50f), maxPoints);
            _tsErrorDelta           = new TimeSeriesTrack("Errors",     new Color(1.00f, 0.40f, 0.40f), maxPoints);
            _tsImpressionDelta      = new TimeSeriesTrack("Impressions",  new Color(1.00f, 0.80f, 0.30f), maxPoints);
            _tsMetricsSentDelta     = new TimeSeriesTrack("Metrics Sent", new Color(0.70f, 0.50f, 1.00f), maxPoints);
            _tsStreamReconnectDelta = new TimeSeriesTrack("Reconnects",   new Color(1.00f, 0.60f, 0.20f), maxPoints);

            _tsFlagEnabled  = new TimeSeriesTrack("Enabled",  new Color(0.30f, 0.85f, 0.45f), maxPoints);
            _tsFlagDisabled = new TimeSeriesTrack("Disabled", new Color(0.55f, 0.55f, 0.60f), maxPoints);
            _tsFlagMissing  = new TimeSeriesTrack("Missing",  new Color(0.95f, 0.35f, 0.35f), maxPoints);

            _prevValuesInitialized = false;
        }

        private void CollectTimeSeriesData(FeaturesStats stats)
        {
            if (stats == null) return;
            InitTimeSeries();

            if (!_prevValuesInitialized)
            {
                // First sample: seed previous values, record 0 delta
                _prevFetchCount = stats.FetchFlagsCount;
                _prevUpdateCount = stats.UpdateCount;
                _prevErrorCount = stats.ErrorCount;
                _prevImpressionCount = stats.ImpressionCount;
                _prevMetricsSentCount = stats.MetricsSentCount;
                _prevStreamReconnectCount = stats.StreamingReconnectCount;
                _prevValuesInitialized = true;

                _tsFetchDelta.Add(0);
                _tsUpdateDelta.Add(0);
                _tsErrorDelta.Add(0);
                _tsImpressionDelta.Add(0);
                _tsMetricsSentDelta.Add(0);
                _tsStreamReconnectDelta.Add(0);
            }
            else
            {
                // Compute deltas (activity since last sample)
                _tsFetchDelta.Add(stats.FetchFlagsCount - _prevFetchCount);
                _tsUpdateDelta.Add(stats.UpdateCount - _prevUpdateCount);
                _tsErrorDelta.Add(stats.ErrorCount - _prevErrorCount);
                _tsImpressionDelta.Add(stats.ImpressionCount - _prevImpressionCount);
                _tsMetricsSentDelta.Add(stats.MetricsSentCount - _prevMetricsSentCount);
                _tsStreamReconnectDelta.Add(stats.StreamingReconnectCount - _prevStreamReconnectCount);

                _prevFetchCount = stats.FetchFlagsCount;
                _prevUpdateCount = stats.UpdateCount;
                _prevErrorCount = stats.ErrorCount;
                _prevImpressionCount = stats.ImpressionCount;
                _prevMetricsSentCount = stats.MetricsSentCount;
                _prevStreamReconnectCount = stats.StreamingReconnectCount;
            }

            // Count flags by state and record to tracks
            CollectFlagStateCounts();
        }

        private void CollectFlagStateCounts()
        {
            var flags = _cachedFlags;
            int enabled = 0, disabled = 0, missing = 0;

            if (flags != null)
            {
                foreach (var flag in flags)
                {
                    if (flag.Reason == Gatrix.Unity.SDK.VariantSource.Missing)
                        missing++;
                    else if (flag.Enabled)
                        enabled++;
                    else
                        disabled++;
                }
            }

            if (_tsFlagEnabled != null)
            {
                _tsFlagEnabled.Add(enabled);
                _tsFlagDisabled.Add(disabled);
                _tsFlagMissing.Add(missing);
            }
        }

        // Styles (non-serialized: GUIStyle objects cannot survive domain reload)
        [NonSerialized] private GUIStyle _headerStyle;
        [NonSerialized] private GUIStyle _subHeaderStyle;
        [NonSerialized] private GUIStyle _statusLabelStyle;
        [NonSerialized] private GUIStyle _eventBoxStyle;
        [NonSerialized] private GUIStyle _flagNameStyle;
        [NonSerialized] private GUIStyle _sectionBoxStyle;
        [NonSerialized] private bool _stylesInitialized;

        [MenuItem("Window/Gatrix/Monitor", priority = 2)]
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
            // Domain reload recovery: ensure non-serialized collections are initialized
            if (_eventLog == null) _eventLog = new List<EventLogEntry>();
            if (_previousFlagStates == null) _previousFlagStates = new Dictionary<string, FlagSnapshot>();
            if (_changedFlagTimes == null) _changedFlagTimes = new Dictionary<string, float>();

            // After domain reload, _isListening is false (NonSerialized),
            // so StartListening will re-subscribe if SDK is available
            _isListening = false;
            _eventListener = null;
            _stylesInitialized = false;

            StartListening();
            EditorApplication.update += OnEditorUpdate;

            // Reset refresh timer so auto-refresh starts immediately
            // (Time.realtimeSinceStartup resets on Play mode, but _lastRefreshTime persists)
            _lastRefreshTime = 0f;
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

            // Add left/right padding for breathing room
            EditorGUILayout.BeginHorizontal();
            GUILayout.Space(8);
            EditorGUILayout.BeginVertical();

            // Edit mode banner (shown in Overview tab only)
            if (!EditorApplication.isPlaying && _currentTab == Tab.Overview)
            {
                DrawEditModeScreen();
            }

            if (!EditorApplication.isPlaying && _currentTab != Tab.Overview)
            {
                // Show hint that data comes from play mode
                if (!GatrixBehaviour.IsInitialized)
                {
                    EditorGUILayout.HelpBox(
                        "SDK is not active. Start Play Mode to collect live data. " +
                        "Cached data from the previous session (if any) is shown below.",
                        MessageType.Info);
                    EditorGUILayout.Space(4);
                }
            }

            if (EditorApplication.isPlaying && !GatrixBehaviour.IsInitialized)
            {
                DrawSdkNotInitializedBanner();
            }

            switch (_currentTab)
            {
                case Tab.Overview:
                    if (EditorApplication.isPlaying)
                        DrawOverview();
                    break;
                case Tab.Flags: DrawFlags(); break;
                case Tab.Events: DrawEventsTab(); break;
                case Tab.Context: DrawContextTab(); break;
                case Tab.Metrics: DrawMetricsTab(); break;
                case Tab.Statistics: DrawStatistics(); break;
            }

            EditorGUILayout.EndVertical();
            GUILayout.Space(8);
            EditorGUILayout.EndHorizontal();

            EditorGUILayout.EndScrollView();
        }

        // ==================== Title Bar ====================

        private void DrawWindowTitleBar()
        {
            // Use GetControlRect to avoid GUIClip imbalance from BeginHorizontal(GUILayout.Height)
            var rect = GUILayoutUtility.GetRect(0, 28, GUILayout.ExpandWidth(true));

            if (Event.current.type == EventType.Repaint)
            {
                float fullWidth = EditorGUIUtility.currentViewWidth;
                var bgColor = EditorGUIUtility.isProSkin
                    ? new Color(0.14f, 0.14f, 0.14f, 1f)
                    : new Color(0.80f, 0.80f, 0.80f, 1f);
                EditorGUI.DrawRect(new Rect(0, rect.y, fullWidth, 28), bgColor);
                EditorGUI.DrawRect(new Rect(0, rect.y, 3, 28), new Color(0.18f, 0.48f, 0.92f, 1f));
                EditorGUI.DrawRect(new Rect(0, rect.yMax - 1, fullWidth, 1), new Color(0.1f, 0.1f, 0.1f, 1f));
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

        // ==================== SDK Not Initialized ====================

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

        private void DrawEditModeScreen()
        {
            bool isDark = EditorGUIUtility.isProSkin;

            EditorGUILayout.Space(20);

            // ── Play button (centered) ──
            EditorGUILayout.BeginHorizontal();
            GUILayout.FlexibleSpace();
            EditorGUILayout.BeginVertical(GUILayout.MaxWidth(320));

            // Play icon + message
            var playMsgStyle = new GUIStyle(EditorStyles.label)
            {
                fontSize = 13,
                alignment = TextAnchor.MiddleCenter,
                wordWrap = true,
                normal = { textColor = isDark ? new Color(0.70f, 0.73f, 0.78f) : new Color(0.30f, 0.33f, 0.38f) }
            };
            EditorGUILayout.LabelField("\u25b6  Enter Play Mode to start monitoring", playMsgStyle, GUILayout.Height(28));

            EditorGUILayout.Space(8);

            // Play button
            var playBtnStyle = new GUIStyle(GUI.skin.button)
            {
                fontSize = 13,
                fontStyle = FontStyle.Bold,
                fixedHeight = 36,
                normal = { textColor = new Color(0.3f, 0.8f, 0.4f) }
            };
            if (GUILayout.Button("\u25b6  Play", playBtnStyle))
            {
                EditorApplication.isPlaying = true;
            }

            EditorGUILayout.EndVertical();
            GUILayout.FlexibleSpace();
            EditorGUILayout.EndHorizontal();

            EditorGUILayout.Space(16);

            // ── Scene configuration summary (full width) ──
#if UNITY_2023_1_OR_NEWER
            var behaviour = UnityEngine.Object.FindFirstObjectByType<GatrixBehaviour>();
#else
            var behaviour = UnityEngine.Object.FindObjectOfType<GatrixBehaviour>();
#endif

            if (behaviour != null)
            {
                // Found GatrixBehaviour in scene — show config summary
                GatrixEditorStyle.DrawSection("Scene Configuration", "Detected GatrixBehaviour in current scene");
                GatrixEditorStyle.BeginBox();

                DrawClickableField("GameObject", behaviour.gameObject.name, behaviour.gameObject);
                DrawField("Auto Initialize", behaviour.AutoInitialize ? "<color=#88ff88>Yes</color>" : "<color=#ffcc66>No</color>", true);

                if (behaviour.Settings != null)
                {
                    var s = behaviour.Settings;

                    // ── Connection ──
                    DrawClickableField("Settings Asset", s.name, s);
                    DrawField("App Name", s.AppName ?? "-");
                    DrawField("Environment", s.Environment ?? "-");
                    DrawField("API URL", !string.IsNullOrEmpty(s.ApiUrl)
                        ? TruncateMiddle(s.ApiUrl, 40)
                        : "<color=#ff8888>Not set</color>", true);
                    DrawField("API Token", !string.IsNullOrEmpty(s.ApiToken)
                        ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022 (configured)"
                        : "<color=#ff8888>Not set</color>", true);

                    // Separator
                    DrawSeparator();

                    // ── Behavior ──
                    DrawField("Offline Mode", s.OfflineMode
                        ? "<color=#ffcc66>Yes</color>"
                        : "No", true);
                    DrawField("Explicit Sync", s.ExplicitSyncMode
                        ? "<color=#ffcc66>Yes</color>"
                        : "No", true);
                    DrawField("Dev Mode", s.EnableDevMode
                        ? "<color=#ffcc66>Yes</color>"
                        : "No", true);

                    // Separator
                    DrawSeparator();

                    // ── Data Refresh (strikethrough when offline) ──
                    var isOffline = s.OfflineMode;

                    string pollingText = s.DisableRefresh
                        ? "<color=#888888>Disabled</color>"
                        : $"<color=#88ff88>Enabled</color>  ({s.RefreshInterval}s)";
                    DrawFieldWithStrikethrough("Polling", pollingText, isOffline);

                    string streamingText = !s.StreamingEnabled
                        ? "<color=#888888>Disabled</color>"
                        : $"<color=#88ff88>Enabled</color>  ({s.StreamingTransport})";
                    DrawFieldWithStrikethrough("Streaming", streamingText, isOffline);
                }
                else
                {
                    EditorGUILayout.Space(2);
                    EditorGUILayout.HelpBox(
                        "No GatrixSettings asset assigned.\nAssign one in the Inspector or use the Setup Wizard.",
                        MessageType.Warning);
                }

                GatrixEditorStyle.EndBox();

                // Quick action buttons (matching Play mode Overview)
                EditorGUILayout.Space(4);
                EditorGUILayout.BeginHorizontal();
                if (GUILayout.Button("Open Inspector", GUILayout.Height(24)))
                {
                    Selection.activeGameObject = behaviour.gameObject;
                    EditorGUIUtility.PingObject(behaviour.gameObject);
                }
                if (behaviour.Settings != null)
                {
                    if (GUILayout.Button("Settings", GUILayout.Height(24)))
                    {
                        Selection.activeObject = behaviour.Settings;
                        EditorGUIUtility.PingObject(behaviour.Settings);
                    }
                }
                if (GUILayout.Button("Setup Wizard", GUILayout.Height(24)))
                {
                    GatrixSetupWindow.ShowWindow();
                }
                EditorGUILayout.EndHorizontal();
            }
            else
            {
                // No GatrixBehaviour found
                EditorGUILayout.Space(4);
                EditorGUILayout.HelpBox(
                    "No GatrixBehaviour found in the current scene.\n\n" +
                    "Use the Setup Wizard to create one, or add it manually:\n" +
                    "  Component \u2192 Gatrix \u2192 Gatrix Behaviour",
                    MessageType.Info);

                EditorGUILayout.Space(4);
                if (GUILayout.Button("Open Setup Wizard", GUILayout.Height(28)))
                {
                    GatrixSetupWindow.ShowWindow();
                }
            }
        }

        private static string TruncateMiddle(string text, int maxLength)
        {
            if (text == null || text.Length <= maxLength) return text;
            int half = (maxLength - 3) / 2;
            return text.Substring(0, half) + "..." + text.Substring(text.Length - half);
        }

        // ==================== Toolbar ====================

        private void DrawToolbar()
        {
            EditorGUILayout.BeginHorizontal(EditorStyles.toolbar);

            var tabNames = new[] { "Overview", "Flags", "Events", "Context", "Metrics", "Stats" };
            for (int i = 0; i < tabNames.Length; i++)
            {
                var isActive = (int)_currentTab == i;
                var style = isActive
                    ? new GUIStyle(EditorStyles.toolbarButton)
                    {
                        fontStyle = FontStyle.Bold,
                        normal = { textColor = new Color(0.4f, 0.7f, 1f) }
                    }
                    : EditorStyles.toolbarButton;

                if (GUILayout.Button(tabNames[i], style, GUILayout.Width(66)))
                {
                    _currentTab = (Tab)i;
                }
            }

            GUILayout.FlexibleSpace();

            // Auto-refresh toggle
            var refreshIcon = _autoRefresh ? "● Auto" : "○ Auto";
            var refreshColor = _autoRefresh ? new Color(0.4f, 1f, 0.4f) : new Color(0.7f, 0.7f, 0.7f);
            var refreshStyle = new GUIStyle(EditorStyles.toolbarButton)
            {
                normal = { textColor = refreshColor }
            };
            if (GUILayout.Button(refreshIcon, refreshStyle, GUILayout.Width(50)))
            {
                _autoRefresh = !_autoRefresh;
            }

            if (GUILayout.Button("Refresh", EditorStyles.toolbarButton, GUILayout.Width(55)))
            {
                RefreshData();
                Repaint();
            }

            // Play mode controls: Pause / Stop
            if (EditorApplication.isPlaying)
            {
                // Separator
                GUILayout.Space(4);
                var sepRect = GUILayoutUtility.GetRect(1, 16, GUILayout.Width(1));
                EditorGUI.DrawRect(sepRect, new Color(0.5f, 0.5f, 0.5f, 0.5f));
                GUILayout.Space(4);

                // Pause button
                var isPaused = EditorApplication.isPaused;
                var pauseStyle = new GUIStyle(EditorStyles.toolbarButton)
                {
                    normal = { textColor = isPaused ? new Color(1f, 0.85f, 0.3f) : Color.white }
                };
                if (GUILayout.Button(isPaused ? "\u25ae\u25ae Paused" : "\u25ae\u25ae", pauseStyle, GUILayout.Width(isPaused ? 60 : 24)))
                {
                    EditorApplication.isPaused = !EditorApplication.isPaused;
                }

                // Stop button
                var stopStyle = new GUIStyle(EditorStyles.toolbarButton)
                {
                    normal = { textColor = new Color(1f, 0.4f, 0.4f) }
                };
                if (GUILayout.Button("\u25a0", stopStyle, GUILayout.Width(24)))
                {
                    EditorApplication.isPlaying = false;
                }
            }

            EditorGUILayout.EndHorizontal();
        }

        // ==================== Helpers ====================

        private void DrawSeparator()
        {
            EditorGUILayout.Space(3);
            var rect = GUILayoutUtility.GetRect(0, 1, GUILayout.ExpandWidth(true));
            EditorGUI.DrawRect(rect, new Color(0.5f, 0.5f, 0.5f, 0.2f));
            EditorGUILayout.Space(3);
        }

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

        private void DrawFieldWithStrikethrough(string label, string value, bool strikethrough)
        {
            EditorGUILayout.BeginHorizontal();
            EditorGUILayout.LabelField(label, GUILayout.Width(150));

            if (strikethrough)
            {
                // Draw dimmed text
                var dimStyle = new GUIStyle(_statusLabelStyle)
                {
                    normal = { textColor = new Color(0.5f, 0.5f, 0.5f, 0.5f) }
                };
                var valueRect = GUILayoutUtility.GetRect(
                    new GUIContent(value), dimStyle, GUILayout.ExpandWidth(true));
                EditorGUI.LabelField(valueRect, value, dimStyle);

                // Draw strikethrough line across value area
                var lineY = valueRect.y + valueRect.height * 0.5f;
                var lineRect = new Rect(valueRect.x, lineY, valueRect.width * 0.6f, 1);
                EditorGUI.DrawRect(lineRect, new Color(0.6f, 0.6f, 0.6f, 0.5f));
            }
            else
            {
                EditorGUILayout.LabelField(value, _statusLabelStyle);
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

        private void DrawClickableField(string label, string value, UnityEngine.Object target)
        {
            EditorGUILayout.BeginHorizontal();
            EditorGUILayout.LabelField(label, GUILayout.Width(150));

            var linkStyle = new GUIStyle(EditorStyles.label)
            {
                normal = { textColor = new Color(0.4f, 0.7f, 1f) },
                hover  = { textColor = new Color(0.5f, 0.8f, 1f) }
            };
            var valueRect = GUILayoutUtility.GetRect(new GUIContent(value), linkStyle, GUILayout.ExpandWidth(true));
            EditorGUIUtility.AddCursorRect(valueRect, MouseCursor.Link);
            GUI.Label(valueRect, value, linkStyle);

            if (Event.current.type == EventType.MouseDown && valueRect.Contains(Event.current.mousePosition) && target != null)
            {
                EditorGUIUtility.PingObject(target);
                Selection.activeObject = target;
                Event.current.Use();
            }
            EditorGUILayout.EndHorizontal();
        }

        private static string FormatEventDetails(string eventName, object[] args)
        {
            if (args == null || args.Length == 0) return "";

            var arg0 = args[0];
            if (arg0 == null) return "";

            // List<EvaluatedFlag> — flags.change, flags.ready, etc.
            if (arg0 is List<EvaluatedFlag> flagList)
            {
                if (flagList.Count == 0) return "0 flags";
                var names = new List<string>();
                for (int i = 0; i < Math.Min(flagList.Count, 5); i++)
                    names.Add(flagList[i].Name ?? "?");
                var summary = string.Join(", ", names);
                if (flagList.Count > 5) summary += ", ...";
                return $"{flagList.Count} flags: {summary}";
            }

            // ErrorEvent — errors
            if (arg0 is ErrorEvent errorEvt)
            {
                var parts = new List<string>();
                if (!string.IsNullOrEmpty(errorEvt.Type)) parts.Add(errorEvt.Type);
                if (errorEvt.Code.HasValue) parts.Add($"code={errorEvt.Code.Value}");
                if (errorEvt.Error != null) parts.Add(errorEvt.Error.Message);
                return parts.Count > 0 ? string.Join(" | ", parts) : "error";
            }

            // FlagsChangedEvent — streaming invalidation
            if (arg0 is FlagsChangedEvent changedEvt)
            {
                var keys = changedEvt.ChangedKeys;
                var keysSummary = keys != null && keys.Count > 0
                    ? string.Join(", ", keys.Count <= 5 ? keys : keys.GetRange(0, 5))
                      + (keys.Count > 5 ? ", ..." : "")
                    : "none";
                return $"rev={changedEvt.GlobalRevision}, keys=[{keysSummary}]";
            }

            // StreamingConnectedEvent
            if (arg0 is StreamingConnectedEvent connEvt)
            {
                return $"rev={connEvt.GlobalRevision}";
            }

            // ImpressionEvent
            if (arg0 is ImpressionEvent impEvt)
            {
                return $"{impEvt.FeatureName} ({impEvt.EventType})";
            }

            // string[] — removed flags
            if (arg0 is string[] strArr)
            {
                return strArr.Length > 0 ? string.Join(", ", strArr) : "";
            }

            // EvaluatedFlag — per-flag change
            if (arg0 is EvaluatedFlag singleFlag)
            {
                var variant = singleFlag.Variant?.Name ?? "-";
                var changeType = args.Length > 2 ? args[2]?.ToString() : "";
                return $"{singleFlag.Name}: enabled={singleFlag.Enabled}, variant={variant}" +
                       (!string.IsNullOrEmpty(changeType) ? $" ({changeType})" : "");
            }

            // int args — reconnecting (attempt, delayMs)
            if (arg0 is int intVal)
            {
                if (args.Length >= 2 && args[1] is int delayMs)
                    return $"attempt={intVal}, delay={delayMs}ms";
                return intVal.ToString();
            }

            // string — etag, simple messages
            if (arg0 is string strVal)
            {
                return strVal;
            }

            // Generic IList fallback
            if (arg0 is System.Collections.IList list)
            {
                return $"{list.Count} items";
            }

            // Last resort — use type name only if ToString() returns type name
            var str = arg0.ToString();
            var typeName = arg0.GetType().FullName;
            return str == typeName ? arg0.GetType().Name : str;
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

        // ==================== Data Refresh ====================

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

            // Collect time-series data points (1 sample per RefreshInterval)
            CollectTimeSeriesData(_cachedStats);
        }

        // ==================== Event Listening ====================

        private void StartListening()
        {
            if (_isListening) return;

            var client = GatrixBehaviour.Client;
            if (client == null) return;

            _eventListener = (eventName, args) =>
            {
                var details = FormatEventDetails(eventName, args);
                if (details.Length > 150) details = details.Substring(0, 147) + "...";

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

                // Immediately refresh data when flags or streaming state changes
                if (eventName == GatrixEvents.FlagsChange ||
                    eventName == GatrixEvents.FlagsFetchEnd ||
                    eventName == GatrixEvents.FlagsPendingSync ||
                    eventName == GatrixEvents.FlagsStreamingConnected ||
                    eventName == GatrixEvents.FlagsStreamingDisconnected)
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

        // ==================== Inner Types ====================

        /// <summary>Lightweight snapshot for change detection</summary>
        private struct FlagSnapshot
        {
            public bool Enabled;
            public string VariantName;
            public string VariantValue;
            public int Version;
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
