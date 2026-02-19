// GatrixMonitorWindow - Events tab
// Real-time event log with colored type indicators and parameter display

#if UNITY_EDITOR
using System;
using UnityEditor;
using UnityEngine;

namespace Gatrix.Unity.SDK.Editor
{
    public partial class GatrixMonitorWindow
    {
        // ==================== Events ====================

        private void DrawEventsTab()
        {
            bool isDark = EditorGUIUtility.isProSkin;

            // Control bar
            EditorGUILayout.BeginHorizontal(EditorStyles.toolbar);
            EditorGUILayout.LabelField(
                $"Event Log  <color=#888888>({_eventLog.Count}/{MaxEventLogEntries})</color>",
                new GUIStyle(EditorStyles.toolbarButton) { richText = true, alignment = TextAnchor.MiddleLeft },
                GUILayout.ExpandWidth(true));
            GUILayout.FlexibleSpace();

            if (GUILayout.Button("Clear", EditorStyles.toolbarButton, GUILayout.Width(44)))
            {
                _eventLog.Clear();
            }

            var listeningLabel = _isListening ? "● Listening" : "○ Stopped";
            var listeningColor = _isListening ? new Color(0.4f, 1f, 0.4f) : new Color(0.7f, 0.7f, 0.7f);
            var listeningStyle = new GUIStyle(EditorStyles.toolbarButton)
            {
                normal = { textColor = listeningColor },
                fontStyle = FontStyle.Bold
            };
            if (GUILayout.Button(listeningLabel, listeningStyle, GUILayout.Width(80)))
            {
                if (_isListening) StopListening();
                else StartListening();
            }
            EditorGUILayout.EndHorizontal();

            EditorGUILayout.Space(2);

            if (_eventLog.Count == 0)
            {
                EditorGUILayout.Space(20);
                EditorGUILayout.BeginHorizontal();
                GUILayout.FlexibleSpace();
                EditorGUILayout.LabelField("No events captured yet.", EditorStyles.centeredGreyMiniLabel, GUILayout.Width(200));
                GUILayout.FlexibleSpace();
                EditorGUILayout.EndHorizontal();
                EditorGUILayout.Space(4);
                EditorGUILayout.BeginHorizontal();
                GUILayout.FlexibleSpace();
                EditorGUILayout.LabelField("Start the SDK and interact with flags.", EditorStyles.centeredGreyMiniLabel, GUILayout.Width(250));
                GUILayout.FlexibleSpace();
                EditorGUILayout.EndHorizontal();
                return;
            }

            // Column layout: Time | Type | Parameter
            const float timeW = 90;
            const float timeX = 4;
            const float typeX = timeW + 8;
            float totalW  = EditorGUIUtility.currentViewWidth;
            float typeW   = (totalW - typeX - 20) * 0.35f;
            float paramX  = typeX + typeW + 4;
            float paramW  = totalW - paramX - 16;

            // Table header
            var headerRect = EditorGUILayout.GetControlRect(false, 18);
            if (Event.current.type == EventType.Repaint)
            {
                EditorGUI.DrawRect(headerRect,
                    isDark ? new Color(0.13f, 0.13f, 0.15f, 1f) : new Color(0.70f, 0.70f, 0.72f, 1f));
            }
            var hStyle = new GUIStyle(EditorStyles.miniLabel)
            {
                fontStyle = FontStyle.Bold,
                normal    = { textColor = isDark ? new Color(0.55f, 0.60f, 0.65f) : new Color(0.28f, 0.30f, 0.33f) }
            };
            GUI.Label(new Rect(headerRect.x + timeX,  headerRect.y, timeW,  headerRect.height), "Time",      hStyle);
            GUI.Label(new Rect(headerRect.x + typeX,  headerRect.y, typeW,  headerRect.height), "Type",      hStyle);
            GUI.Label(new Rect(headerRect.x + paramX, headerRect.y, paramW, headerRect.height), "Parameter", hStyle);

            // Row styles
            var timeStyle = new GUIStyle(EditorStyles.miniLabel)
            {
                normal = { textColor = isDark ? new Color(0.50f, 0.53f, 0.58f) : new Color(0.45f, 0.48f, 0.52f) }
            };
            var typeStyle = new GUIStyle(EditorStyles.label)
            {
                fontSize = 11, fontStyle = FontStyle.Bold, richText = true
            };
            var paramStyle = new GUIStyle(EditorStyles.label)
            {
                fontSize = 11,
                normal = { textColor = isDark ? new Color(0.65f, 0.68f, 0.72f) : new Color(0.30f, 0.33f, 0.38f) }
            };

            _eventLogScroll = EditorGUILayout.BeginScrollView(_eventLogScroll, GUILayout.ExpandHeight(true));

            // Draw events in reverse (newest first)
            for (int i = _eventLog.Count - 1; i >= 0; i--)
            {
                var entry = _eventLog[i];
                int visIdx = _eventLog.Count - 1 - i;
                var rowRect = EditorGUILayout.GetControlRect(false, 20);

                // Alternating row tint
                if (Event.current.type == EventType.Repaint && visIdx % 2 == 0)
                {
                    EditorGUI.DrawRect(rowRect,
                        isDark ? new Color(0.16f, 0.16f, 0.18f, 0.5f) : new Color(0.84f, 0.84f, 0.86f, 0.5f));
                }

                // Time
                var timeStr = entry.Time.ToString("HH:mm:ss.fff");
                GUI.Label(new Rect(rowRect.x + timeX, rowRect.y, timeW, rowRect.height), timeStr, timeStyle);

                // Type (colored)
                var color = GetEventColor(entry.EventName);
                GUI.Label(new Rect(rowRect.x + typeX, rowRect.y, typeW, rowRect.height),
                    $"<color={color}>{entry.EventName}</color>", typeStyle);

                // Parameter
                if (!string.IsNullOrEmpty(entry.Details))
                {
                    GUI.Label(new Rect(rowRect.x + paramX, rowRect.y, paramW, rowRect.height),
                        new GUIContent(entry.Details, entry.Details), paramStyle);
                }
            }

            EditorGUILayout.EndScrollView();
        }
    }
}
#endif
