// GatrixSettingsInspector - Custom inspector for GatrixSettings ScriptableObject
// Provides organized, color-coded sections matching GatrixBehaviour inspector style

#if UNITY_EDITOR
using System.Collections.Generic;
using UnityEditor;
using UnityEngine;

namespace Gatrix.Unity.SDK.Editor
{
    [CustomEditor(typeof(GatrixSettings))]
    public class GatrixSettingsInspector : UnityEditor.Editor
    {
        // Section foldout states
        private bool _showRequired = true;
        private bool _showContext = true;
        private bool _showGeneral = true;
        private bool _showBootstrap = false;
        private bool _showMetrics = false;
        private bool _showNetwork = true;

        // SerializedProperties
        private SerializedProperty _apiUrl;
        private SerializedProperty _apiToken;
        private SerializedProperty _appName;
        private SerializedProperty _environment;
        private SerializedProperty _userId;
        private SerializedProperty _sessionId;
        private SerializedProperty _contextProperties;
        private SerializedProperty _offlineMode;
        private SerializedProperty _enableDevMode;
        private SerializedProperty _cacheKeyPrefix;
        private SerializedProperty _impressionDataAll;
        private SerializedProperty _bootstrapJson;
        private SerializedProperty _bootstrapOverride;
        private SerializedProperty _refreshInterval;
        private SerializedProperty _disableRefresh;
        private SerializedProperty _explicitSyncMode;
        private SerializedProperty _disableMetrics;
        private SerializedProperty _metricsIntervalInitial;
        private SerializedProperty _metricsInterval;
        private SerializedProperty _fetchRetryLimit;
        private SerializedProperty _fetchTimeout;
        private SerializedProperty _initialBackoff;
        private SerializedProperty _maxBackoff;
        private SerializedProperty _streamingEnabled;
        private SerializedProperty _streamingTransport;
        private SerializedProperty _sseUrl;
        private SerializedProperty _sseReconnectBase;
        private SerializedProperty _sseReconnectMax;
        private SerializedProperty _ssePollingJitter;
        private SerializedProperty _wsUrl;
        private SerializedProperty _wsReconnectBase;
        private SerializedProperty _wsReconnectMax;
        private SerializedProperty _wsPingInterval;

        private void OnEnable()
        {
            _apiUrl = serializedObject.FindProperty("_apiUrl");
            _apiToken = serializedObject.FindProperty("_apiToken");
            _appName = serializedObject.FindProperty("_appName");
            _environment = serializedObject.FindProperty("_environment");
            _userId = serializedObject.FindProperty("_userId");
            _sessionId = serializedObject.FindProperty("_sessionId");
            _contextProperties = serializedObject.FindProperty("_contextProperties");
            _offlineMode = serializedObject.FindProperty("_offlineMode");
            _enableDevMode = serializedObject.FindProperty("_enableDevMode");
            _cacheKeyPrefix = serializedObject.FindProperty("_cacheKeyPrefix");
            _impressionDataAll = serializedObject.FindProperty("_impressionDataAll");
            _bootstrapJson = serializedObject.FindProperty("_bootstrapJson");
            _bootstrapOverride = serializedObject.FindProperty("_bootstrapOverride");
            _refreshInterval = serializedObject.FindProperty("_refreshInterval");
            _disableRefresh = serializedObject.FindProperty("_disableRefresh");
            _explicitSyncMode = serializedObject.FindProperty("_explicitSyncMode");
            _disableMetrics = serializedObject.FindProperty("_disableMetrics");
            _metricsIntervalInitial = serializedObject.FindProperty("_metricsIntervalInitial");
            _metricsInterval = serializedObject.FindProperty("_metricsInterval");
            _fetchRetryLimit = serializedObject.FindProperty("_fetchRetryLimit");
            _fetchTimeout = serializedObject.FindProperty("_fetchTimeout");
            _initialBackoff = serializedObject.FindProperty("_initialBackoff");
            _maxBackoff = serializedObject.FindProperty("_maxBackoff");
            _streamingEnabled = serializedObject.FindProperty("_streamingEnabled");
            _streamingTransport = serializedObject.FindProperty("_streamingTransport");
            _sseUrl = serializedObject.FindProperty("_sseUrl");
            _sseReconnectBase = serializedObject.FindProperty("_sseReconnectBase");
            _sseReconnectMax = serializedObject.FindProperty("_sseReconnectMax");
            _ssePollingJitter = serializedObject.FindProperty("_ssePollingJitter");
            _wsUrl = serializedObject.FindProperty("_wsUrl");
            _wsReconnectBase = serializedObject.FindProperty("_wsReconnectBase");
            _wsReconnectMax = serializedObject.FindProperty("_wsReconnectMax");
            _wsPingInterval = serializedObject.FindProperty("_wsPingInterval");
        }

