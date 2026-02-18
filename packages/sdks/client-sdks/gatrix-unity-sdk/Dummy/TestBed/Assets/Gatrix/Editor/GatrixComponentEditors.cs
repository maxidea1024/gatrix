// GatrixComponentEditors - Custom Inspectors for Gatrix components
// Provides a clean, professional, and organized UI similar to NGUI or Odin

#if UNITY_EDITOR
using UnityEditor;
using UnityEngine;
using System.Collections.Generic;

namespace Gatrix.Unity.SDK.Editor
{
    // ==========================================
    // FLAG TOGGLE EDITOR
    // ==========================================
    [CustomEditor(typeof(GatrixFlagToggle))]
    [CanEditMultipleObjects]
    public class GatrixFlagToggleEditor : UnityEditor.Editor
    {
        public override void OnInspectorGUI()
        {
            serializedObject.Update();
            GatrixEditorExtensions.DrawHeader("Flag Toggle", "Enable/Disable GameObjects via Feature Flags");
            
            GatrixEditorExtensions.BeginGroup("Flag Setup");
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_flagName"));
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_invertLogic"));
            GatrixEditorExtensions.DrawFlagStatus(serializedObject.FindProperty("_flagName").stringValue);
            GatrixEditorExtensions.EndGroup();

            GatrixEditorExtensions.BeginGroup("Target GameObjects");
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_whenEnabled"), true);
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_whenDisabled"), true);
            GatrixEditorExtensions.EndGroup();

            GatrixEditorExtensions.BeginGroup("Self Control");
            var selfControl = serializedObject.FindProperty("_controlSelf");
            EditorGUILayout.PropertyField(selfControl);
            if (selfControl.boolValue)
            {
                EditorGUILayout.PropertyField(serializedObject.FindProperty("_selfActivation"));
            }
            GatrixEditorExtensions.EndGroup();

            serializedObject.ApplyModifiedProperties();
        }
    }

    // ==========================================
    // FLAG VALUE EDITOR
    // ==========================================
    [CustomEditor(typeof(GatrixFlagValue))]
    [CanEditMultipleObjects]
    public class GatrixFlagValueEditor : UnityEditor.Editor
    {
        public override void OnInspectorGUI()
        {
            serializedObject.Update();
            GatrixEditorExtensions.DrawHeader("Flag Value", "Sync Text components with Feature Flag values");

            GatrixEditorExtensions.BeginGroup("Configuration");
            var flagName = serializedObject.FindProperty("_flagName");
            EditorGUILayout.PropertyField(flagName);
            GatrixEditorExtensions.DrawFlagStatus(flagName.stringValue);
            GatrixEditorExtensions.EndGroup();

            GatrixEditorExtensions.BeginGroup("Display Options");
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_format"));
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_fallbackText"));
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_hideWhenDisabled"));
            GatrixEditorExtensions.EndGroup();

            GatrixEditorExtensions.BeginGroup("Target Component");
            var target = serializedObject.FindProperty("_targetText");
            EditorGUILayout.PropertyField(target);
            if (target.objectReferenceValue == null)
            {
                EditorGUILayout.HelpBox("Will auto-detect UI Text or TextMeshPro component.", MessageType.Info);
            }
            GatrixEditorExtensions.EndGroup();

            serializedObject.ApplyModifiedProperties();
        }
    }

    // ==========================================
    // FLAG EVENT EDITOR
    // ==========================================
    [CustomEditor(typeof(GatrixFlagEvent))]
    [CanEditMultipleObjects]
    public class GatrixFlagEventEditor : UnityEditor.Editor
    {
        public override void OnInspectorGUI()
        {
            serializedObject.Update();
            GatrixEditorExtensions.DrawHeader("Flag Event", "Fire UnityEvents via Feature Flags");

            GatrixEditorExtensions.BeginGroup("Configuration");
            var flagName = serializedObject.FindProperty("_flagName");
            EditorGUILayout.PropertyField(flagName);
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_fireOnInitial"));
            GatrixEditorExtensions.DrawFlagStatus(flagName.stringValue);
            GatrixEditorExtensions.EndGroup();

            GatrixEditorExtensions.BeginGroup("UnityEvents");
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_onEnabled"));
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_onDisabled"));
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_onChanged"));
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_onVariantChanged"));
            GatrixEditorExtensions.EndGroup();

            serializedObject.ApplyModifiedProperties();
        }
    }

