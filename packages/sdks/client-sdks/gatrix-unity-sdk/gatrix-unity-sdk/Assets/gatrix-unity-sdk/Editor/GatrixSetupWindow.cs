// GatrixSetupWindow - Editor window for initial SDK setup
// Provides a guided setup wizard accessible from Window > Gatrix > Setup Wizard

#if UNITY_EDITOR
using UnityEditor;
using UnityEngine;

namespace Gatrix.Unity.SDK.Editor
{
    /// <summary>
    /// Setup wizard for zero-code Gatrix SDK initialization.
    /// Guides users through creating settings and adding GatrixBehaviour to the scene.
    /// </summary>
    public class GatrixSetupWindow : EditorWindow
    {
        // Setup state
        private string _apiUrl      = "";
        private string _apiToken    = "";
        private string _appName     = "";
        private string _environment = "development";

        // Optional context
        private bool   _showContext;
        private string _userId    = "";
        private string _sessionId = "";

        // Options
        private bool _showAdvanced;
        private bool _enableDevMode;
        private bool _offlineMode;
        private int  _refreshInterval  = 30;
        private bool _streamingEnabled = true;

        // UI state
        private Vector2 _scrollPos;
        private bool    _stylesInitialized;
        private GUIStyle _sectionStyle;
        private GUIStyle _descriptionStyle;

        // Existing assets
        private GatrixSettings _existingSettings;

        // Deferred action to avoid layout state changes mid-frame
        private bool _pendingClearExisting;

        [MenuItem("Window/Gatrix/Setup Wizard", priority = 20)]
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

        private void InitStyles()
        {
            if (_stylesInitialized) return;

            _sectionStyle = new GUIStyle(EditorStyles.boldLabel)
            {
                fontSize = 12,
                margin   = new RectOffset(0, 0, 8, 4)
            };

            _descriptionStyle = new GUIStyle(EditorStyles.wordWrappedLabel)
            {
                fontSize = 11,
                margin   = new RectOffset(4, 4, 2, 8)
            };

            _stylesInitialized = true;
        }