        public override void OnInspectorGUI()
        {
            serializedObject.Update();

            DrawTitleBar();

            // Validation status
            var settings = (GatrixSettings)target;
            if (!settings.IsValid(out var validationError))
            {
                EditorGUILayout.Space(2);
                EditorGUILayout.HelpBox(validationError, MessageType.Warning);
                EditorGUILayout.Space(2);
            }

            // ── Required ──
            _showRequired = DrawCollapsibleSectionBar("  Connection", _showRequired, null, GatrixEditorStyle.AccentBlue);
            if (_showRequired)
            {
                GatrixEditorStyle.BeginBox();
                DrawRequiredField(_apiUrl, "API URL");
                DrawRequiredField(_apiToken, "API Token");
                DrawRequiredField(_appName, "App Name");
                DrawRequiredField(_environment, "Environment");
                GatrixEditorStyle.EndBox();
            }

            // ── Context ──
            _showContext = DrawCollapsibleSectionBar("  Initial Context", _showContext,
                _contextProperties.arraySize > 0 ? $"{_contextProperties.arraySize} props" : "(optional)",
                GatrixEditorStyle.AccentTeal);
            if (_showContext)
            {
                GatrixEditorStyle.BeginBox();
                EditorGUILayout.PropertyField(_userId, new GUIContent("User ID"));
                EditorGUILayout.PropertyField(_sessionId, new GUIContent("Session ID"));

                EditorGUILayout.Space(4);
                DrawSubSectionLabel("Custom Properties");
                DrawContextPropertiesList();
                GatrixEditorStyle.EndBox();
            }

            // ── Bootstrap ──
            string bootstrapBadge = string.IsNullOrWhiteSpace(_bootstrapJson.stringValue) ? null : "configured";
            _showBootstrap = DrawCollapsibleSectionBar("  Bootstrap", _showBootstrap, bootstrapBadge, new Color(0.80f, 0.60f, 0.20f));
            if (_showBootstrap)
            {
                GatrixEditorStyle.BeginBox();
                EditorGUILayout.PropertyField(_bootstrapJson, new GUIContent("Bootstrap JSON"));
                EditorGUILayout.PropertyField(_bootstrapOverride, new GUIContent("Override Cached Flags"));

                if (!string.IsNullOrWhiteSpace(_bootstrapJson.stringValue))
                {
                    try
                    {
                        var flags = GatrixJson.DeserializeFlags(_bootstrapJson.stringValue);
                        if (flags != null && flags.Count > 0)
                        {
                            EditorGUILayout.HelpBox(
                                $"{flags.Count} flag(s) configured. These will be used as initial values before the first server fetch.",
                                MessageType.Info);
                        }
                        else
                        {
                            EditorGUILayout.HelpBox(
                                "JSON parsed but no flags found. Ensure JSON is an array of flag objects.",
                                MessageType.Warning);
                        }
                    }
                    catch (System.Exception ex)
                    {
                        EditorGUILayout.HelpBox(
                            $"Invalid JSON: {ex.Message}",
                            MessageType.Error);
                    }
                }

                EditorGUILayout.Space(4);
                DrawBootstrapFillButtons();

                GatrixEditorStyle.EndBox();
            }

            // ── General ──
            _showGeneral = DrawCollapsibleSectionBar("  General", _showGeneral, null, GatrixEditorStyle.AccentGreen);
            if (_showGeneral)
            {
                GatrixEditorStyle.BeginBox();
                EditorGUILayout.PropertyField(_offlineMode, new GUIContent("Offline Mode"));
                EditorGUILayout.PropertyField(_enableDevMode, new GUIContent("Dev Mode (Verbose Logs)"));
                EditorGUILayout.PropertyField(_cacheKeyPrefix, new GUIContent("Cache Key Prefix"));
                EditorGUILayout.PropertyField(_impressionDataAll, new GUIContent("Track All Impressions"));
                EditorGUILayout.PropertyField(_explicitSyncMode, new GUIContent("Explicit Sync Mode"));

                if (_explicitSyncMode.boolValue)
                {
                    EditorGUILayout.Space(2);
                    EditorGUILayout.HelpBox(
                        "In explicit sync mode, flag changes are buffered until you call SyncFlagsAsync().",
                        MessageType.Info);
                }
                GatrixEditorStyle.EndBox();
            }

            // ── Metrics ──
            _showMetrics = DrawCollapsibleSectionBar("  Metrics", _showMetrics, null, new Color(0.60f, 0.40f, 0.90f));
            if (_showMetrics)
            {
                GatrixEditorStyle.BeginBox();
                EditorGUILayout.PropertyField(_disableMetrics, new GUIContent("Disable Metrics"));

                using (new EditorGUI.DisabledGroupScope(_disableMetrics.boolValue))
                {
                    EditorGUILayout.PropertyField(_metricsIntervalInitial, new GUIContent("Initial Delay (s)"));
                    EditorGUILayout.PropertyField(_metricsInterval, new GUIContent("Send Interval (s)"));
                }
                GatrixEditorStyle.EndBox();
            }

            // ── Network (Polling + Retry + Streaming) ──
            _showNetwork = DrawCollapsibleSectionBar("  Network", _showNetwork, null, new Color(0.85f, 0.55f, 0.20f));
            if (_showNetwork)
            {
                GatrixEditorStyle.BeginBox();

                // Polling sub-section
                DrawSubSectionLabel("Polling");
                EditorGUILayout.PropertyField(_refreshInterval, new GUIContent("Refresh Interval (s)"));
                EditorGUILayout.PropertyField(_disableRefresh, new GUIContent("Disable Auto Refresh"));

                EditorGUILayout.Space(6);

                // Retry & Timeout sub-section
                DrawSubSectionLabel("Retry & Timeout");
                EditorGUILayout.PropertyField(_fetchRetryLimit, new GUIContent("Retry Limit"));
                EditorGUILayout.PropertyField(_fetchTimeout, new GUIContent("Timeout (s)"));
                EditorGUILayout.PropertyField(_initialBackoff, new GUIContent("Initial Backoff (s)"));
                EditorGUILayout.PropertyField(_maxBackoff, new GUIContent("Max Backoff (s)"));

                EditorGUILayout.Space(6);

                // Streaming sub-section
                DrawSubSectionLabel("Streaming");
                EditorGUILayout.PropertyField(_streamingEnabled, new GUIContent("Enabled"));

                using (new EditorGUI.DisabledGroupScope(!_streamingEnabled.boolValue))
                {
                    EditorGUILayout.PropertyField(_streamingTransport, new GUIContent("Transport"));

                    var transport = (StreamingTransport)_streamingTransport.enumValueIndex;

                    EditorGUILayout.Space(4);

                    if (transport == StreamingTransport.Sse)
                    {
                        DrawSubSectionLabel("SSE Configuration");
                        EditorGUILayout.PropertyField(_sseUrl, new GUIContent("URL Override"));
                        EditorGUILayout.PropertyField(_sseReconnectBase, new GUIContent("Reconnect Base (s)"));
                        EditorGUILayout.PropertyField(_sseReconnectMax, new GUIContent("Reconnect Max (s)"));
                        EditorGUILayout.PropertyField(_ssePollingJitter, new GUIContent("Polling Jitter (s)"));
                    }
                    else
                    {
                        DrawSubSectionLabel("WebSocket Configuration");
                        EditorGUILayout.PropertyField(_wsUrl, new GUIContent("URL Override"));
                        EditorGUILayout.PropertyField(_wsReconnectBase, new GUIContent("Reconnect Base (s)"));
                        EditorGUILayout.PropertyField(_wsReconnectMax, new GUIContent("Reconnect Max (s)"));
                        EditorGUILayout.PropertyField(_wsPingInterval, new GUIContent("Ping Interval (s)"));

#if UNITY_WEBGL
                        EditorGUILayout.Space(2);
                        EditorGUILayout.HelpBox(
                            "WebGL: uses browser native WebSocket via JS interop (GatrixWebSocket.jslib).",
                            MessageType.Info);
#endif
                    }
                }
                GatrixEditorStyle.EndBox();
            }

            serializedObject.ApplyModifiedProperties();
        }

