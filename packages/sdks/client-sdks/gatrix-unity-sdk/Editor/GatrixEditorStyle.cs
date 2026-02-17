using UnityEngine;
using UnityEditor;

namespace Gatrix.Unity.SDK.Editor
{
    /// <summary>
    /// Unified styling for Gatrix Editor UIs, inspired by "Feel" framework aesthetics.
    /// </summary>
    public static class GatrixEditorStyle
    {
        // Colors
        private static readonly Color _splitterDark = new Color(0.12f, 0.12f, 0.12f, 1.333f);
        private static readonly Color _splitterLight = new Color(0.6f, 0.6f, 0.6f, 1.333f);
        public static Color Splitter => EditorGUIUtility.isProSkin ? _splitterDark : _splitterLight;

        private static readonly Color _headerBackgroundDark = new Color(0.1f, 0.1f, 0.1f, 0.2f);
        private static readonly Color _headerBackgroundLight = new Color(1f, 1f, 1f, 0.4f);
        public static Color HeaderBackground => EditorGUIUtility.isProSkin ? _headerBackgroundDark : _headerBackgroundLight;

        private static readonly Color _boxBackgroundDark = new Color(0.1f, 0.1f, 0.1f, 0.2f); // Slightly darker for boxes
        private static readonly Color _boxBackgroundLight = new Color(0.9f, 0.9f, 0.9f, 0.4f);
        public static Color BoxBackground => EditorGUIUtility.isProSkin ? _boxBackgroundDark : _boxBackgroundLight;

        // Styles
        private static GUIStyle _boldLabel;
        public static GUIStyle BoldLabel
        {
            get
            {
                if (_boldLabel == null)
                {
                    _boldLabel = new GUIStyle(EditorStyles.boldLabel);
                    _boldLabel.fontSize = 12;
                    // _boldLabel.fontStyle = FontStyle.Bold; // Implicit in boldLabel
                }
                return _boldLabel;
            }
        }

        private static GUIStyle _headerLabel;
        public static GUIStyle HeaderLabel
        {
            get
            {
                if (_headerLabel == null)
                {
                    _headerLabel = new GUIStyle(EditorStyles.boldLabel);
                    _headerLabel.fontSize = 13;
                    _headerLabel.alignment = TextAnchor.MiddleLeft;
                    _headerLabel.normal.textColor = EditorGUIUtility.isProSkin ? new Color(0.9f, 0.9f, 0.9f) : new Color(0.2f, 0.2f, 0.2f);
                }
                return _headerLabel;
            }
        }
        
        private static GUIStyle _subHeaderLabel;
        public static GUIStyle SubHeaderLabel
        {
            get
            {
                if (_subHeaderLabel == null)
                {
                    _subHeaderLabel = new GUIStyle(EditorStyles.label);
                    _subHeaderLabel.fontSize = 10;
                    _subHeaderLabel.fontStyle = FontStyle.Italic;
                    _subHeaderLabel.normal.textColor = EditorGUIUtility.isProSkin ? new Color(0.7f, 0.7f, 0.7f) : new Color(0.4f, 0.4f, 0.4f);
                }
                return _subHeaderLabel;
            }
        }

        /// <summary>
        /// Draws a section title with a splitter above it.
        /// </summary>
        public static void DrawSection(string title, string subtitle = null)
        {
            EditorGUILayout.Space();
            DrawSplitter();
            EditorGUILayout.Space();

            EditorGUILayout.BeginVertical();
            EditorGUILayout.LabelField(title, HeaderLabel);
            if (!string.IsNullOrEmpty(subtitle))
            {
                EditorGUILayout.LabelField(subtitle, SubHeaderLabel);
            }
            EditorGUILayout.EndVertical();
            
            EditorGUILayout.Space(2);
        }

        /// <summary>
        /// Draws a simple 1px splitter line.
        /// </summary>
        public static void DrawSplitter()
        {
            var rect = GUILayoutUtility.GetRect(1f, 1f);
            rect.xMin = 0f;
            rect.width += 4f;

            if (Event.current.type != EventType.Repaint)
                return;

            EditorGUI.DrawRect(rect, Splitter);
        }

        /// <summary>
        /// Begins a styled box group.
        /// </summary>
        public static void BeginBox()
        {
            EditorGUILayout.BeginVertical(EditorStyles.helpBox);
            // Optional: Draw custom background if helpBox isn't sufficient
        }

        /// <summary>
        /// Ends a styled box group.
        /// </summary>
        public static void EndBox()
        {
            EditorGUILayout.EndVertical();
        }

        /// <summary>
        /// Draws a help box with a cleaner look.
        /// </summary>
        public static void DrawHelpBox(string message, MessageType type)
        {
            EditorGUILayout.HelpBox(message, type);
        }
    }
}
