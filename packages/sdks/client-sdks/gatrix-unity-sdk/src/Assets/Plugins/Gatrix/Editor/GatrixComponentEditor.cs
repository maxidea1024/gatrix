// GatrixComponentEditor - Unified inspector for all Gatrix flag-binding components
// Provides consistent UI, branding, flag autocomplete, and Sync Mode (Realtime/Synced) support.

#if UNITY_EDITOR
using UnityEditor;
using UnityEngine;
using System.Linq;
using Gatrix.Unity.SDK;

namespace Gatrix.Unity.SDK.Editor
{
    /// <summary>
    /// Base editor for Gatrix components to ensure consistent UI.
    /// Supports FlagName autocomplete and SyncMode selection.
    /// </summary>
    [CustomEditor(typeof(MonoBehaviour), true)]
    [CanEditMultipleObjects]
    public class GatrixComponentEditor : UnityEditor.Editor
    {
        private bool _isFlagComponent;
        private bool _isOtherGatrixComponent;
        private SerializedProperty _flagNameProp;
        private SerializedProperty _useProp;

        private void OnEnable()
        {
            var type = target.GetType();
            
            // Check if it inherits from our new base class
            _isFlagComponent = typeof(GatrixFlagComponentBase).IsAssignableFrom(type);
            
            // Check if it's another Gatrix component that might need branding but doesn't use the base
            _isOtherGatrixComponent = !_isFlagComponent && 
                                     type.Namespace == "Gatrix.Unity.SDK" && 
                                     (type.Name.StartsWith("Gatrix") || type.Name.Contains("Gatrix"));
            
            if (_isFlagComponent)
            {
                _flagNameProp = serializedObject.FindProperty("_flagName");
                _useProp = serializedObject.FindProperty("_use");
            }
        }

        public override void OnInspectorGUI()
        {
            if (!_isFlagComponent && !_isOtherGatrixComponent)
            {
                base.OnInspectorGUI();
                return;
            }

            serializedObject.Update();

            string title = target.GetType().Name.Replace("GatrixFlag", "").Replace("Gatrix", "");
            if (string.IsNullOrEmpty(title)) title = "COMPONENT";

            // 1. Branding Header
            GatrixEditorStyle.DrawWindowHeader("GATRIX", title.ToUpper(), "\u25c6");

            if (_isFlagComponent)
            {
                // 2. Flag Configuration Section
                GatrixEditorStyle.DrawSectionHeader("Flag Configuration", GatrixEditorStyle.AccentBlue);
                
                if (_flagNameProp != null)
                {
                    EditorGUILayout.PropertyField(_flagNameProp, new GUIContent("Flag Name"));
                }

                if (_useProp != null)
                {
                    // Draw Sync Mode as an Enum-like dropdown instead of a simple toggle
                    int currentIndex = _useProp.boolValue ? 0 : 1;
                    string[] options = { "Realtime (Immediate)", "Synced (Manual/Controlled)" };
                    
                    int newIndex = EditorGUILayout.Popup("Sync Mode", currentIndex, options);
                    if (newIndex != currentIndex)
                    {
                        _useProp.boolValue = (newIndex == 0);
                    }
                    
                    EditorGUILayout.HelpBox(_useProp.boolValue 
                        ? "Immediate updates whenever the flag changes on the server." 
                        : "Update only when the client explicitly synchronizes flag states.", 
                        MessageType.None);
                }

                EditorGUILayout.Space(8);

                // 3. Other Settings
                GatrixEditorStyle.DrawSectionHeader("Settings", GatrixEditorStyle.AccentGreen);
                DrawPropertiesExcluding(serializedObject, "m_Script", "_flagName", "_use");
            }
            else
            {
                // Just draw everything for non-flag components, but with branding
                DrawPropertiesExcluding(serializedObject, "m_Script");
            }

            serializedObject.ApplyModifiedProperties();
            
            EditorGUILayout.Space(12);
        }
    }
}
#endif
