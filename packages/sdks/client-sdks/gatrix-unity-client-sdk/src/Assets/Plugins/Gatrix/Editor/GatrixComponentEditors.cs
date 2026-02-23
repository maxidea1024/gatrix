// GatrixComponentEditors - Custom Inspectors for Gatrix components
// Provides a clean, professional, and organized UI for specialized components

#if UNITY_EDITOR
using UnityEditor;
using UnityEngine;
using System.Collections.Generic;

namespace Gatrix.Unity.SDK.Editor
{
    // Note: Most Flag-binding components are now handled by the unified GatrixComponentEditor.
    // This file only contains editors for components with complex custom UI needs.

    // ==========================================
    // EVENT LISTENER EDITOR
    // ==========================================
    [CustomEditor(typeof(GatrixEventListener))]
    public class GatrixEventListenerEditor : UnityEditor.Editor
    {
        public override void OnInspectorGUI()
        {
            serializedObject.Update();
            
            GatrixEditorStyle.DrawWindowHeader("GATRIX", "EVENT LISTENER", "\u25c6");
            GatrixEditorStyle.DrawSectionHeader("SDK Runtime Events", GatrixEditorStyle.AccentOrange);
            
            EditorGUILayout.HelpBox("Listen to global SDK lifecycle events and trigger UnityEvents.", MessageType.None);
            EditorGUILayout.Space(4);

            DrawEventSection("SDK Lifecycle", "_onReady", "_onError", "_onRecovered");
            DrawEventSection("Flag Updates", "_onFlagsChanged", "_onFlagsSynced", "_onPendingSync", "_onFlagsRemoved", "_onImpression");
            DrawEventSection("Fetch Process", "_onFetchStart", "_onFetchSuccess", "_onFetchError");
            DrawEventSection("Streaming", "_onStreamingConnected", "_onStreamingDisconnected", "_onStreamingReconnecting");
            DrawEventSection("Metrics", "_onMetricsSent", "_onMetricsError");

            serializedObject.ApplyModifiedProperties();
            EditorGUILayout.Space(12);
        }

        private void DrawEventSection(string title, params string[] propertyNames)
        {
            GatrixEditorExtensions.BeginGroup(title);
            foreach (var propName in propertyNames)
            {
                var entryProp = serializedObject.FindProperty(propName);
                if (entryProp == null) continue;

                var enabledProp = entryProp.FindPropertyRelative("enabled");
                var callbackProp = entryProp.FindPropertyRelative("onEvent");

                EditorGUILayout.BeginHorizontal();
                enabledProp.boolValue = EditorGUILayout.ToggleLeft(entryProp.displayName, enabledProp.boolValue, GUILayout.Width(170));
                EditorGUILayout.EndHorizontal();

                if (enabledProp.boolValue)
                {
                    EditorGUILayout.PropertyField(callbackProp, GUIContent.none);
                    EditorGUILayout.Space(2);
                }
            }
            GatrixEditorExtensions.EndGroup();
        }
    }
}
#endif
