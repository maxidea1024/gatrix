// GatrixSetupWindow - Editor window for initial SDK setup

#if UNITY_EDITOR
using System.Collections.Generic;
using UnityEditor;
using UnityEngine;

namespace Gatrix.Unity.SDK.Editor
{
    public class GatrixSetupWindow : EditorWindow
    {
        private string _apiUrl      = "";
        private string _apiToken    = "";
        private string _appName     = "";
        private string _environment = "development";

        private bool   _showContext;
        private string _userId    = "";
        private string _sessionId = "";
        private List<ContextPropertyEntry> _contextProperties = new List<ContextPropertyEntry>();

        // Local entry for setup wizard (not serialized to asset yet)
        private class ContextPropertyEntry
        {
            public string Key = "";
            public string Value = "";
            public ContextPropertyType Type = ContextPropertyType.String;
        }

        private bool _showAdvanced;
        private bool _enableDevMode;
        private bool _offlineMode;
        private int  _refreshInterval  = 30;
        private bool _streamingEnabled = true;
        private StreamingTransport _streamingTransport = StreamingTransport.Sse;

        private Vector2 _scrollPos;
        private GatrixSettings _existingSettings;
        private bool _pendingClearExisting;

        [MenuItem("Window/Gatrix/Setup Wizard", priority = 1)]
        public static void ShowWindow()
        {
            var window = GetWindow<GatrixSetupWindow>("Gatrix Setup");
            window.minSize = new Vector2(450, 500);
            window.Show();
        }

        private void OnEnable()
        {
            var guids = AssetDatabase.FindAssets("t:GatrixSettings");
            if (guids.Length > 0)
            {
                var path = AssetDatabase.GUIDToAssetPath(guids[0]);
                _existingSettings = AssetDatabase.LoadAssetAtPath<GatrixSettings>(path);
            }
        }

        private void OnGUI()
        {
            if (_pendingClearExisting)
            {
                _pendingClearExisting = false;
                _existingSettings     = null;
            }

            bool isDark = EditorGUIUtility.isProSkin;

            // ── Title Bar (fixed 40px) ────────────────────────────
            var titleRect = EditorGUILayout.GetControlRect(false, 40);
            if (Event.current.type == EventType.Repaint)
            {
                float fw = EditorGUIUtility.currentViewWidth;
                EditorGUI.DrawRect(new Rect(0, titleRect.y, fw, titleRect.height),
                    isDark ? new Color(0.13f, 0.13f, 0.15f) : new Color(0.80f, 0.80f, 0.82f));
                EditorGUI.DrawRect(new Rect(0, titleRect.y, 4, titleRect.height), GatrixEditorStyle.AccentBlue);
                EditorGUI.DrawRect(new Rect(0, titleRect.yMax - 1, fw, 1),
                    new Color(GatrixEditorStyle.AccentBlue.r, GatrixEditorStyle.AccentBlue.g, GatrixEditorStyle.AccentBlue.b, 0.4f));
            }
            var ts1 = new GUIStyle(EditorStyles.boldLabel) { fontSize = 12 };
            ts1.normal.textColor = isDark ? Color.white : new Color(0.05f, 0.05f, 0.05f);
            EditorGUI.LabelField(new Rect(titleRect.x + 12, titleRect.y + 4, titleRect.width - 20, 18),
                "GATRIX SETUP WIZARD", ts1);
            var ts2 = new GUIStyle(EditorStyles.miniLabel);
            ts2.normal.textColor = new Color(0.55f, 0.72f, 1f);
            EditorGUI.LabelField(new Rect(titleRect.x + 12, titleRect.y + 22, titleRect.width - 20, 14),
                "SDK Configuration & Scene Setup", ts2);

            // ── Scroll Content ──────────────────────────────────
            _scrollPos = EditorGUILayout.BeginScrollView(_scrollPos);

            EditorGUILayout.Space(8);
            GatrixEditorStyle.DrawHelpBox(
                "Configure and initialize the Gatrix Feature Flag SDK. " +
                "This wizard creates a settings asset and sets up your scene for zero-code initialization.",
                MessageType.None);
            EditorGUILayout.Space(4);

            if (_existingSettings != null)
            {
                GatrixEditorStyle.DrawHelpBox(
                    "A GatrixSettings asset already exists. You can edit it directly or create a new one.",
                    MessageType.Info);

                EditorGUILayout.Space(4);
                EditorGUILayout.BeginHorizontal();
                if (GUILayout.Button("Select Existing Settings", GUILayout.Height(28)))
                {
                    Selection.activeObject = _existingSettings;
                    EditorGUIUtility.PingObject(_existingSettings);
                }
                if (GUILayout.Button("Create New Settings", GUILayout.Height(28)))
                {
                    _pendingClearExisting = true;
                }
                EditorGUILayout.EndHorizontal();

                EditorGUILayout.Space(8);
                DrawSceneSetup();
            }
            else
            {
                DrawNewSettingsForm();
            }

            EditorGUILayout.EndScrollView();
        }

