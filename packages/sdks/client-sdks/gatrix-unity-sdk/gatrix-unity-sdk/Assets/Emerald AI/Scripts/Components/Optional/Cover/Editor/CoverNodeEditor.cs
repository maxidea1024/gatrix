using UnityEngine;
using UnityEditor;

namespace EmeraldAI.Utility
{
    [CustomEditor(typeof(CoverNode))]
    [CanEditMultipleObjects]
    public class CoverNodeEditor : Editor
    {
        SerializedProperty CoverType;
        SerializedProperty LookForUnobstructedPosition;
        SerializedProperty GetLineOfSightPosition;
        SerializedProperty CoverAngleLimit;
        SerializedProperty ArrowColor;
        SerializedProperty NodeColor;
        Texture NodeEditorIcon;

        void OnEnable()
        {
            if (NodeEditorIcon == null) NodeEditorIcon = Resources.Load("Editor Icons/EmeraldCover") as Texture;
            InitializeProperties();
        }

        void InitializeProperties()
        {
            CoverType = serializedObject.FindProperty("CoverType");
            LookForUnobstructedPosition = serializedObject.FindProperty("LookForUnobstructedPosition");
            GetLineOfSightPosition = serializedObject.FindProperty("GetLineOfSightPosition");
            CoverAngleLimit = serializedObject.FindProperty("CoverAngleLimit");
            ArrowColor = serializedObject.FindProperty("ArrowColor");
            NodeColor = serializedObject.FindProperty("NodeColor");
        }

        public override void OnInspectorGUI()
        {
            serializedObject.Update();

            CustomEditorProperties.BeginScriptHeader("Cover Node", NodeEditorIcon);

            EditorGUILayout.Space();
            CoverNodeSettings();
            EditorGUILayout.Space();

            serializedObject.ApplyModifiedProperties();

            CustomEditorProperties.EndScriptHeader();
        }

        void CoverNodeSettings()
        {
            CoverNode self = (CoverNode)target;

            CustomEditorProperties.BeginFoldoutWindowBox();
            CustomEditorProperties.TextTitleWithDescription("Cover Node Settings", "Controls how AI react when using this Cover Node as well as its gizmo colors.", true);

            EditorGUILayout.PropertyField(CoverType);

            if (self.CoverType == CoverTypes.CrouchAndPeak)
            {
                CustomEditorProperties.CustomHelpLabelField("Crouch and Peak - Allows an AI to crouch for the duration of its generated Hide Seconds and stand from this cover point. The amount of peaks is based on its generated Peak Times. During each peak, it will attack for the duration of its generated Attack Seconds.", false);
            }
            else if (self.CoverType == CoverTypes.CrouchOnce)
            {
                CustomEditorProperties.CustomHelpLabelField("Crouch Once - Allows an AI to crouch once for the duration of its generated Hide Seconds and stand from this cover point. While standing, it will attack for the duration of its generated Attack Seconds.", false);
            }
            else if (self.CoverType == CoverTypes.Stand)
            {
                CustomEditorProperties.CustomHelpLabelField("Stand - Allows an AI to stand continuously from this cover point. While standing, it will attack for the duration of its generated Attack Seconds.", false);
            }

            CustomEditorProperties.DisplayImportantMessage("Some of the above settings are based on an AI's Cover Component.");

            EditorGUILayout.Space();
            EditorGUILayout.Space();

            EditorGUILayout.PropertyField(GetLineOfSightPosition);
            CustomEditorProperties.CustomHelpLabelField("Controls whether or not an AI will generate a position to an unobstructed view of their target to attack, if they cannot see their target while at their current Cover Node.", false);
            if (self.GetLineOfSightPosition == YesOrNo.Yes) CustomEditorProperties.DisplayImportantMessage("The above setting can allow the AI to leave its current Cover Node.");
            EditorGUILayout.Space();

            EditorGUILayout.PropertyField(CoverAngleLimit);
            CustomEditorProperties.CustomHelpLabelField("Controls the angle limit for this Cover Node. A target must be within this range for this Cover Node to be used. This is indicated by the green color area.", true);

            EditorGUILayout.PropertyField(ArrowColor);
            CustomEditorProperties.CustomHelpLabelField("Controls the vertical gizmo color.", true);

            EditorGUILayout.PropertyField(NodeColor);
            CustomEditorProperties.CustomHelpLabelField("Controls the color of the Cover Node.", true);

            CustomEditorProperties.EndFoldoutWindowBox();
        }
    }
}