    // ==========================================
    // FLAG IMAGE EDITOR
    // ==========================================
    [CustomEditor(typeof(GatrixFlagImage))]
    [CanEditMultipleObjects]
    public class GatrixFlagImageEditor : UnityEditor.Editor
    {
        public override void OnInspectorGUI()
        {
            serializedObject.Update();
            GatrixEditorExtensions.DrawHeader("Flag Image", "Swap Sprites based on Flag Variants");

            GatrixEditorExtensions.BeginGroup("Configuration");
            var flagName = serializedObject.FindProperty("_flagName");
            EditorGUILayout.PropertyField(flagName);
            GatrixEditorExtensions.DrawFlagStatus(flagName.stringValue);
            GatrixEditorExtensions.EndGroup();

            GatrixEditorExtensions.BeginGroup("Sprite Mapping");
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_defaultSprite"));
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_variantMaps"), true);
            GatrixEditorExtensions.EndGroup();

            GatrixEditorExtensions.BeginGroup("Targets");
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_uiImage"));
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_spriteRenderer"));
            GatrixEditorExtensions.EndGroup();

            serializedObject.ApplyModifiedProperties();
        }
    }

    // ==========================================
    // FLAG TRANSFORM EDITOR
    // ==========================================
    [CustomEditor(typeof(GatrixFlagTransform))]
    [CanEditMultipleObjects]
    public class GatrixFlagTransformEditor : UnityEditor.Editor
    {
        public override void OnInspectorGUI()
        {
            serializedObject.Update();
            GatrixEditorExtensions.DrawHeader("Flag Transform", "Live Transform Tuning via Flags");

            GatrixEditorExtensions.BeginGroup("Configuration");
            var flagName = serializedObject.FindProperty("_flagName");
            EditorGUILayout.PropertyField(flagName);
            GatrixEditorExtensions.DrawFlagStatus(flagName.stringValue);
            GatrixEditorExtensions.EndGroup();

            GatrixEditorExtensions.BeginGroup("Manipulation");
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_mode"));
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_component"));
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_isRelative"));
            GatrixEditorExtensions.EndGroup();

            GatrixEditorExtensions.BeginGroup("Session");
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_resetOnDisable"));
            GatrixEditorExtensions.EndGroup();

            serializedObject.ApplyModifiedProperties();
        }
    }

    // ==========================================
    // FLAG MATERIAL EDITOR
    // ==========================================
    [CustomEditor(typeof(GatrixFlagMaterial))]
    public class GatrixFlagMaterialEditor : UnityEditor.Editor
    {
        public override void OnInspectorGUI()
        {
            serializedObject.Update();
            GatrixEditorExtensions.DrawHeader("Flag Material", "Dynamic Materials via Flags");

            GatrixEditorExtensions.BeginGroup("Configuration");
            var flagName = serializedObject.FindProperty("_flagName");
            EditorGUILayout.PropertyField(flagName);
            GatrixEditorExtensions.DrawFlagStatus(flagName.stringValue);
            GatrixEditorExtensions.EndGroup();

            var mode = serializedObject.FindProperty("_mode");
            GatrixEditorExtensions.BeginGroup("Property Adjustment");
            EditorGUILayout.PropertyField(mode);
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_propertyName"));
            GatrixEditorExtensions.EndGroup();

            GatrixEditorExtensions.BeginGroup("Mapping");
            if (mode.enumValueIndex == 0) // SwapMaterial
            {
                EditorGUILayout.PropertyField(serializedObject.FindProperty("_defaultMaterial"));
                EditorGUILayout.PropertyField(serializedObject.FindProperty("_variantMaps"), true);
            }
            else
            {
                EditorGUILayout.HelpBox("Value from flag will be applied to the property.", MessageType.Info);
            }
            GatrixEditorExtensions.EndGroup();

            GatrixEditorExtensions.BeginGroup("Target");
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_renderer"));
            GatrixEditorExtensions.EndGroup();

            serializedObject.ApplyModifiedProperties();
        }
    }

    // ==========================================
    // FLAG LOGGER EDITOR
    // ==========================================
    [CustomEditor(typeof(GatrixFlagLogger))]
    public class GatrixFlagLoggerEditor : UnityEditor.Editor
    {
        public override void OnInspectorGUI()
        {
            serializedObject.Update();
            GatrixEditorExtensions.DrawHeader("Flag Logger", "Debug Flag Changes in Console");

            GatrixEditorExtensions.BeginGroup("Configuration");
            var flagName = serializedObject.FindProperty("_flagName");
            EditorGUILayout.PropertyField(flagName);
            GatrixEditorExtensions.DrawFlagStatus(flagName.stringValue);
            GatrixEditorExtensions.EndGroup();

            GatrixEditorExtensions.BeginGroup("Logging Settings");
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_logLevel"));
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_prefix"));
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_logValue"));
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_logReason"));
            GatrixEditorExtensions.EndGroup();

            serializedObject.ApplyModifiedProperties();
        }
    }

