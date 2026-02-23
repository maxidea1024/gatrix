// GatrixEditorStyle - Unified styling for Gatrix Editor UIs
// Inspired by Emerald AI's clean, tab-based, color-coded inspector aesthetic

using UnityEngine;
using UnityEditor;

namespace Gatrix.Unity.SDK.Editor
{
    /// <summary>
    /// Unified styling for Gatrix Editor UIs.
    /// Inspired by Emerald AI's bold section headers, color-coded tabs, and clean group boxes.
    /// </summary>
    public static class GatrixEditorStyle
    {
        // ==================== Brand Colors ====================

        // Primary brand blue
        private static readonly Color _gatrixBlue      = new Color(0.22f, 0.52f, 0.95f, 1f);
        private static readonly Color _gatrixBlueDark  = new Color(0.14f, 0.34f, 0.70f, 1f);
        private static readonly Color _gatrixBlueLight = new Color(0.55f, 0.75f, 1.00f, 1f);

        // Category accent colors (Emerald AI uses distinct colors per section type)
        public static readonly Color AccentBlue   = new Color(0.22f, 0.52f, 0.95f, 1f);
        public static readonly Color AccentGreen  = new Color(0.20f, 0.75f, 0.40f, 1f);
        public static readonly Color AccentOrange = new Color(0.95f, 0.55f, 0.15f, 1f);
        public static readonly Color AccentPurple = new Color(0.60f, 0.30f, 0.90f, 1f);
        public static readonly Color AccentTeal   = new Color(0.15f, 0.70f, 0.75f, 1f);
        public static readonly Color AccentRed    = new Color(0.90f, 0.25f, 0.25f, 1f);
        public static readonly Color AccentGray   = new Color(0.50f, 0.50f, 0.55f, 1f);

        // Background colors
        private static Color SectionHeaderBg => EditorGUIUtility.isProSkin
            ? new Color(0.18f, 0.18f, 0.20f, 1f)
            : new Color(0.78f, 0.78f, 0.80f, 1f);

        private static Color GroupBodyBg => EditorGUIUtility.isProSkin
            ? new Color(0.20f, 0.20f, 0.22f, 0.5f)
            : new Color(0.88f, 0.88f, 0.90f, 0.5f);

        private static Color TitleBarBg => EditorGUIUtility.isProSkin
            ? new Color(0.13f, 0.13f, 0.15f, 1f)
            : new Color(0.82f, 0.82f, 0.84f, 1f);

        private static Color DefaultTextColor => EditorGUIUtility.isProSkin
            ? new Color(0.88f, 0.88f, 0.88f, 1f)
            : new Color(0.10f, 0.10f, 0.10f, 1f);

        private static Color SubTextColor => EditorGUIUtility.isProSkin
            ? new Color(0.60f, 0.65f, 0.72f, 1f)
            : new Color(0.35f, 0.38f, 0.42f, 1f);

        // ==================== Cached Styles ====================

