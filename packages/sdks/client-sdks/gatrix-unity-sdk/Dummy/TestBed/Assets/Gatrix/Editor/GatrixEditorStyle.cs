// GatrixEditorStyle - Unified styling for Gatrix Editor UIs
// Inspired by MoreMountains "Feel" framework aesthetics

using UnityEngine;
using UnityEditor;

namespace Gatrix.Unity.SDK.Editor
{
    /// <summary>
    /// Unified styling for Gatrix Editor UIs, inspired by "Feel" framework aesthetics.
    /// </summary>
    public static class GatrixEditorStyle
    {
        // ==================== Brand Colors ====================

        private static readonly Color _gatrixBlue = new Color(0.18f, 0.48f, 0.92f, 1f);
        private static readonly Color _gatrixBlueDim = new Color(0.12f, 0.32f, 0.65f, 1f);

        // Splitter
        private static readonly Color _splitterDark = new Color(0.12f, 0.12f, 0.12f, 1.333f);
        private static readonly Color _splitterLight = new Color(0.6f, 0.6f, 0.6f, 1.333f);
        public static Color Splitter => EditorGUIUtility.isProSkin ? _splitterDark : _splitterLight;

        // Header background
        private static readonly Color _headerBgDark = new Color(0.18f, 0.18f, 0.18f, 1f);
        private static readonly Color _headerBgLight = new Color(0.82f, 0.82f, 0.82f, 1f);
        public static Color HeaderBackground => EditorGUIUtility.isProSkin ? _headerBgDark : _headerBgLight;

        // Section background
        private static readonly Color _sectionBgDark = new Color(0.14f, 0.14f, 0.14f, 0.5f);
        private static readonly Color _sectionBgLight = new Color(0.88f, 0.88f, 0.88f, 0.5f);

        // ==================== Styles ====================

        private static GUIStyle _boldLabel;
        public static GUIStyle BoldLabel
        {
            get
            {
                if (_boldLabel == null)
                {
                    _boldLabel = new GUIStyle(EditorStyles.boldLabel) { fontSize = 12 };
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
                    _headerLabel = new GUIStyle(EditorStyles.boldLabel)
                    {
                        fontSize = 13,
                        alignment = TextAnchor.MiddleLeft,
                    };
                    _headerLabel.normal.textColor = EditorGUIUtility.isProSkin
                        ? new Color(0.9f, 0.9f, 0.9f)
                        : new Color(0.15f, 0.15f, 0.15f);
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
                    _subHeaderLabel = new GUIStyle(EditorStyles.label)
                    {
                        fontSize = 10,
                        fontStyle = FontStyle.Italic,
                    };
                    _subHeaderLabel.normal.textColor = EditorGUIUtility.isProSkin
                        ? new Color(0.65f, 0.65f, 0.65f)
                        : new Color(0.4f, 0.4f, 0.4f);
                }
                return _subHeaderLabel;
            }
        }

        private static GUIStyle _titleBarLabel;
        private static GUIStyle TitleBarLabel
        {
            get
            {
                if (_titleBarLabel == null)
                {
                    _titleBarLabel = new GUIStyle(EditorStyles.boldLabel)
                    {
                        fontSize = 11,
                        alignment = TextAnchor.MiddleLeft,
                    };
                    _titleBarLabel.normal.textColor = Color.white;
                }
                return _titleBarLabel;
            }
        }

        private static GUIStyle _titleBarSubLabel;
        private static GUIStyle TitleBarSubLabel
        {
            get
            {
                if (_titleBarSubLabel == null)
                {
                    _titleBarSubLabel = new GUIStyle(EditorStyles.miniLabel)
                    {
                        alignment = TextAnchor.MiddleLeft,
                    };
                    _titleBarSubLabel.normal.textColor = new Color(0.75f, 0.85f, 1f, 1f);
                }
                return _titleBarSubLabel;
            }
        }

        // ==================== Title Bar ====================