        // ==================== Title Bar ====================

        private void DrawTitleBar()
        {
            bool isDark = EditorGUIUtility.isProSkin;
            float fullWidth = EditorGUIUtility.currentViewWidth;

            var rect = GUILayoutUtility.GetRect(0, 48, GUILayout.ExpandWidth(true));

            if (Event.current.type == EventType.Repaint)
            {
                EditorGUI.DrawRect(new Rect(0, rect.y, fullWidth, rect.height),
                    isDark ? new Color(0.12f, 0.12f, 0.14f, 1f) : new Color(0.80f, 0.80f, 0.82f, 1f));
                EditorGUI.DrawRect(new Rect(0, rect.y, 5, rect.height), GatrixEditorStyle.AccentBlue);
                EditorGUI.DrawRect(new Rect(0, rect.yMax - 1, fullWidth, 1),
                    new Color(GatrixEditorStyle.AccentBlue.r, GatrixEditorStyle.AccentBlue.g, GatrixEditorStyle.AccentBlue.b, 0.6f));
            }

            // Diamond icon
            var iconStyle = new GUIStyle(EditorStyles.boldLabel)
            {
                fontSize = 14,
                alignment = TextAnchor.MiddleCenter,
                normal = { textColor = GatrixEditorStyle.AccentBlue }
            };
            GUI.Label(new Rect(rect.x + 10, rect.y, 20, rect.height), "\u25c6", iconStyle);

            // Title
            var nameStyle = new GUIStyle(EditorStyles.boldLabel)
            {
                fontSize = 13,
                alignment = TextAnchor.UpperLeft,
                normal = { textColor = Color.white }
            };
            GUI.Label(new Rect(rect.x + 34, rect.y + 8, rect.width - 130, 20), "GATRIX SETTINGS", nameStyle);

            // Subtitle
            var subStyle = new GUIStyle(EditorStyles.miniLabel)
            {
                normal = { textColor = new Color(0.60f, 0.75f, 1f) }
            };
            GUI.Label(new Rect(rect.x + 34, rect.y + 27, rect.width - 130, 14), "SDK Configuration Asset", subStyle);

            // Validation badge
            var settings = (GatrixSettings)target;
            bool isValid = settings.IsValid(out _);
            var badgeColor = isValid
                ? new Color(0.10f, 0.55f, 0.20f, 0.85f)
                : new Color(0.65f, 0.40f, 0.10f, 0.85f);
            var badgeText = isValid ? "\u2713  VALID" : "\u26a0  INCOMPLETE";
            var badgeTextColor = isValid ? new Color(0.55f, 1f, 0.60f) : new Color(1f, 0.85f, 0.4f);

            var badgeRect = new Rect(rect.xMax - 95, rect.y + (rect.height - 18) / 2f, 85, 18);
            if (Event.current.type == EventType.Repaint)
                EditorGUI.DrawRect(badgeRect, badgeColor);
            var badgeStyle = new GUIStyle(EditorStyles.miniLabel)
            {
                fontStyle = FontStyle.Bold,
                alignment = TextAnchor.MiddleCenter,
                normal = { textColor = badgeTextColor }
            };
            GUI.Label(badgeRect, badgeText, badgeStyle);

            EditorGUILayout.Space(4);
        }

