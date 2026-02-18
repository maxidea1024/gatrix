using UnityEngine;
using UnityEditor;

namespace EmeraldAI.Utility
{
    [CustomEditor(typeof(EmeraldCover))]
    [CanEditMultipleObjects]
    public class EmeraldCoverEditor : Editor
    {
        GUIStyle FoldoutStyle;
        Texture CoverEditorIcon;

        SerializedProperty SettingsFoldout, HideSettingsFoldout, MinCoverDistance, MaxTravelDistance, CoverSearchRadius, CoverNodeLayerMask;
        SerializedProperty HideSecondsMin, HideSecondsMax, AttackSecondsMin, AttackSecondsMax, PeakTimesMin, PeakTimesMax;

        void OnEnable()
        {
            if (CoverEditorIcon == null) CoverEditorIcon = Resources.Load("Editor Icons/EmeraldCover") as Texture;
            InitializeProperties();
        }

        void InitializeProperties()
        {
            SettingsFoldout = serializedObject.FindProperty("SettingsFoldout");
            HideSettingsFoldout = serializedObject.FindProperty("HideSettingsFoldout");

            MinCoverDistance = serializedObject.FindProperty("MinCoverDistance");
            MaxTravelDistance = serializedObject.FindProperty("MaxTravelDistance");
            CoverSearchRadius = serializedObject.FindProperty("CoverSearchRadius");
            CoverNodeLayerMask = serializedObject.FindProperty("CoverNodeLayerMask");

            HideSecondsMin = serializedObject.FindProperty("HideSecondsMin");
            HideSecondsMax = serializedObject.FindProperty("HideSecondsMax");
            AttackSecondsMin = serializedObject.FindProperty("AttackSecondsMin");
            AttackSecondsMax = serializedObject.FindProperty("AttackSecondsMax");
            PeakTimesMin = serializedObject.FindProperty("PeakTimesMin");
            PeakTimesMax = serializedObject.FindProperty("PeakTimesMax");
        }

        public override void OnInspectorGUI()
        {
            FoldoutStyle = CustomEditorProperties.UpdateEditorStyles();
            serializedObject.Update();

            CustomEditorProperties.BeginScriptHeaderNew("Cover", CoverEditorIcon, new GUIContent(), HideSettingsFoldout);

            if (!HideSettingsFoldout.boolValue)
            {
                EditorGUILayout.Space();
                CoverSettings();
                EditorGUILayout.Space();
            }

            CustomEditorProperties.EndScriptHeader();

            serializedObject.ApplyModifiedProperties();
        }

        void CoverSettings()
        {
            EmeraldCover self = (EmeraldCover)target;

            SettingsFoldout.boolValue = EditorGUILayout.Foldout(SettingsFoldout.boolValue, "Cover Settings", true, FoldoutStyle);

            if (SettingsFoldout.boolValue)
            {
                CustomEditorProperties.BeginFoldoutWindowBox();
                CustomEditorProperties.TextTitleWithDescription("Cover Settings", "Allows AI to look for Cover Nodes to dynamically find cover while in combat. Only one AI can use a Cover Node at a time. " +
                    "If no Cover Nodes are found, an AI will attempt to generate waypoints around their current position that are within line of sight of their current target.", false);
                if (!self.ConfirmInfoMessage)
                {
                    CustomEditorProperties.DisplayImportantMessage("An AI's Moving Combat Turn Speed is overridden when using this component. The Combat Actions Strafe and Move to Random Position will also be ignored while using this component." +
                        "\n\nIf your Animator Controller was created with a version prior to version 1.3.0, you will need to regenerate your Animation Profile's Animator Controller to give it the Cover States.");

                    if (GUILayout.Button("Okay"))
                    {
                        serializedObject.Update();
                        serializedObject.FindProperty("ConfirmInfoMessage").boolValue = true;
                        serializedObject.ApplyModifiedProperties();
                    }
                    EditorGUILayout.Space();
                    EditorGUILayout.Space();
                }
                EditorGUILayout.Space();
                EditorGUILayout.Space();

                EditorGUILayout.PropertyField(CoverNodeLayerMask);
                CustomEditorProperties.CustomHelpLabelField("Controls the LayerMask used for searching for Cover Nodes.", true);
                EditorGUILayout.Space();

                EditorGUILayout.PropertyField(CoverSearchRadius);
                CustomEditorProperties.CustomHelpLabelField("Controls the radius an AI will use to search for Cover Nodes.", true);
                EditorGUILayout.Space();

                EditorGUILayout.PropertyField(MinCoverDistance);
                CustomEditorProperties.CustomHelpLabelField("Controls the minimum allowed distance from any detected target to be a potential Cover Node.", true);
                EditorGUILayout.Space();

                EditorGUILayout.PropertyField(MaxTravelDistance);
                CustomEditorProperties.CustomHelpLabelField("Controls the maximum allowed distance an AI can travel to a potential Cover Node.", true);
                EditorGUILayout.Space();

                EditorGUILayout.PropertyField(PeakTimesMin);
                CustomEditorProperties.CustomHelpLabelField("Controls the minimum times an AI will peak from at its current Cover Node to attack.", false);

                EditorGUILayout.PropertyField(PeakTimesMax);
                CustomEditorProperties.CustomHelpLabelField("Controls the maximum times an AI will peak from at its current Cover Node to attack.", true);
                EditorGUILayout.Space();

                EditorGUILayout.PropertyField(HideSecondsMin);
                CustomEditorProperties.CustomHelpLabelField("Controls the minimum time an AI will hide at its current Cover Node.", false);

                EditorGUILayout.PropertyField(HideSecondsMax);
                CustomEditorProperties.CustomHelpLabelField("Controls the maximum time an AI will hide at its current Cover Node.", true);
                EditorGUILayout.Space();

                EditorGUILayout.PropertyField(AttackSecondsMin);
                CustomEditorProperties.CustomHelpLabelField("Controls the minimum length an AI will from attack at its current Cover Node. An can not attack from a crouched position and will attack once they are standing", false);

                EditorGUILayout.PropertyField(AttackSecondsMax);
                CustomEditorProperties.CustomHelpLabelField("Controls the maximum length an AI will from attack at its current Cover Node. An can not attack from a crouched position and will attack once they are standing.", true);

                CustomEditorProperties.EndFoldoutWindowBox();
            }
        }
    }
}