        private void OnGUI()
        {
            // Apply deferred state changes BEFORE layout starts
            if (_pendingClearExisting)
            {
                _pendingClearExisting = false;
                _existingSettings     = null;
            }

            InitStyles();

            // ── Title Bar ───────────────────────────────────────
            DrawWindowTitleBar();

            _scrollPos = EditorGUILayout.BeginScrollView(_scrollPos);
            EditorGUILayout.Space(8);

            // Description
            EditorGUILayout.LabelField(
                "Configure and initialize the Gatrix Feature Flag SDK. " +
                "This wizard creates a settings asset and sets up your scene for zero-code initialization.",
                _descriptionStyle);

            DrawDivider();

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
                    // Defer the state change to next frame to avoid layout mismatch
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

        // ==================== Window Title Bar ====================

        private void DrawWindowTitleBar()
        {
            bool isDark    = EditorGUIUtility.isProSkin;
            float fullWidth = EditorGUIUtility.currentViewWidth;

            var rect = GUILayoutUtility.GetRect(0, 44, GUILayout.ExpandWidth(true));

            if (Event.current.type == EventType.Repaint)
            {
                EditorGUI.DrawRect(new Rect(0, rect.y, fullWidth, rect.height),
                    isDark ? new Color(0.12f, 0.12f, 0.14f, 1f) : new Color(0.80f, 0.80f, 0.82f, 1f));
                EditorGUI.DrawRect(new Rect(0, rect.y, 5, rect.height), GatrixEditorStyle.AccentBlue);
                EditorGUI.DrawRect(new Rect(0, rect.yMax - 1, fullWidth, 1),
                    new Color(GatrixEditorStyle.AccentBlue.r, GatrixEditorStyle.AccentBlue.g, GatrixEditorStyle.AccentBlue.b, 0.5f));
            }

            var iconStyle = new GUIStyle(EditorStyles.boldLabel)
            {
                fontSize  = 14,
                alignment = TextAnchor.MiddleCenter,
                normal    = { textColor = GatrixEditorStyle.AccentBlue }
            };
            GUI.Label(new Rect(rect.x + 10, rect.y, 20, rect.height), "\u2699", iconStyle);

            var nameStyle = new GUIStyle(EditorStyles.boldLabel)
            {
                fontSize  = 12,
                alignment = TextAnchor.UpperLeft,
                normal    = { textColor = Color.white }
            };
            GUI.Label(new Rect(rect.x + 34, rect.y + 7, rect.width - 50, 18), "GATRIX SETUP WIZARD", nameStyle);

            var subStyle = new GUIStyle(EditorStyles.miniLabel)
            {
                normal = { textColor = new Color(0.60f, 0.75f, 1f) }
            };
            GUI.Label(new Rect(rect.x + 34, rect.y + 25, rect.width - 50, 14), "SDK Configuration & Scene Setup", subStyle);
        }

        // ==================== Section Divider ====================

        private static void DrawDivider()
        {
            EditorGUILayout.Space(4);
            var rect = EditorGUILayout.GetControlRect(false, 1);
            if (Event.current.type == EventType.Repaint)
                EditorGUI.DrawRect(rect, new Color(0.5f, 0.5f, 0.5f, 0.3f));
            EditorGUILayout.Space(4);
        }

        // ==================== Section Header ====================

        private void DrawSectionHeader(string title, Color accentColor)
        {
            EditorGUILayout.Space(4);
            var rect = EditorGUILayout.GetControlRect(false, 22);
            bool isDark = EditorGUIUtility.isProSkin;

            if (Event.current.type == EventType.Repaint)
            {
                EditorGUI.DrawRect(rect,
                    isDark ? new Color(0.17f, 0.17f, 0.19f, 1f) : new Color(0.75f, 0.75f, 0.77f, 1f));
                EditorGUI.DrawRect(new Rect(rect.x, rect.y, 3, rect.height), accentColor);
            }

            var style = new GUIStyle(EditorStyles.boldLabel)
            {
                fontSize  = 11,
                alignment = TextAnchor.MiddleLeft,
                normal    = { textColor = isDark ? new Color(0.88f, 0.90f, 0.92f) : new Color(0.08f, 0.10f, 0.12f) }
            };
            GUI.Label(new Rect(rect.x + 8, rect.y, rect.width - 16, rect.height), title, style);
            EditorGUILayout.Space(4);
        }

        // ==================== Forms ====================

        private void DrawNewSettingsForm()
        {
            DrawSectionHeader("Required Settings", GatrixEditorStyle.AccentBlue);

            _apiUrl = EditorGUILayout.TextField(
                new GUIContent("API URL", "Base URL for the Gatrix API (e.g., https://your-server.com/api/v1)"),
                _apiUrl);
            _apiToken = EditorGUILayout.TextField(
                new GUIContent("API Token", "Client API token from your Gatrix dashboard"),
                _apiToken);
            _appName = EditorGUILayout.TextField(
                new GUIContent("App Name", "Your application name registered in Gatrix"),
                _appName);
            _environment = EditorGUILayout.TextField(
                new GUIContent("Environment", "Target environment (e.g., development, staging, production)"),
                _environment);

            var hasRequired = !string.IsNullOrWhiteSpace(_apiUrl)
                && !string.IsNullOrWhiteSpace(_apiToken)
                && !string.IsNullOrWhiteSpace(_appName)
                && !string.IsNullOrWhiteSpace(_environment);

            if (!hasRequired)
            {
                EditorGUILayout.Space(4);
                GatrixEditorStyle.DrawHelpBox("All required fields must be filled.", MessageType.Warning);
            }

            DrawDivider();

            // Optional context
            _showContext = EditorGUILayout.Foldout(_showContext, "Initial Context (Optional)", true);
            if (_showContext)
            {
                EditorGUI.indentLevel++;
                _userId    = EditorGUILayout.TextField("User ID",    _userId);
                _sessionId = EditorGUILayout.TextField("Session ID", _sessionId);
                EditorGUI.indentLevel--;
            }

            // Advanced settings
            _showAdvanced = EditorGUILayout.Foldout(_showAdvanced, "Advanced Settings", true);
            if (_showAdvanced)
            {
                EditorGUI.indentLevel++;
                _enableDevMode = EditorGUILayout.Toggle(
                    new GUIContent("Dev Mode",       "Enable detailed debug logging"), _enableDevMode);
                _offlineMode = EditorGUILayout.Toggle(
                    new GUIContent("Offline Mode",   "Start without network requests"), _offlineMode);
                _refreshInterval = EditorGUILayout.IntSlider(
                    new GUIContent("Refresh Interval", "Seconds between flag polls"),
                    _refreshInterval, 1, 300);
                _streamingEnabled = EditorGUILayout.Toggle(
                    new GUIContent("Streaming (SSE)", "Enable real-time streaming"), _streamingEnabled);
                EditorGUI.indentLevel--;
            }

            DrawDivider();

            EditorGUI.BeginDisabledGroup(!hasRequired);
            if (GUILayout.Button("Create Settings Asset", GUILayout.Height(32)))
                CreateSettingsAsset();
            EditorGUI.EndDisabledGroup();

            EditorGUILayout.Space(8);
        }

        private void DrawSceneSetup()
        {
            DrawSectionHeader("Scene Setup", GatrixEditorStyle.AccentGreen);

            EditorGUILayout.LabelField(
                "Add a GatrixBehaviour component to your scene for automatic SDK initialization.",
                _descriptionStyle);

            var existing = FindAnyObjectByType<GatrixBehaviour>();

            if (existing != null)
            {
                GatrixEditorStyle.DrawHelpBox(
                    $"GatrixBehaviour found on \"{existing.gameObject.name}\".",
                    MessageType.Info);

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
            if (!AssetDatabase.IsValidFolder("Assets/Gatrix"))
                AssetDatabase.CreateFolder("Assets", "Gatrix");
            if (!AssetDatabase.IsValidFolder("Assets/Gatrix/Resources"))
                AssetDatabase.CreateFolder("Assets/Gatrix", "Resources");

            var settings = CreateInstance<GatrixSettings>();
            var so       = new SerializedObject(settings);
            so.FindProperty("_apiUrl").stringValue          = _apiUrl;
            so.FindProperty("_apiToken").stringValue        = _apiToken;
            so.FindProperty("_appName").stringValue         = _appName;
            so.FindProperty("_environment").stringValue     = _environment;
            so.FindProperty("_userId").stringValue          = _userId;
            so.FindProperty("_sessionId").stringValue       = _sessionId;
            so.FindProperty("_enableDevMode").boolValue     = _enableDevMode;
            so.FindProperty("_offlineMode").boolValue       = _offlineMode;
            so.FindProperty("_refreshInterval").intValue    = _refreshInterval;
            so.FindProperty("_streamingEnabled").boolValue  = _streamingEnabled;
            so.ApplyModifiedPropertiesWithoutUndo();

            var path = "Assets/Gatrix/Resources/GatrixSettings.asset";
            AssetDatabase.CreateAsset(settings, path);
            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();

            _existingSettings = settings;
            Selection.activeObject = settings;
            EditorGUIUtility.PingObject(settings);

            Debug.Log($"[GatrixSDK] Settings asset created at {path}");
        }

        private void AddBehaviourToScene()
        {
            var go       = new GameObject("[GatrixSDK]");
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
    }
}
#endif