        // ==================== Collapsible Section Bar ====================

        private static bool DrawCollapsibleSectionBar(string title, bool expanded, string badge, Color accentColor)
        {
            bool isDark = EditorGUIUtility.isProSkin;
            float fullWidth = EditorGUIUtility.currentViewWidth;

            var rect = GUILayoutUtility.GetRect(0, 24, GUILayout.ExpandWidth(true));

            if (Event.current.type == EventType.Repaint)
            {
                EditorGUI.DrawRect(new Rect(0, rect.y, fullWidth, rect.height),
                    isDark ? new Color(0.17f, 0.17f, 0.19f, 1f) : new Color(0.75f, 0.75f, 0.77f, 1f));
                EditorGUI.DrawRect(new Rect(0, rect.y, 4, rect.height), accentColor);
                EditorGUI.DrawRect(new Rect(0, rect.yMax - 1, fullWidth, 1),
                    new Color(accentColor.r, accentColor.g, accentColor.b, 0.4f));
            }

            // Arrow
            var arrowStyle = new GUIStyle(EditorStyles.miniLabel)
            {
                fontSize = 10,
                normal = { textColor = isDark ? new Color(0.50f, 0.55f, 0.60f) : new Color(0.40f, 0.42f, 0.45f) }
            };
            GUI.Label(new Rect(rect.x + 8, rect.y + 2, 16, rect.height), expanded ? "\u25bc" : "\u25b6", arrowStyle);

            // Title
            var titleStyle = new GUIStyle(EditorStyles.boldLabel)
            {
                fontSize = 11,
                normal = { textColor = isDark ? new Color(0.80f, 0.82f, 0.85f) : new Color(0.15f, 0.17f, 0.20f) }
            };
            GUI.Label(new Rect(rect.x + 22, rect.y + 3, rect.width - 100, 18), title, titleStyle);

            // Badge
            if (!string.IsNullOrEmpty(badge))
            {
                var badgeStyle = new GUIStyle(EditorStyles.miniLabel)
                {
                    normal = { textColor = isDark ? new Color(0.45f, 0.50f, 0.55f) : new Color(0.50f, 0.53f, 0.56f) }
                };
                var badgeSize = badgeStyle.CalcSize(new GUIContent(badge));
                GUI.Label(new Rect(rect.xMax - badgeSize.x - 10, rect.y + 4, badgeSize.x, 16), badge, badgeStyle);
            }

            // Click to toggle
            if (Event.current.type == EventType.MouseDown && rect.Contains(Event.current.mousePosition))
            {
                expanded = !expanded;
                Event.current.Use();
            }

            return expanded;
        }