        /// <summary>
        /// Draws a Feel-style component title bar with Gatrix branding.
        /// Shows component name, subtitle, and optional live indicator.
        /// </summary>
        public static void DrawTitleBar(string componentName, string subtitle = null, bool showLiveIndicator = true)
        {
            var rect = EditorGUILayout.BeginHorizontal(GUILayout.Height(34));

            if (Event.current.type == EventType.Repaint)
            {
                // Main background
                EditorGUI.DrawRect(new Rect(rect.x - 4, rect.y, rect.width + 8, rect.height), _headerBgDark);
                // Blue accent bar on left
                EditorGUI.DrawRect(new Rect(rect.x - 4, rect.y, 4, rect.height), _gatrixBlue);
                // Bottom border
                EditorGUI.DrawRect(new Rect(rect.x - 4, rect.yMax - 1, rect.width + 8, 1), _gatrixBlueDim);
            }

            GUILayout.Space(8);

            // Gatrix logo dot
            var prevColor = GUI.color;
            GUI.color = _gatrixBlue;
            EditorGUILayout.LabelField("◆", new GUIStyle(EditorStyles.boldLabel)
            {
                fontSize = 10,
                alignment = TextAnchor.MiddleCenter,
                normal = { textColor = _gatrixBlue }
            }, GUILayout.Width(14));
            GUI.color = prevColor;

            GUILayout.Space(4);

            // Title + subtitle
            EditorGUILayout.BeginVertical();
            GUILayout.Space(4);
            EditorGUILayout.LabelField(componentName.ToUpper(), TitleBarLabel);
            if (!string.IsNullOrEmpty(subtitle))
            {
                EditorGUILayout.LabelField(subtitle, TitleBarSubLabel);
            }
            EditorGUILayout.EndVertical();

            GUILayout.FlexibleSpace();

            // Live indicator
            if (showLiveIndicator && Application.isPlaying && GatrixBehaviour.IsInitialized)
            {
                EditorGUILayout.BeginVertical();
                GUILayout.Space(8);
                var liveStyle = new GUIStyle(EditorStyles.miniLabel)
                {
                    fontStyle = FontStyle.Bold,
                    normal = { textColor = new Color(0.4f, 1f, 0.4f) }
                };
                EditorGUILayout.LabelField("● LIVE", liveStyle, GUILayout.Width(42));
                EditorGUILayout.EndVertical();
                GUILayout.Space(4);
            }

            // Gatrix label
            EditorGUILayout.BeginVertical();
            GUILayout.Space(10);
            var gatrixStyle = new GUIStyle(EditorStyles.miniLabel)
            {
                normal = { textColor = new Color(0.5f, 0.6f, 0.8f) },
                alignment = TextAnchor.MiddleRight
            };
            EditorGUILayout.LabelField("GATRIX", gatrixStyle, GUILayout.Width(46));
            EditorGUILayout.EndVertical();
            GUILayout.Space(4);

            EditorGUILayout.EndHorizontal();
            EditorGUILayout.Space(6);
        }

        // ==================== Section ====================

        /// <summary>
        /// Draws a section title with a splitter above it.
        /// </summary>
        public static void DrawSection(string title, string subtitle = null)
        {
            EditorGUILayout.Space(4);
            DrawSplitter();
            EditorGUILayout.Space(2);

            EditorGUILayout.BeginVertical();
            EditorGUILayout.LabelField(title, HeaderLabel);
            if (!string.IsNullOrEmpty(subtitle))
            {
                EditorGUILayout.LabelField(subtitle, SubHeaderLabel);
            }
            EditorGUILayout.EndVertical();

            EditorGUILayout.Space(2);
        }

        // ==================== Splitter ====================

        /// <summary>
        /// Draws a simple 1px splitter line.
        /// </summary>
        public static void DrawSplitter()
        {
            var rect = GUILayoutUtility.GetRect(1f, 1f);
            // Extend to full width without overflowing
            rect.xMin = 0f;
            rect.width = EditorGUIUtility.currentViewWidth;

            if (Event.current.type != EventType.Repaint)
                return;

            EditorGUI.DrawRect(rect, Splitter);
        }

        // ==================== Box ====================

        /// <summary>
        /// Begins a styled box group.
        /// </summary>
        public static void BeginBox()
        {
            EditorGUILayout.BeginVertical(EditorStyles.helpBox);
        }

        /// <summary>
        /// Ends a styled box group.
        /// </summary>
        public static void EndBox()
        {
            EditorGUILayout.EndVertical();
        }

        // ==================== Help Box ====================

        /// <summary>
        /// Draws a help box with a cleaner look.
        /// </summary>
        public static void DrawHelpBox(string message, MessageType type)
        {
            EditorGUILayout.HelpBox(message, type);
        }
    }
}