        private static GUIStyle _titleBarLabel;
        private static GUIStyle TitleBarLabel
        {
            get
            {
                if (_titleBarLabel == null)
                {
                    _titleBarLabel = new GUIStyle(EditorStyles.boldLabel)
                    {
                        fontSize = 12,
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
                    _titleBarSubLabel.normal.textColor = new Color(0.70f, 0.82f, 1f, 1f);
                }
                return _titleBarSubLabel;
            }
        }

        private static GUIStyle _sectionHeaderLabel;
        private static GUIStyle SectionHeaderLabel
        {
            get
            {
                if (_sectionHeaderLabel == null)
                {
                    _sectionHeaderLabel = new GUIStyle(EditorStyles.boldLabel)
                    {
                        fontSize = 11,
                        alignment = TextAnchor.MiddleLeft,
                    };
                    _sectionHeaderLabel.normal.textColor = DefaultTextColor;
                }
                return _sectionHeaderLabel;
            }
        }

        public static GUIStyle HeaderLabel
        {
            get
            {
                var s = new GUIStyle(EditorStyles.boldLabel) { fontSize = 13 };
                s.normal.textColor = DefaultTextColor;
                return s;
            }
        }

        public static GUIStyle SubHeaderLabel
        {
            get
            {
                var s = new GUIStyle(EditorStyles.label) { fontSize = 10, fontStyle = FontStyle.Italic };
                s.normal.textColor = SubTextColor;
                return s;
            }
        }

        public static Color Splitter => EditorGUIUtility.isProSkin
            ? new Color(0.12f, 0.12f, 0.14f, 1f)
            : new Color(0.58f, 0.58f, 0.60f, 1f);

        // ==================== Title Bar ====================

        /// <summary>
        /// Draws an Emerald AI-style component title bar.
        /// Dark background with left color accent, component name, subtitle, and live indicator.
        /// </summary>
        public static void DrawTitleBar(string componentName, string subtitle = null, bool showLiveIndicator = true)
        {
            DrawTitleBar(componentName, subtitle, showLiveIndicator, _gatrixBlue);
        }

        /// <summary>
        /// Draws a title bar with a custom accent color.
        /// </summary>
        public static void DrawTitleBar(string componentName, string subtitle, bool showLiveIndicator, Color accentColor)
        {
            float barHeight = string.IsNullOrEmpty(subtitle) ? 32f : 42f;
            var rect = GUILayoutUtility.GetRect(0, barHeight, GUILayout.ExpandWidth(true));
            float fullWidth = EditorGUIUtility.currentViewWidth;

            if (Event.current.type == EventType.Repaint)
            {
                // Main dark background
                EditorGUI.DrawRect(new Rect(0, rect.y, fullWidth, rect.height), TitleBarBg);
                // Left accent bar (4px, Emerald AI style)
                EditorGUI.DrawRect(new Rect(0, rect.y, 4, rect.height), accentColor);
                // Bottom separator line
                EditorGUI.DrawRect(new Rect(0, rect.yMax - 1, fullWidth, 1), new Color(accentColor.r, accentColor.g, accentColor.b, 0.5f));
            }

            // Diamond icon
            var iconStyle = new GUIStyle(EditorStyles.boldLabel)
            {
                fontSize = 10,
                alignment = TextAnchor.MiddleCenter,
                normal = { textColor = accentColor }
            };
            GUI.Label(new Rect(rect.x + 8, rect.y, 16, rect.height), "\u25c6", iconStyle);

            // Component name
            float titleY = string.IsNullOrEmpty(subtitle) ? rect.y + 7f : rect.y + 5f;
            GUI.Label(new Rect(rect.x + 28, titleY, rect.width - 130, 18), componentName.ToUpper(), TitleBarLabel);

            // Subtitle
            if (!string.IsNullOrEmpty(subtitle))
            {
                GUI.Label(new Rect(rect.x + 28, rect.y + 22, rect.width - 130, 14), subtitle, TitleBarSubLabel);
            }

            // LIVE indicator (play mode + initialized)
            if (showLiveIndicator && Application.isPlaying && GatrixBehaviour.IsInitialized)
            {
                var liveStyle = new GUIStyle(EditorStyles.miniLabel)
                {
                    fontStyle = FontStyle.Bold,
                    normal = { textColor = new Color(0.35f, 1f, 0.45f) }
                };
                var liveRect = new Rect(rect.xMax - 100, rect.y + (rect.height - 14) / 2f, 50, 14);
                GUI.Label(liveRect, "\u25cf LIVE", liveStyle);
            }

            // GATRIX brand label (right)
            var brandStyle = new GUIStyle(EditorStyles.miniLabel)
            {
                normal = { textColor = new Color(accentColor.r * 0.7f, accentColor.g * 0.7f, accentColor.b * 0.9f) },
                alignment = TextAnchor.MiddleRight
            };
            GUI.Label(new Rect(rect.xMax - 48, rect.y + (rect.height - 14) / 2f, 46, 14), "GATRIX", brandStyle);

            EditorGUILayout.Space(2);
        }

        // ==================== Section Header (Emerald AI style) ====================

        /// <summary>
        /// Draws an Emerald AI-style section header: colored left bar + bold label on a tinted background.
        /// </summary>
        public static void DrawSection(string title, string subtitle = null)
        {
            DrawSection(title, subtitle, AccentBlue);
        }

        /// <summary>
        /// Draws a section header with a custom accent color.
        /// </summary>
        public static void DrawSection(string title, string subtitle, Color accentColor)
        {
            EditorGUILayout.Space(6);

            float height = string.IsNullOrEmpty(subtitle) ? 22f : 32f;
            var rect = GUILayoutUtility.GetRect(0, height, GUILayout.ExpandWidth(true));
            float fullWidth = EditorGUIUtility.currentViewWidth;

            if (Event.current.type == EventType.Repaint)
            {
                // Section header background
                EditorGUI.DrawRect(new Rect(0, rect.y, fullWidth, rect.height), SectionHeaderBg);
                // Left color accent (3px)
                EditorGUI.DrawRect(new Rect(0, rect.y, 3, rect.height), accentColor);
                // Bottom line
                EditorGUI.DrawRect(new Rect(0, rect.yMax - 1, fullWidth, 1), new Color(accentColor.r, accentColor.g, accentColor.b, 0.35f));
            }

            // Section title
            var labelStyle = new GUIStyle(EditorStyles.boldLabel)
            {
                fontSize = 11,
                alignment = TextAnchor.MiddleLeft,
                normal = { textColor = DefaultTextColor }
            };
            float titleY = string.IsNullOrEmpty(subtitle) ? rect.y : rect.y + 2;
            GUI.Label(new Rect(rect.x + 8, titleY, rect.width - 16, 18), title, labelStyle);

            if (!string.IsNullOrEmpty(subtitle))
            {
                var subStyle = new GUIStyle(EditorStyles.miniLabel)
                {
                    normal = { textColor = SubTextColor }
                };
                GUI.Label(new Rect(rect.x + 8, rect.y + 18, rect.width - 16, 13), subtitle, subStyle);
            }

            EditorGUILayout.Space(3);
        }

        // ==================== Window Header (for EditorWindow) ====================

        /// <summary>
        /// Draws a window-level header bar.
        /// Uses EditorGUILayout.GetControlRect for reliable layout reservation.
        /// Call this BEFORE BeginScrollView.
        /// </summary>
        public static void DrawWindowHeader(string title, string subtitle, string icon = "\u25c6", float height = 44f)
        {
            var rect = EditorGUILayout.GetControlRect(false, height);
            float fullWidth = EditorGUIUtility.currentViewWidth;

            if (Event.current.type == EventType.Repaint)
            {
                EditorGUI.DrawRect(new Rect(0, rect.y, fullWidth, rect.height), TitleBarBg);
                EditorGUI.DrawRect(new Rect(0, rect.y, 4, rect.height), AccentBlue);
                EditorGUI.DrawRect(new Rect(0, rect.yMax - 1, fullWidth, 1),
                    new Color(AccentBlue.r, AccentBlue.g, AccentBlue.b, 0.5f));
            }

            // Icon
            var iconStyle = new GUIStyle(EditorStyles.boldLabel)
            {
                fontSize = 14, alignment = TextAnchor.MiddleCenter,
                normal = { textColor = AccentBlue }
            };
            GUI.Label(new Rect(rect.x + 8, rect.y, 20, rect.height), icon, iconStyle);

            // Title + subtitle
            float titleY = string.IsNullOrEmpty(subtitle)
                ? rect.y + (rect.height - 16) / 2f
                : rect.y + (rect.height - 34) / 2f;
            GUI.Label(new Rect(rect.x + 30, titleY, rect.width - 40, 18), title, TitleBarLabel);
            if (!string.IsNullOrEmpty(subtitle))
            {
                GUI.Label(new Rect(rect.x + 30, titleY + 18, rect.width - 40, 14), subtitle, TitleBarSubLabel);
            }
        }

        // ==================== Section Header (for EditorWindow content) ====================

        /// <summary>
        /// Draws a section header bar with left accent color.
        /// Uses EditorGUILayout.GetControlRect for reliable layout reservation.
        /// </summary>
        public static void DrawSectionHeader(string title, Color accentColor)
        {
            EditorGUILayout.Space(6);
            var rect = EditorGUILayout.GetControlRect(false, 22);

            if (Event.current.type == EventType.Repaint)
            {
                EditorGUI.DrawRect(rect, SectionHeaderBg);
                EditorGUI.DrawRect(new Rect(rect.x, rect.y, 3, rect.height), accentColor);
                EditorGUI.DrawRect(new Rect(rect.x, rect.yMax - 1, rect.width, 1),
                    new Color(accentColor.r, accentColor.g, accentColor.b, 0.3f));
            }

            var style = new GUIStyle(EditorStyles.boldLabel)
            {
                fontSize = 11, alignment = TextAnchor.MiddleLeft,
                normal = { textColor = DefaultTextColor }
            };
            EditorGUI.LabelField(new Rect(rect.x + 10, rect.y, rect.width - 14, rect.height), title, style);

            EditorGUILayout.Space(4);
        }

        // ==================== Splitter ====================

        public static void DrawSplitter()
        {
            var rect = EditorGUILayout.GetControlRect(false, 1);
            if (Event.current.type == EventType.Repaint)
                EditorGUI.DrawRect(new Rect(0, rect.y, EditorGUIUtility.currentViewWidth, 1), Splitter);
        }

        // ==================== Box / Group ====================

        private static GUIStyle _boxStyle;
        private static GUIStyle BoxStyle
        {
            get
            {
                if (_boxStyle == null)
                {
                    _boxStyle = new GUIStyle(EditorStyles.helpBox)
                    {
                        padding = new RectOffset(8, 8, 6, 6),
                        margin  = new RectOffset(0, 0, 2, 4),
                    };
                }
                return _boxStyle;
            }
        }

        /// <summary>Begins a styled content box (Emerald AI group body style).</summary>
        public static void BeginBox()
        {
            EditorGUILayout.BeginVertical(BoxStyle);
        }

        /// <summary>Ends a styled content box.</summary>
        public static void EndBox()
        {
            EditorGUILayout.EndVertical();
        }

        // ==================== Group with Header (Emerald AI style) ====================

        /// <summary>
        /// Draws an Emerald AI-style group header bar with a colored left accent.
        /// Call EndGroup() to close.
        /// </summary>
        public static void BeginGroup(string label, Color accentColor, string icon = "")
        {
            EditorGUILayout.BeginVertical(BoxStyle);

            // Header bar
            var headerRect = EditorGUILayout.GetControlRect(false, 20);
            var bgColor = EditorGUIUtility.isProSkin
                ? new Color(0.16f, 0.16f, 0.18f, 1f)
                : new Color(0.74f, 0.74f, 0.76f, 1f);

            if (Event.current.type == EventType.Repaint)
            {
                EditorGUI.DrawRect(headerRect, bgColor);
                // Left accent (3px)
                EditorGUI.DrawRect(new Rect(headerRect.x, headerRect.y, 3, headerRect.height), accentColor);
            }

            var headerStyle = new GUIStyle(EditorStyles.boldLabel)
            {
                fontSize = 10,
                alignment = TextAnchor.MiddleLeft,
                normal = { textColor = DefaultTextColor }
            };
            var displayLabel = string.IsNullOrEmpty(icon) ? label : $"{icon}  {label}";
            GUI.Label(new Rect(headerRect.x + 8, headerRect.y, headerRect.width - 8, headerRect.height), displayLabel, headerStyle);

            EditorGUILayout.Space(4);
        }

        /// <summary>Ends a group started with BeginGroup.</summary>
        public static void EndGroup()
        {
            EditorGUILayout.Space(2);
            EditorGUILayout.EndVertical();
            EditorGUILayout.Space(4);
        }

        // ==================== Help Box ====================

        /// <summary>
        /// Draws a styled help/info/warning box with correct text color in both dark and light themes.
        /// Replaces EditorGUILayout.HelpBox which renders black text in dark theme.
        /// </summary>
        public static void DrawHelpBox(string message, MessageType type = MessageType.None)
        {
            string icon;
            Color bgColor, borderColor, textColor;
            bool isDark = EditorGUIUtility.isProSkin;

            switch (type)
            {
                case MessageType.Warning:
                    icon        = "\u26a0";
                    bgColor     = isDark ? new Color(0.45f, 0.35f, 0f,   0.45f) : new Color(1f,    0.95f, 0.70f, 1f);
                    borderColor = isDark ? new Color(0.80f, 0.65f, 0f,   0.60f) : new Color(0.80f, 0.65f, 0f,   0.80f);
                    textColor   = isDark ? new Color(1f,    0.88f, 0.40f)        : new Color(0.40f, 0.30f, 0f);
                    break;
                case MessageType.Error:
                    icon        = "\u2716";
                    bgColor     = isDark ? new Color(0.50f, 0.10f, 0.10f, 0.45f) : new Color(1f,    0.85f, 0.85f, 1f);
                    borderColor = isDark ? new Color(0.90f, 0.30f, 0.30f, 0.60f) : new Color(0.80f, 0.20f, 0.20f, 0.80f);
                    textColor   = isDark ? new Color(1f,    0.55f, 0.55f)         : new Color(0.50f, 0.05f, 0.05f);
                    break;
                case MessageType.Info:
                    icon        = "\u2139";
                    bgColor     = isDark ? new Color(0.10f, 0.25f, 0.45f, 0.45f) : new Color(0.85f, 0.93f, 1f,   1f);
                    borderColor = isDark ? new Color(0.20f, 0.50f, 0.90f, 0.50f) : new Color(0.20f, 0.50f, 0.90f, 0.60f);
                    textColor   = isDark ? new Color(0.75f, 0.88f, 1f)            : new Color(0.05f, 0.20f, 0.45f);
                    break;
                default:
                    icon        = "\u2022";
                    bgColor     = isDark ? new Color(0.20f, 0.20f, 0.22f, 0.40f) : new Color(0.90f, 0.90f, 0.92f, 1f);
                    borderColor = isDark ? new Color(0.40f, 0.40f, 0.44f, 0.50f) : new Color(0.60f, 0.60f, 0.62f, 0.60f);
                    textColor   = isDark ? new Color(0.85f, 0.85f, 0.85f)         : new Color(0.15f, 0.15f, 0.15f);
                    break;
            }

            var textStyle = new GUIStyle(EditorStyles.wordWrappedLabel)
            {
                fontSize = 11,
                wordWrap = true,
                normal   = { textColor = textColor },
                padding  = new RectOffset(0, 0, 0, 0),
                margin   = new RectOffset(0, 0, 0, 0),
            };
            var iconStyle = new GUIStyle(EditorStyles.boldLabel)
            {
                fontSize  = 13,
                alignment = TextAnchor.UpperCenter,
                normal    = { textColor = textColor },
                padding   = new RectOffset(0, 0, 0, 0),
                margin    = new RectOffset(0, 0, 0, 0),
            };

            float textWidth  = EditorGUIUtility.currentViewWidth - 52f;
            float textHeight = textStyle.CalcHeight(new GUIContent(message), Mathf.Max(textWidth, 100f));
            float boxHeight  = Mathf.Max(28f, textHeight + 12f);

            // Use EditorGUILayout.GetControlRect for reliable layout reservation
            var outerRect = EditorGUILayout.GetControlRect(false, boxHeight + 4f);
            var boxRect   = new Rect(outerRect.x + 4, outerRect.y + 2, outerRect.width - 8, boxHeight);

            if (Event.current.type == EventType.Repaint)
            {
                EditorGUI.DrawRect(boxRect, bgColor);
                EditorGUI.DrawRect(new Rect(boxRect.x,        boxRect.y,        boxRect.width, 1),             borderColor);
                EditorGUI.DrawRect(new Rect(boxRect.x,        boxRect.yMax - 1, boxRect.width, 1),             borderColor);
                EditorGUI.DrawRect(new Rect(boxRect.x,        boxRect.y,        1,             boxRect.height), borderColor);
                EditorGUI.DrawRect(new Rect(boxRect.xMax - 1, boxRect.y,        1,             boxRect.height), borderColor);
            }

            GUI.Label(new Rect(boxRect.x + 6,  boxRect.y + 6, 18,                 18),            icon,    iconStyle);
            GUI.Label(new Rect(boxRect.x + 28, boxRect.y + 6, boxRect.width - 34, boxHeight - 12), message, textStyle);

            EditorGUILayout.Space(2);
        }
    }
}
