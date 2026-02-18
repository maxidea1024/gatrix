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
            // Use GetControlRect to avoid GUIClip imbalance from BeginHorizontal(GUILayout.Height)
            float barHeight = string.IsNullOrEmpty(subtitle) ? 30f : 38f;
            var rect = GUILayoutUtility.GetRect(0, barHeight, GUILayout.ExpandWidth(true));

            if (Event.current.type == EventType.Repaint)
            {
                float fullWidth = EditorGUIUtility.currentViewWidth;
                // Main background (extend to full window width)
                EditorGUI.DrawRect(new Rect(0, rect.y, fullWidth, rect.height), _headerBgDark);
                // Blue accent bar on left
                EditorGUI.DrawRect(new Rect(0, rect.y, 4, rect.height), _gatrixBlue);
                // Bottom border
                EditorGUI.DrawRect(new Rect(0, rect.yMax - 1, fullWidth, 1), _gatrixBlueDim);
            }

            // Diamond icon
            var dotStyle = new GUIStyle(EditorStyles.boldLabel)
            {
                fontSize = 10,
                alignment = TextAnchor.MiddleCenter,
                normal = { textColor = _gatrixBlue }
            };
            GUI.Label(new Rect(rect.x + 8, rect.y, 16, rect.height), "\u25c6", dotStyle);

            // Title
            var titleRect = new Rect(rect.x + 28, rect.y + (string.IsNullOrEmpty(subtitle) ? 6f : 4f), rect.width - 120, 18);
            GUI.Label(titleRect, componentName.ToUpper(), TitleBarLabel);

            // Subtitle
            if (!string.IsNullOrEmpty(subtitle))
            {
                var subRect = new Rect(rect.x + 28, rect.y + 20, rect.width - 120, 14);
                GUI.Label(subRect, subtitle, TitleBarSubLabel);
            }

            // LIVE indicator
            if (showLiveIndicator && Application.isPlaying && GatrixBehaviour.IsInitialized)
            {
                var liveStyle = new GUIStyle(EditorStyles.miniLabel)
                {
                    fontStyle = FontStyle.Bold,
                    normal = { textColor = new Color(0.4f, 1f, 0.4f) }
                };
                var liveRect = new Rect(rect.xMax - 96, rect.y + (rect.height - 14) / 2f, 46, 14);
                GUI.Label(liveRect, "\u25cf LIVE", liveStyle);
            }

            // GATRIX label (right side)
            var gatrixStyle = new GUIStyle(EditorStyles.miniLabel)
            {
                normal = { textColor = new Color(0.5f, 0.6f, 0.8f) },
                alignment = TextAnchor.MiddleRight
            };
            var gatrixRect = new Rect(rect.xMax - 48, rect.y + (rect.height - 14) / 2f, 46, 14);
            GUI.Label(gatrixRect, "GATRIX", gatrixStyle);

            EditorGUILayout.Space(4);
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
        /// Draws a styled help/info/warning box with correct text color in both dark and light themes.
        /// Replaces EditorGUILayout.HelpBox which renders black text in dark theme.
        /// </summary>
        public static void DrawHelpBox(string message, MessageType type = MessageType.None)
        {
            // Icon and colors per message type
            string icon;
            Color bgColor;
            Color borderColor;
            Color textColor;

            bool isDark = EditorGUIUtility.isProSkin;

            switch (type)
            {
                case MessageType.Warning:
                    icon = "\u26a0";  // ⚠
                    bgColor    = isDark ? new Color(0.45f, 0.35f, 0f, 0.45f)   : new Color(1f, 0.95f, 0.7f, 1f);
                    borderColor = isDark ? new Color(0.8f, 0.65f, 0f, 0.6f)    : new Color(0.8f, 0.65f, 0f, 0.8f);
                    textColor  = isDark ? new Color(1f, 0.88f, 0.4f)            : new Color(0.4f, 0.3f, 0f);
                    break;
                case MessageType.Error:
                    icon = "\u2716";  // ✖
                    bgColor    = isDark ? new Color(0.5f, 0.1f, 0.1f, 0.45f)   : new Color(1f, 0.85f, 0.85f, 1f);
                    borderColor = isDark ? new Color(0.9f, 0.3f, 0.3f, 0.6f)   : new Color(0.8f, 0.2f, 0.2f, 0.8f);
                    textColor  = isDark ? new Color(1f, 0.55f, 0.55f)           : new Color(0.5f, 0.05f, 0.05f);
                    break;
                case MessageType.Info:
                    icon = "\u2139";  // ℹ
                    bgColor    = isDark ? new Color(0.1f, 0.25f, 0.45f, 0.45f) : new Color(0.85f, 0.93f, 1f, 1f);
                    borderColor = isDark ? new Color(0.2f, 0.5f, 0.9f, 0.5f)   : new Color(0.2f, 0.5f, 0.9f, 0.6f);
                    textColor  = isDark ? new Color(0.75f, 0.88f, 1f)           : new Color(0.05f, 0.2f, 0.45f);
                    break;
                default:
                    icon = "\u2022";  // •
                    bgColor    = isDark ? new Color(0.2f, 0.2f, 0.2f, 0.4f)    : new Color(0.9f, 0.9f, 0.9f, 1f);
                    borderColor = isDark ? new Color(0.4f, 0.4f, 0.4f, 0.5f)   : new Color(0.6f, 0.6f, 0.6f, 0.6f);
                    textColor  = isDark ? new Color(0.85f, 0.85f, 0.85f)        : new Color(0.15f, 0.15f, 0.15f);
                    break;
            }

            var textStyle = new GUIStyle(EditorStyles.wordWrappedLabel)
            {
                fontSize = 11,
                richText = false,
                wordWrap = true,
                normal = { textColor = textColor },
                padding = new RectOffset(0, 0, 0, 0),
                margin  = new RectOffset(0, 0, 0, 0),
            };

            var iconStyle = new GUIStyle(EditorStyles.boldLabel)
            {
                fontSize = 13,
                alignment = TextAnchor.UpperCenter,
                normal = { textColor = textColor },
                padding = new RectOffset(0, 0, 0, 0),
                margin  = new RectOffset(0, 0, 0, 0),
            };

            // Measure height needed
            float textWidth = EditorGUIUtility.currentViewWidth - 52f; // account for icon + padding
            float textHeight = textStyle.CalcHeight(new GUIContent(message), textWidth);
            float boxHeight = Mathf.Max(28f, textHeight + 12f);

            var boxRect = GUILayoutUtility.GetRect(0, boxHeight, GUILayout.ExpandWidth(true));

            if (Event.current.type == EventType.Repaint)
            {
                // Background
                EditorGUI.DrawRect(boxRect, bgColor);
                // Border (top, bottom, left, right)
                EditorGUI.DrawRect(new Rect(boxRect.x, boxRect.y, boxRect.width, 1), borderColor);
                EditorGUI.DrawRect(new Rect(boxRect.x, boxRect.yMax - 1, boxRect.width, 1), borderColor);
                EditorGUI.DrawRect(new Rect(boxRect.x, boxRect.y, 1, boxRect.height), borderColor);
                EditorGUI.DrawRect(new Rect(boxRect.xMax - 1, boxRect.y, 1, boxRect.height), borderColor);
            }

            // Icon
            var iconRect = new Rect(boxRect.x + 6, boxRect.y + 6, 18, 18);
            GUI.Label(iconRect, icon, iconStyle);

            // Message text
            var msgRect = new Rect(boxRect.x + 28, boxRect.y + 6, boxRect.width - 34, boxHeight - 12);
            GUI.Label(msgRect, message, textStyle);

            EditorGUILayout.Space(2);
        }
    }
}