        // ==================== Section Bar ====================

        private static void DrawSectionBar(string title, Color accentColor)
        {
            bool isDark = EditorGUIUtility.isProSkin;
            EditorGUILayout.Space(6);
            var rect = EditorGUILayout.GetControlRect(false, 22);
            if (Event.current.type == EventType.Repaint)
            {
                EditorGUI.DrawRect(rect,
                    isDark ? new Color(0.18f, 0.18f, 0.20f) : new Color(0.75f, 0.75f, 0.77f));
                EditorGUI.DrawRect(new Rect(rect.x, rect.y, 3, rect.height), accentColor);
                EditorGUI.DrawRect(new Rect(rect.x, rect.yMax - 1, rect.width, 1),
                    new Color(accentColor.r, accentColor.g, accentColor.b, 0.3f));
            }
            var style = new GUIStyle(EditorStyles.boldLabel) { fontSize = 11 };
            style.normal.textColor = isDark ? new Color(0.88f, 0.90f, 0.92f) : new Color(0.08f, 0.10f, 0.12f);
            EditorGUI.LabelField(new Rect(rect.x + 10, rect.y, rect.width - 14, rect.height), title, style);
            EditorGUILayout.Space(4);
        }

        // ==================== Forms ====================

        private void DrawNewSettingsForm()
        {
            DrawSectionBar("Required Settings", GatrixEditorStyle.AccentBlue);

            _apiUrl = EditorGUILayout.TextField(
                new GUIContent("API URL", "Base URL for the Gatrix API"), _apiUrl);
            _apiToken = EditorGUILayout.TextField(
                new GUIContent("API Token", "Client API token from your Gatrix dashboard"), _apiToken);
            _appName = EditorGUILayout.TextField(
                new GUIContent("App Name", "Your application name registered in Gatrix"), _appName);
            _environment = EditorGUILayout.TextField(
                new GUIContent("Environment", "Target environment"), _environment);

            var hasRequired = !string.IsNullOrWhiteSpace(_apiUrl)
                && !string.IsNullOrWhiteSpace(_apiToken)
                && !string.IsNullOrWhiteSpace(_appName)
                && !string.IsNullOrWhiteSpace(_environment);

            if (!hasRequired)
            {
                EditorGUILayout.Space(4);
                GatrixEditorStyle.DrawHelpBox("All required fields must be filled.", MessageType.Warning);
            }

            EditorGUILayout.Space(8);

            _showContext = EditorGUILayout.Foldout(_showContext, "Initial Context (Optional)", true);
            if (_showContext)
            {
                EditorGUI.indentLevel++;
                _userId    = EditorGUILayout.TextField("User ID",    _userId);
                _sessionId = EditorGUILayout.TextField("Session ID", _sessionId);

                EditorGUILayout.Space(4);
                DrawSubSectionLabel("Custom Properties");
                DrawContextPropertiesList();
                EditorGUI.indentLevel--;
            }

            _showAdvanced = EditorGUILayout.Foldout(_showAdvanced, "Advanced Settings", true);
            if (_showAdvanced)
            {
                EditorGUI.indentLevel++;
                _enableDevMode = EditorGUILayout.Toggle("Dev Mode", _enableDevMode);
                _offlineMode = EditorGUILayout.Toggle("Offline Mode", _offlineMode);
                _refreshInterval = EditorGUILayout.IntSlider("Refresh Interval", _refreshInterval, 1, 300);
                _streamingEnabled = EditorGUILayout.Toggle("Streaming", _streamingEnabled);
                if (_streamingEnabled)
                {
                    _streamingTransport = (StreamingTransport)EditorGUILayout.EnumPopup(
                        "Transport", _streamingTransport);
                }
                EditorGUI.indentLevel--;
            }

            EditorGUILayout.Space(8);

            EditorGUI.BeginDisabledGroup(!hasRequired);
            if (GUILayout.Button("Create Settings Asset", GUILayout.Height(32)))
                CreateSettingsAsset();
            EditorGUI.EndDisabledGroup();

            EditorGUILayout.Space(8);
        }