    // ==========================================
    // EVENT LISTENER EDITOR
    // ==========================================
    [CustomEditor(typeof(GatrixEventListener))]
    public class GatrixEventListenerEditor : UnityEditor.Editor
    {
        public override void OnInspectorGUI()
        {
            serializedObject.Update();
            GatrixEditorExtensions.DrawHeader("SDK Event Listener", "SDK Lifecycle to UnityEvents");
            
            EditorGUILayout.HelpBox("Select SDK events and assign callbacks.", MessageType.None);
            EditorGUILayout.Space(2);

            DrawEventSection("SDK Lifecycle", "_onReady", "_onError", "_onRecovered");
            DrawEventSection("Flag Updates", "_onFlagsChanged", "_onFlagsSynced", "_onPendingSync", "_onFlagsRemoved", "_onImpression");
            DrawEventSection("Fetch Process", "_onFetchStart", "_onFetchSuccess", "_onFetchError");
            DrawEventSection("Streaming", "_onStreamingConnected", "_onStreamingDisconnected", "_onStreamingReconnecting");
            DrawEventSection("Metrics", "_onMetricsSent", "_onMetricsError");

            serializedObject.ApplyModifiedProperties();
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

    // ==========================================
    // VARIANT SWITCH EDITOR
    // ==========================================
    [CustomEditor(typeof(GatrixVariantSwitch))]
    public class GatrixVariantSwitchEditor : UnityEditor.Editor
    {
        public override void OnInspectorGUI()
        {
            serializedObject.Update();
            GatrixEditorExtensions.DrawHeader("Variant Switch", "Branching logic via Variant Names");

            GatrixEditorExtensions.BeginGroup("Configuration");
            var flagName = serializedObject.FindProperty("_flagName");
            EditorGUILayout.PropertyField(flagName);
            GatrixEditorExtensions.DrawFlagStatus(flagName.stringValue);
            GatrixEditorExtensions.EndGroup();

            GatrixEditorExtensions.BeginGroup("Branching");
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_defaultCase"), true);
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_cases"), true);
            GatrixEditorExtensions.EndGroup();

            serializedObject.ApplyModifiedProperties();
        }
    }

    // ==========================================
    // FLAG AUDIO EDITOR
    // ==========================================
    [CustomEditor(typeof(GatrixFlagAudio))]
    public class GatrixFlagAudioEditor : UnityEditor.Editor
    {
        public override void OnInspectorGUI()
        {
            serializedObject.Update();
            GatrixEditorExtensions.DrawHeader("Flag Audio", "Play AudioClips via Feature Flags");

            GatrixEditorExtensions.BeginGroup("Configuration");
            var flagName = serializedObject.FindProperty("_flagName");
            EditorGUILayout.PropertyField(flagName);
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_mode"));
            GatrixEditorExtensions.DrawFlagStatus(flagName.stringValue);
            GatrixEditorExtensions.EndGroup();

            var mode = serializedObject.FindProperty("_mode");
            if (mode.enumValueIndex == 0) // ByState
            {
                GatrixEditorExtensions.BeginGroup("State Clips");
                EditorGUILayout.PropertyField(serializedObject.FindProperty("_enabledClip"));
                EditorGUILayout.PropertyField(serializedObject.FindProperty("_disabledClip"));
                GatrixEditorExtensions.EndGroup();
            }
            else
            {
                GatrixEditorExtensions.BeginGroup("Variant Clips");
                EditorGUILayout.PropertyField(serializedObject.FindProperty("_variantClips"), true);
                GatrixEditorExtensions.EndGroup();
            }

            GatrixEditorExtensions.BeginGroup("Options");
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_playOnChange"));
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_loop"));
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_volume"));
            GatrixEditorExtensions.EndGroup();

            serializedObject.ApplyModifiedProperties();
        }
    }

    // ==========================================
    // FLAG ANIMATOR EDITOR
    // ==========================================
    [CustomEditor(typeof(GatrixFlagAnimator))]
    public class GatrixFlagAnimatorEditor : UnityEditor.Editor
    {
        public override void OnInspectorGUI()
        {
            serializedObject.Update();
            GatrixEditorExtensions.DrawHeader("Flag Animator", "Control Animator Parameters via Flags");

            GatrixEditorExtensions.BeginGroup("Configuration");
            var flagName = serializedObject.FindProperty("_flagName");
            EditorGUILayout.PropertyField(flagName);
            GatrixEditorExtensions.DrawFlagStatus(flagName.stringValue);
            GatrixEditorExtensions.EndGroup();

            GatrixEditorExtensions.BeginGroup("Bool Parameter");
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_boolParameter"));
            GatrixEditorExtensions.EndGroup();

            GatrixEditorExtensions.BeginGroup("Trigger Parameters");
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_enabledTrigger"));
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_disabledTrigger"));
            GatrixEditorExtensions.EndGroup();

            GatrixEditorExtensions.BeginGroup("Variant → Int Parameter");
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_variantIntParameter"));
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_variantIntMap"), true);
            GatrixEditorExtensions.EndGroup();

            serializedObject.ApplyModifiedProperties();
        }
    }

    // ==========================================
    // FLAG PARTICLES EDITOR
    // ==========================================
    [CustomEditor(typeof(GatrixFlagParticles))]
    public class GatrixFlagParticlesEditor : UnityEditor.Editor
    {
        public override void OnInspectorGUI()
        {
            serializedObject.Update();
            GatrixEditorExtensions.DrawHeader("Flag Particles", "Control ParticleSystem via Feature Flags");

            GatrixEditorExtensions.BeginGroup("Configuration");
            var flagName = serializedObject.FindProperty("_flagName");
            EditorGUILayout.PropertyField(flagName);
            GatrixEditorExtensions.DrawFlagStatus(flagName.stringValue);
            GatrixEditorExtensions.EndGroup();

            GatrixEditorExtensions.BeginGroup("Behavior");
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_onEnabled"));
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_onDisabled"));
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_withChildren"));
            GatrixEditorExtensions.EndGroup();

            serializedObject.ApplyModifiedProperties();
        }
    }

    // ==========================================
    // FLAG COLOR EDITOR
    // ==========================================
    [CustomEditor(typeof(GatrixFlagColor))]
    public class GatrixFlagColorEditor : UnityEditor.Editor
    {
        public override void OnInspectorGUI()
        {
            serializedObject.Update();
            GatrixEditorExtensions.DrawHeader("Flag Color", "Tint Graphics/Renderers via Feature Flags");

            GatrixEditorExtensions.BeginGroup("Configuration");
            var flagName = serializedObject.FindProperty("_flagName");
            EditorGUILayout.PropertyField(flagName);
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_mode"));
            GatrixEditorExtensions.DrawFlagStatus(flagName.stringValue);
            GatrixEditorExtensions.EndGroup();

            var mode = serializedObject.FindProperty("_mode");
            if (mode.enumValueIndex == 0) // ByState
            {
                GatrixEditorExtensions.BeginGroup("State Colors");
                EditorGUILayout.PropertyField(serializedObject.FindProperty("_enabledColor"));
                EditorGUILayout.PropertyField(serializedObject.FindProperty("_disabledColor"));
                GatrixEditorExtensions.EndGroup();
            }
            else
            {
                GatrixEditorExtensions.BeginGroup("Variant Colors");
                EditorGUILayout.PropertyField(serializedObject.FindProperty("_variantColors"), true);
                GatrixEditorExtensions.EndGroup();
            }

            GatrixEditorExtensions.BeginGroup("Transition");
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_animate"));
            if (serializedObject.FindProperty("_animate").boolValue)
            {
                EditorGUILayout.PropertyField(serializedObject.FindProperty("_lerpSpeed"));
            }
            GatrixEditorExtensions.EndGroup();

            GatrixEditorExtensions.BeginGroup("Targets");
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_graphic"));
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_renderer"));
            GatrixEditorExtensions.EndGroup();

            serializedObject.ApplyModifiedProperties();
        }
    }

    // ==========================================
    // FLAG CANVAS EDITOR
    // ==========================================
    [CustomEditor(typeof(GatrixFlagCanvas))]
    public class GatrixFlagCanvasEditor : UnityEditor.Editor
    {
        public override void OnInspectorGUI()
        {
            serializedObject.Update();
            GatrixEditorExtensions.DrawHeader("Flag Canvas", "Control CanvasGroup visibility via Flags");

            GatrixEditorExtensions.BeginGroup("Configuration");
            var flagName = serializedObject.FindProperty("_flagName");
            EditorGUILayout.PropertyField(flagName);
            GatrixEditorExtensions.DrawFlagStatus(flagName.stringValue);
            GatrixEditorExtensions.EndGroup();

            GatrixEditorExtensions.BeginGroup("Enabled State");
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_enabledAlpha"));
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_enabledInteractable"));
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_enabledBlocksRaycasts"));
            GatrixEditorExtensions.EndGroup();

            GatrixEditorExtensions.BeginGroup("Disabled State");
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_disabledAlpha"));
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_disabledInteractable"));
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_disabledBlocksRaycasts"));
            GatrixEditorExtensions.EndGroup();

            GatrixEditorExtensions.BeginGroup("Transition");
            EditorGUILayout.PropertyField(serializedObject.FindProperty("_animate"));
            if (serializedObject.FindProperty("_animate").boolValue)
            {
                EditorGUILayout.PropertyField(serializedObject.FindProperty("_fadeSpeed"));
            }
            GatrixEditorExtensions.EndGroup();

            serializedObject.ApplyModifiedProperties();
        }
    }
}
#endif