        // ==================== Helpers ====================

        private static void DrawRequiredField(SerializedProperty property, string label)
        {
            EditorGUILayout.BeginHorizontal();

            bool isEmpty = string.IsNullOrWhiteSpace(property.stringValue);
            if (isEmpty)
            {
                var oldColor = GUI.color;
                GUI.color = new Color(1f, 0.85f, 0.4f);
                EditorGUILayout.PropertyField(property, new GUIContent(label + " *"));
                GUI.color = oldColor;
            }
            else
            {
                EditorGUILayout.PropertyField(property, new GUIContent(label));
            }

            EditorGUILayout.EndHorizontal();
        }

        private static void DrawSubSectionLabel(string text)
        {
            bool isDark = EditorGUIUtility.isProSkin;
            var style = new GUIStyle(EditorStyles.miniLabel)
            {
                fontStyle = FontStyle.Bold,
                fontSize = 10,
                normal = { textColor = isDark ? new Color(0.50f, 0.65f, 0.90f) : new Color(0.20f, 0.35f, 0.65f) }
            };
            EditorGUILayout.LabelField(text, style);
        }

        // ==================== Context Properties List ====================

        private void DrawContextPropertiesList()
        {
            int removeIndex = -1;
            var duplicateKeys = new HashSet<string>();
            var seenKeys = new HashSet<string>();

            // Detect duplicates
            for (int i = 0; i < _contextProperties.arraySize; i++)
            {
                var element = _contextProperties.GetArrayElementAtIndex(i);
                var key = element.FindPropertyRelative("Key").stringValue;
                if (!string.IsNullOrWhiteSpace(key))
                {
                    if (!seenKeys.Add(key))
                        duplicateKeys.Add(key);
                }
            }

            // Draw each property row
            for (int i = 0; i < _contextProperties.arraySize; i++)
            {
                var element = _contextProperties.GetArrayElementAtIndex(i);
                var keyProp = element.FindPropertyRelative("Key");
                var valueProp = element.FindPropertyRelative("Value");
                var typeProp = element.FindPropertyRelative("Type");

                EditorGUILayout.BeginHorizontal();

                // Key field
                var keyValue = keyProp.stringValue;
                bool isDuplicate = !string.IsNullOrWhiteSpace(keyValue) && duplicateKeys.Contains(keyValue);
                if (isDuplicate)
                {
                    var oldColor = GUI.color;
                    GUI.color = new Color(1f, 0.6f, 0.4f);
                    EditorGUILayout.PropertyField(keyProp, GUIContent.none, GUILayout.Width(100));
                    GUI.color = oldColor;
                }
                else
                {
                    EditorGUILayout.PropertyField(keyProp, GUIContent.none, GUILayout.Width(100));
                }

                // Type dropdown
                EditorGUILayout.PropertyField(typeProp, GUIContent.none, GUILayout.Width(65));

                // Value field — show appropriate input based on type
                var propType = (ContextPropertyType)typeProp.enumValueIndex;
                switch (propType)
                {
                    case ContextPropertyType.Boolean:
                        bool boolVal = string.Equals(valueProp.stringValue, "true", System.StringComparison.OrdinalIgnoreCase)
                                       || valueProp.stringValue == "1";
                        bool newBoolVal = EditorGUILayout.Toggle(boolVal);
                        if (newBoolVal != boolVal)
                            valueProp.stringValue = newBoolVal ? "true" : "false";
                        break;
                    default:
                        EditorGUILayout.PropertyField(valueProp, GUIContent.none);
                        break;
                }

                // Remove button
                if (GUILayout.Button("✕", GUILayout.Width(22), GUILayout.Height(18)))
                {
                    removeIndex = i;
                }

                EditorGUILayout.EndHorizontal();
            }

            // Remove deferred
            if (removeIndex >= 0)
            {
                _contextProperties.DeleteArrayElementAtIndex(removeIndex);
            }

            // Duplicate key warning
            if (duplicateKeys.Count > 0)
            {
                EditorGUILayout.HelpBox(
                    $"Duplicate key(s) detected: {string.Join(", ", duplicateKeys)}. Only the last value will be used.",
                    MessageType.Warning);
            }

            // Add button
            EditorGUILayout.BeginHorizontal();
            GUILayout.FlexibleSpace();
            if (GUILayout.Button("+ Add Property", GUILayout.Width(120)))
            {
                _contextProperties.InsertArrayElementAtIndex(_contextProperties.arraySize);
                var newElement = _contextProperties.GetArrayElementAtIndex(_contextProperties.arraySize - 1);
                newElement.FindPropertyRelative("Key").stringValue = "";
                newElement.FindPropertyRelative("Value").stringValue = "";
                newElement.FindPropertyRelative("Type").enumValueIndex = 0; // String
            }
            EditorGUILayout.EndHorizontal();

            if (_contextProperties.arraySize == 0)
            {
                var hintStyle = new GUIStyle(EditorStyles.miniLabel)
                {
                    fontStyle = FontStyle.Italic,
                    alignment = TextAnchor.MiddleCenter,
                    normal = { textColor = new Color(0.5f, 0.5f, 0.5f) }
                };
                EditorGUILayout.LabelField("No custom properties configured", hintStyle);
            }
        }