        private void DrawSceneSetup()
        {
            DrawSectionBar("Scene Setup", GatrixEditorStyle.AccentGreen);

            GatrixEditorStyle.DrawHelpBox(
                "Add a GatrixBehaviour component to your scene for automatic SDK initialization.",
                MessageType.None);

            EditorGUILayout.Space(4);

            var existing = FindAnyObjectByType<GatrixBehaviour>();

            if (existing != null)
            {
                GatrixEditorStyle.DrawHelpBox(
                    $"GatrixBehaviour found on \"{existing.gameObject.name}\".",
                    MessageType.Info);

                EditorGUILayout.Space(4);
                if (GUILayout.Button("Select in Scene", GUILayout.Height(28)))
                    Selection.activeGameObject = existing.gameObject;

                if (existing.Settings == null && _existingSettings != null)
                {
                    EditorGUILayout.Space(4);
                    if (GUILayout.Button("Assign Settings Asset", GUILayout.Height(28)))
                    {
                        Undo.RecordObject(existing, "Assign Gatrix Settings");
                        existing.Settings       = _existingSettings;
                        existing.AutoInitialize = true;
                        EditorUtility.SetDirty(existing);
                    }
                }
            }
            else
            {
                if (GUILayout.Button("Add GatrixBehaviour to Scene", GUILayout.Height(32)))
                    AddBehaviourToScene();
            }
        }

        // ==================== Actions ====================

        private void CreateSettingsAsset()
        {
            // Let user choose save location
            var path = EditorUtility.SaveFilePanelInProject(
                "Save Gatrix Settings",
                "GatrixSettings",
                "asset",
                "Choose a location to save the Gatrix Settings asset.",
                "Assets");

            if (string.IsNullOrEmpty(path))
                return; // User cancelled

            var settings = CreateInstance<GatrixSettings>();
            var so       = new SerializedObject(settings);
            so.FindProperty("_apiUrl").stringValue         = _apiUrl;
            so.FindProperty("_apiToken").stringValue       = _apiToken;
            so.FindProperty("_appName").stringValue        = _appName;
            so.FindProperty("_environment").stringValue    = _environment;
            so.FindProperty("_userId").stringValue         = _userId;
            so.FindProperty("_sessionId").stringValue      = _sessionId;
            so.FindProperty("_enableDevMode").boolValue    = _enableDevMode;
            so.FindProperty("_offlineMode").boolValue      = _offlineMode;
            so.FindProperty("_refreshInterval").intValue   = _refreshInterval;
            so.FindProperty("_streamingEnabled").boolValue = _streamingEnabled;
            so.FindProperty("_streamingTransport").enumValueIndex = (int)_streamingTransport;

            // Save context properties
            var ctxProp = so.FindProperty("_contextProperties");
            ctxProp.ClearArray();
            foreach (var entry in _contextProperties)
            {
                if (string.IsNullOrWhiteSpace(entry.Key)) continue;
                ctxProp.InsertArrayElementAtIndex(ctxProp.arraySize);
                var elem = ctxProp.GetArrayElementAtIndex(ctxProp.arraySize - 1);
                elem.FindPropertyRelative("Key").stringValue = entry.Key;
                elem.FindPropertyRelative("Value").stringValue = entry.Value;
                elem.FindPropertyRelative("Type").enumValueIndex = (int)entry.Type;
            }

            so.ApplyModifiedPropertiesWithoutUndo();

            AssetDatabase.CreateAsset(settings, path);
            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();

            _existingSettings      = settings;
            Selection.activeObject = settings;
            EditorGUIUtility.PingObject(settings);

            Debug.Log($"[GatrixSDK] Settings asset created at {path}");
        }

