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
        private string _apiUrl = "";
        private string _apiToken = "";
        private string _appName = "";
        private string _environment = "development";

        // Optional context
        private bool _showContext;
        private string _userId = "";
        private string _sessionId = "";

        // Options
        private bool _showAdvanced;
        private bool _enableDevMode;
        private bool _offlineMode;
        private int _refreshInterval = 30;
        private bool _streamingEnabled = true;

        // UI state
        private Vector2 _scrollPos;
        private GUIStyle _titleStyle;
        private GUIStyle _sectionStyle;
        private GUIStyle _descriptionStyle;
        private bool _stylesInitialized;

        // Existing assets
        private GatrixSettings _existingSettings;

        [MenuItem("Window/Gatrix/Setup Wizard", priority = 20)]
        public static void ShowWindow()
        {
            var window = GetWindow<GatrixSetupWindow>("Gatrix Setup");
            window.minSize = new Vector2(450, 500);
            window.Show();
        }

        private void OnEnable()
        {
            // Try to find existing settings asset
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

            _titleStyle = new GUIStyle(EditorStyles.boldLabel)
            {
                fontSize = 18,
                alignment = TextAnchor.MiddleCenter,
                margin = new RectOffset(0, 0, 10, 10)
            };

            _sectionStyle = new GUIStyle(EditorStyles.boldLabel)
            {
                fontSize = 13,
                margin = new RectOffset(0, 0, 8, 4)
            };

            _descriptionStyle = new GUIStyle(EditorStyles.wordWrappedLabel)
            {
                fontSize = 11,
                margin = new RectOffset(4, 4, 2, 8)
            };

            _stylesInitialized = true;
        }

        private void OnGUI()
        {
            _scrollPos = EditorGUILayout.BeginScrollView(_scrollPos);

            // Title
            EditorGUILayout.Space(10);
            EditorGUILayout.LabelField("Gatrix SDK Setup", GatrixEditorStyle.HeaderLabel); // Or create a TitleLabel
            EditorGUILayout.Space(4);

            // Description
            EditorGUILayout.LabelField(
                "Configure and initialize the Gatrix Feature Flag SDK. " +
                "This wizard creates a settings asset and sets up your scene for zero-code initialization.",
                EditorStyles.wordWrappedLabel);

            GatrixEditorStyle.DrawSplitter();

            // Check if already configured
            if (_existingSettings != null)
            {
                GatrixEditorStyle.DrawHelpBox(
                    "A GatrixSettings asset already exists. You can edit it directly or create a new one.",
                    MessageType.Info);

                EditorGUILayout.BeginHorizontal();
                if (GUILayout.Button("Select Existing Settings", GUILayout.Height(28)))
                {
                    Selection.activeObject = _existingSettings;
                    EditorGUIUtility.PingObject(_existingSettings);
                }
                if (GUILayout.Button("Create New Settings", GUILayout.Height(28)))
                {
                    _existingSettings = null;
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

        private void DrawNewSettingsForm()
        {
            // Required fields
            EditorGUILayout.LabelField("Required Settings", _sectionStyle);

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

            // Validation
            var hasRequired = !string.IsNullOrWhiteSpace(_apiUrl)
                && !string.IsNullOrWhiteSpace(_apiToken)
                && !string.IsNullOrWhiteSpace(_appName)
                && !string.IsNullOrWhiteSpace(_environment);

            if (!hasRequired)
            {
                EditorGUILayout.HelpBox("All required fields must be filled.", MessageType.Warning);
            }

            DrawSeparator();

            // Optional context
            _showContext = EditorGUILayout.Foldout(_showContext, "Initial Context (Optional)", true);
            if (_showContext)
            {
                EditorGUI.indentLevel++;
                _userId = EditorGUILayout.TextField("User ID", _userId);
                _sessionId = EditorGUILayout.TextField("Session ID", _sessionId);
                EditorGUI.indentLevel--;
            }

            // Advanced settings
            _showAdvanced = EditorGUILayout.Foldout(_showAdvanced, "Advanced Settings", true);
            if (_showAdvanced)
            {
                EditorGUI.indentLevel++;
                _enableDevMode = EditorGUILayout.Toggle(
                    new GUIContent("Dev Mode", "Enable detailed debug logging"),
                    _enableDevMode);
                _offlineMode = EditorGUILayout.Toggle(
                    new GUIContent("Offline Mode", "Start without network requests"),
                    _offlineMode);
                _refreshInterval = EditorGUILayout.IntSlider(
                    new GUIContent("Refresh Interval", "Seconds between flag polls"),
                    _refreshInterval, 1, 300);
                _streamingEnabled = EditorGUILayout.Toggle(
                    new GUIContent("Streaming (SSE)", "Enable real-time streaming"),
                    _streamingEnabled);
                EditorGUI.indentLevel--;
            }

            DrawSeparator();

            // Create button
            EditorGUI.BeginDisabledGroup(!hasRequired);
            if (GUILayout.Button("Create Settings Asset", GUILayout.Height(32)))
            {
                CreateSettingsAsset();
            }
            EditorGUI.EndDisabledGroup();

            EditorGUILayout.Space(8);
        }

        private void DrawSceneSetup()
        {
            DrawSeparator();
            EditorGUILayout.LabelField("Scene Setup", _sectionStyle);
            EditorGUILayout.LabelField(
                "Add a GatrixBehaviour component to your scene for automatic SDK initialization.",
                _descriptionStyle);

            // Check if GatrixBehaviour exists in scene
            var existing = FindAnyObjectByType<GatrixBehaviour>();

            if (existing != null)
            {
                EditorGUILayout.HelpBox(
                    $"GatrixBehaviour found on \"{existing.gameObject.name}\".",
                    MessageType.Info);

                if (GUILayout.Button("Select in Scene", GUILayout.Height(28)))
                {
                    Selection.activeGameObject = existing.gameObject;
                }

                // Check if settings are assigned
                if (existing.Settings == null && _existingSettings != null)
                {
                    EditorGUILayout.Space(4);
                    if (GUILayout.Button("Assign Settings Asset", GUILayout.Height(28)))
                    {
                        Undo.RecordObject(existing, "Assign Gatrix Settings");
                        existing.Settings = _existingSettings;
                        existing.AutoInitialize = true;
                        EditorUtility.SetDirty(existing);
                    }
                }
            }
            else
            {
                if (GUILayout.Button("Add GatrixBehaviour to Scene", GUILayout.Height(32)))
                {
                    AddBehaviourToScene();
                }
            }
        }

        private void CreateSettingsAsset()
        {
            // Ensure directory exists
            if (!AssetDatabase.IsValidFolder("Assets/Gatrix"))
            {
                AssetDatabase.CreateFolder("Assets", "Gatrix");
            }
            if (!AssetDatabase.IsValidFolder("Assets/Gatrix/Resources"))
            {
                AssetDatabase.CreateFolder("Assets/Gatrix", "Resources");
            }

            var settings = CreateInstance<GatrixSettings>();

            // Use SerializedObject for setting private fields
            var so = new SerializedObject(settings);
            so.FindProperty("_apiUrl").stringValue = _apiUrl;
            so.FindProperty("_apiToken").stringValue = _apiToken;
            so.FindProperty("_appName").stringValue = _appName;
            so.FindProperty("_environment").stringValue = _environment;
            so.FindProperty("_userId").stringValue = _userId;
            so.FindProperty("_sessionId").stringValue = _sessionId;
            so.FindProperty("_enableDevMode").boolValue = _enableDevMode;
            so.FindProperty("_offlineMode").boolValue = _offlineMode;
            so.FindProperty("_refreshInterval").intValue = _refreshInterval;
            so.FindProperty("_streamingEnabled").boolValue = _streamingEnabled;
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
            var go = new GameObject("[GatrixSDK]");
            var behaviour = go.AddComponent<GatrixBehaviour>();

            if (_existingSettings != null)
            {
                behaviour.Settings = _existingSettings;
                behaviour.AutoInitialize = true;
            }

            Undo.RegisterCreatedObjectUndo(go, "Add GatrixBehaviour");
            Selection.activeGameObject = go;

            Debug.Log("[GatrixSDK] GatrixBehaviour added to scene.");
        }

        private static void DrawSeparator()
        {
            EditorGUILayout.Space(4);
            var rect = EditorGUILayout.GetControlRect(false, 1);
            EditorGUI.DrawRect(rect, new Color(0.5f, 0.5f, 0.5f, 0.3f));
            EditorGUILayout.Space(4);
        }
    }
}
#endif