        // ==================== Bootstrap Fill ====================

        /// <summary>
        /// Draws action buttons for populating bootstrap JSON from cached or live data.
        /// </summary>
        private void DrawBootstrapFillButtons()
        {
            DrawSubSectionLabel("Quick Fill");

            EditorGUILayout.BeginHorizontal();

            // Fill from PlayerPrefs cache (works in both Edit and Play mode)
            if (GUILayout.Button("Fill from Cache", GUILayout.Height(22)))
            {
                FillBootstrapFromCache();
            }

            // Fill from live SDK (Play Mode only)
            using (new EditorGUI.DisabledGroupScope(!Application.isPlaying || !GatrixBehaviour.IsInitialized))
            {
                if (GUILayout.Button("Fill from Live SDK", GUILayout.Height(22)))
                {
                    FillBootstrapFromLiveSdk();
                }
            }

            // Clear button
            using (new EditorGUI.DisabledGroupScope(string.IsNullOrWhiteSpace(_bootstrapJson.stringValue)))
            {
                if (GUILayout.Button("Clear", GUILayout.Width(50), GUILayout.Height(22)))
                {
                    _bootstrapJson.stringValue = "";
                }
            }

            EditorGUILayout.EndHorizontal();

            if (!Application.isPlaying)
            {
                EditorGUILayout.HelpBox(
                    "\"Fill from Live SDK\" is only available in Play Mode.",
                    MessageType.None);
            }
        }