        private void AddBehaviourToScene()
        {
            var go        = new GameObject("[GatrixSDK]");
            var behaviour = go.AddComponent<GatrixBehaviour>();

            if (_existingSettings != null)
            {
                behaviour.Settings       = _existingSettings;
                behaviour.AutoInitialize = true;
            }

            Undo.RegisterCreatedObjectUndo(go, "Add GatrixBehaviour");
            Selection.activeGameObject = go;

            Debug.Log("[GatrixSDK] GatrixBehaviour added to scene.");
        }

        // ==================== Context Properties UI ====================

        private static void DrawSubSectionLabel(string text)
        {
            var style = new GUIStyle(EditorStyles.miniLabel)
            {
                fontStyle = FontStyle.Bold,
                normal = { textColor = EditorGUIUtility.isProSkin
                    ? new Color(0.65f, 0.68f, 0.72f)
                    : new Color(0.30f, 0.33f, 0.38f) }
            };
            EditorGUILayout.LabelField(text, style);
        }

        private void DrawContextPropertiesList()
        {
            int removeIndex = -1;
            var duplicateKeys = new HashSet<string>();
            var seenKeys = new HashSet<string>();

            // Detect duplicates
            foreach (var entry in _contextProperties)
            {
                if (!string.IsNullOrWhiteSpace(entry.Key))
                {
                    if (!seenKeys.Add(entry.Key))
                        duplicateKeys.Add(entry.Key);
                }
            }

            // Draw each property row
            for (int i = 0; i < _contextProperties.Count; i++)
            {
                var entry = _contextProperties[i];
                EditorGUILayout.BeginHorizontal();

                // Key field
                bool isDuplicate = !string.IsNullOrWhiteSpace(entry.Key) && duplicateKeys.Contains(entry.Key);
                if (isDuplicate)
                {
                    var oldColor = GUI.color;
                    GUI.color = new Color(1f, 0.6f, 0.4f);
                    entry.Key = EditorGUILayout.TextField(entry.Key, GUILayout.Width(100));
                    GUI.color = oldColor;
                }
                else
                {
                    entry.Key = EditorGUILayout.TextField(entry.Key, GUILayout.Width(100));
                }

                // Type dropdown
                entry.Type = (ContextPropertyType)EditorGUILayout.EnumPopup(entry.Type, GUILayout.Width(65));

                // Value field — show appropriate input based on type
                switch (entry.Type)
                {
                    case ContextPropertyType.Boolean:
                        bool boolVal = string.Equals(entry.Value, "true", System.StringComparison.OrdinalIgnoreCase)
                                       || entry.Value == "1";
                        bool newBoolVal = EditorGUILayout.Toggle(boolVal);
                        if (newBoolVal != boolVal)
                            entry.Value = newBoolVal ? "true" : "false";
                        break;
                    default:
                        entry.Value = EditorGUILayout.TextField(entry.Value);
                        break;
                }

                // Remove button
                if (GUILayout.Button("\u2715", GUILayout.Width(22), GUILayout.Height(18)))
                {
                    removeIndex = i;
                }

                EditorGUILayout.EndHorizontal();
            }

            // Remove deferred
            if (removeIndex >= 0)
            {
                _contextProperties.RemoveAt(removeIndex);
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
                _contextProperties.Add(new ContextPropertyEntry());
            }
            EditorGUILayout.EndHorizontal();

            if (_contextProperties.Count == 0)
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
    }
}
#endif