        /// <summary>
        /// Reads cached flags from persistent storage via FeaturesClient helper.
        /// </summary>
        private void FillBootstrapFromCache()
        {
            var cachePrefix = string.IsNullOrEmpty(_cacheKeyPrefix.stringValue) ? "gatrix_cache" : _cacheKeyPrefix.stringValue;
            var cachedJson = FeaturesClient.EditorGetCachedFlagsJson(cachePrefix);

            if (string.IsNullOrWhiteSpace(cachedJson))
            {
                EditorUtility.DisplayDialog("Gatrix Bootstrap",
                    "No cached flag data found.\n\nRun the application at least once to populate the cache.",
                    "OK");
                return;
            }

            try
            {
                var flags = GatrixJson.DeserializeFlags(cachedJson);
                if (flags == null || flags.Count == 0)
                {
                    EditorUtility.DisplayDialog("Gatrix Bootstrap",
                        "Cached data parsed but contains no flags.", "OK");
                    return;
                }

                _bootstrapJson.stringValue = GatrixJson.SerializeFlags(flags);
                serializedObject.ApplyModifiedProperties();
                EditorUtility.SetDirty(target);

                Debug.Log($"[Gatrix] Bootstrap filled from cache: {flags.Count} flag(s) loaded.");
            }
            catch (System.Exception ex)
            {
                EditorUtility.DisplayDialog("Gatrix Bootstrap",
                    $"Failed to parse cached data:\n{ex.Message}", "OK");
            }
        }

        /// <summary>
        /// Reads current flags from the live SDK client (Play Mode only).
        /// </summary>
        private void FillBootstrapFromLiveSdk()
        {
            if (!Application.isPlaying || !GatrixBehaviour.IsInitialized)
            {
                EditorUtility.DisplayDialog("Gatrix Bootstrap",
                    "SDK is not initialized. Enter Play Mode first.", "OK");
                return;
            }

            var client = GatrixBehaviour.Client;
            if (client == null)
            {
                EditorUtility.DisplayDialog("Gatrix Bootstrap",
                    "SDK client is null.", "OK");
                return;
            }

            var flags = client.Features.GetAllFlags();
            if (flags == null || flags.Count == 0)
            {
                EditorUtility.DisplayDialog("Gatrix Bootstrap",
                    "No flags available from the live SDK.", "OK");
                return;
            }

            _bootstrapJson.stringValue = GatrixJson.SerializeFlags(flags);
            serializedObject.ApplyModifiedProperties();
            EditorUtility.SetDirty(target);

            Debug.Log($"[Gatrix] Bootstrap filled from live SDK: {flags.Count} flag(s) loaded.");
        }
    }
}
#endif
