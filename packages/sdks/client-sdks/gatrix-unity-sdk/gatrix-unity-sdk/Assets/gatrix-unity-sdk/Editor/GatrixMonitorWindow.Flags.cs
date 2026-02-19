// GatrixMonitorWindow - Flags tab
// Feature flag table with search, explicit sync view, and change highlighting

#if UNITY_EDITOR
using System.Collections.Generic;
using UnityEditor;
using UnityEngine;

namespace Gatrix.Unity.SDK.Editor
{
    public partial class GatrixMonitorWindow
    {
        // ==================== Flags ====================

        private void DrawFlags()
        {
            EditorGUILayout.BeginHorizontal();
            EditorGUILayout.LabelField("Feature Flags", _headerStyle, GUILayout.ExpandWidth(true));

            if (_cachedFlags != null)
            {
                EditorGUILayout.LabelField(
                    $"({_cachedFlags.Count} flags)",
                    GUILayout.Width(80));
            }
            EditorGUILayout.EndHorizontal();

            // Search
            EditorGUILayout.BeginHorizontal();
            EditorGUILayout.LabelField("Search:", GUILayout.Width(50));
            _flagSearchFilter = EditorGUILayout.TextField(_flagSearchFilter);
            if (GUILayout.Button("Clear", GUILayout.Width(50)))
            {
                _flagSearchFilter = "";
            }
            EditorGUILayout.EndHorizontal();

            EditorGUILayout.Space(4);

            if (_cachedFlags == null || _cachedFlags.Count == 0)
            {
                EditorGUILayout.HelpBox("No flags loaded yet.", MessageType.Info);
                return;
            }

            var filter = _flagSearchFilter?.ToLowerInvariant() ?? "";

            // Explicit sync mode: show two sections
            if (_cachedExplicitSync)
            {
                DrawExplicitSyncView(filter);
            }
            else
            {
                DrawFlagTable(_cachedFlags, filter);
            }
        }

        private void DrawExplicitSyncView(string filter)
        {
            // Sync control bar
            GatrixEditorStyle.BeginBox();
            EditorGUILayout.BeginHorizontal();
            EditorGUILayout.LabelField(
                _cachedPendingSync
                    ? "<color=#ffcc66>● Pending changes available</color>"
                    : "<color=#88ff88>● Synchronized</color>",
                _statusLabelStyle, GUILayout.ExpandWidth(true));

            GUI.enabled = _cachedPendingSync;
            if (GUILayout.Button("Sync Flags", GUILayout.Width(90)))
            {
                var client = GatrixBehaviour.Client;
                if (client != null)
                {
                    _ = client.Features.SyncFlagsAsync(false);
                    RefreshData();
                }
            }
            GUI.enabled = true;
            EditorGUILayout.EndHorizontal();
            GatrixEditorStyle.EndBox();

            // Synchronized flags section
            GatrixEditorStyle.DrawSection("Synchronized Flags (Active)");
            DrawFlagTable(_cachedFlags, filter);

            // Realtime flags section (pending)
            if (_cachedRealtimeFlags != null && _cachedPendingSync)
            {
                GatrixEditorStyle.DrawSection("Realtime Flags (Pending Sync)");
                DrawFlagTable(_cachedRealtimeFlags, filter);
            }
        }

        private void DrawFlagTable(List<EvaluatedFlag> flags, string filter)
        {
            bool isDark = EditorGUIUtility.isProSkin;

            // Column layout: State | Name | Variant | Type | Value | Rev (same as Inspector)
            const float stateX = 4;
            const float stateW = 38;
            const float nameX  = 48;
            const float typeW  = 50;
            const float revW   = 30;
            float totalW   = EditorGUIUtility.currentViewWidth;
            float dynamicW = totalW - nameX - typeW - revW - 30;
            float nameW    = dynamicW * 0.25f;
            float variantX = nameX + nameW;
            float variantW = dynamicW * 0.38f;
            float typeX    = variantX + variantW;
            float valueX   = typeX + typeW;
            float valueW   = dynamicW * 0.37f;
            float revX     = valueX + valueW + 4;

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
            GUI.Label(new Rect(headerRect.x + stateX,   headerRect.y, stateW,   headerRect.height), "State",   hStyle);
            GUI.Label(new Rect(headerRect.x + nameX,    headerRect.y, nameW,    headerRect.height), "Name",    hStyle);
            GUI.Label(new Rect(headerRect.x + variantX, headerRect.y, variantW, headerRect.height), "Variant", hStyle);
            GUI.Label(new Rect(headerRect.x + typeX,    headerRect.y, typeW,    headerRect.height), "Type",    hStyle);
            GUI.Label(new Rect(headerRect.x + valueX,   headerRect.y, valueW,   headerRect.height), "Value",   hStyle);
            var revHStyle = new GUIStyle(hStyle) { alignment = TextAnchor.MiddleRight };
            GUI.Label(new Rect(headerRect.x + revX,     headerRect.y, revW,     headerRect.height), "Rev",     revHStyle);

            // Styles for rows
            var flagOnStyle = new GUIStyle(EditorStyles.miniLabel)
            {
                fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleCenter,
                normal = { textColor = Color.white }
            };
            var flagOffStyle = new GUIStyle(flagOnStyle);
            var rowValueStyle = new GUIStyle(EditorStyles.label)
            {
                fontSize = 11,
                normal = { textColor = isDark ? new Color(0.88f, 0.90f, 0.92f) : new Color(0.08f, 0.10f, 0.12f) }
            };
            var rowLabelStyle = new GUIStyle(EditorStyles.label)
            {
                fontSize = 11,
                normal = { textColor = isDark ? new Color(0.58f, 0.63f, 0.70f) : new Color(0.32f, 0.35f, 0.40f) }
            };
            var revStyle = new GUIStyle(EditorStyles.miniLabel)
            {
                alignment = TextAnchor.MiddleRight,
                normal = { textColor = isDark ? new Color(0.50f, 0.53f, 0.58f) : new Color(0.40f, 0.42f, 0.45f) }
            };

            int visibleIndex = 0;
            for (int i = 0; i < flags.Count; i++)
            {
                var flag = flags[i];
                if (!string.IsNullOrEmpty(filter) &&
                    !flag.Name.ToLowerInvariant().Contains(filter))
                    continue;

                var rowRect = EditorGUILayout.GetControlRect(false, 20);

                // Change highlight or alternating tint
                bool isChanged = _changedFlagTimes.TryGetValue(flag.Name, out float changeTime);
                float elapsed = isChanged ? (float)EditorApplication.timeSinceStartup - changeTime : HighlightDuration;
                bool showHighlight = isChanged && elapsed < HighlightDuration;

                if (Event.current.type == EventType.Repaint)
                {
                    if (showHighlight)
                    {
                        float alpha = Mathf.Lerp(0.35f, 0f, elapsed / HighlightDuration);
                        EditorGUI.DrawRect(rowRect, new Color(1f, 0.85f, 0f, alpha));
                    }
                    else if (visibleIndex % 2 == 0)
                    {
                        EditorGUI.DrawRect(rowRect,
                            isDark ? new Color(0.16f, 0.16f, 0.18f, 0.5f) : new Color(0.84f, 0.84f, 0.86f, 0.5f));
                    }
                }

                // ON/OFF badge
                bool on = flag.Enabled;
                var badgeColor = on ? new Color(0.10f, 0.45f, 0.18f, 1f) : new Color(0.45f, 0.10f, 0.10f, 1f);
                var badgeRect  = new Rect(rowRect.x + stateX, rowRect.y + 3, stateW, 14);
                if (Event.current.type == EventType.Repaint)
                    EditorGUI.DrawRect(badgeRect, badgeColor);
                GUI.Label(badgeRect, on ? "ON" : "OFF", on ? flagOnStyle : flagOffStyle);

                // Name
                GUI.Label(new Rect(rowRect.x + nameX, rowRect.y, nameW, rowRect.height),
                    new GUIContent(flag.Name, flag.Name), rowValueStyle);

                // Variant
                GUI.Label(new Rect(rowRect.x + variantX, rowRect.y, variantW, rowRect.height),
                    new GUIContent(flag.Variant?.Name ?? "", flag.Variant?.Name ?? ""), rowLabelStyle);

                // Type
                GUI.Label(new Rect(rowRect.x + typeX, rowRect.y, typeW, rowRect.height),
                    ValueTypeHelper.ToApiString(flag.ValueType), rowLabelStyle);

                // Value
                string valueStr = FormatPayload(flag.Variant?.Value);
                GUI.Label(new Rect(rowRect.x + valueX, rowRect.y, valueW, rowRect.height),
                    new GUIContent(valueStr, flag.Variant?.Value?.ToString() ?? ""), rowValueStyle);

                // Revision
                GUI.Label(new Rect(rowRect.x + revX, rowRect.y, revW, rowRect.height),
                    flag.Version.ToString(), revStyle);

                visibleIndex++;
            }

            if (visibleIndex == 0)
            {
                GatrixEditorStyle.DrawHelpBox("No flags found matching filter.", MessageType.Info);
            }
        }

        private static string FormatPayload(object payload)
        {
            if (payload == null) return "-";
            if (payload is bool boolVal) return boolVal ? "true" : "false";
            var str = payload.ToString();
            if (str == "") return "\"\"";
            if (str.Length > 50) str = str.Substring(0, 47) + "...";
            return str;
        }

        private static void DrawDashedBorderBox(Rect rect, string text)
        {
            if (Event.current.type != EventType.Repaint)
            {
                // Still draw the label even during layout
                var labelRectLayout = new Rect(rect.x + 4, rect.y, rect.width - 8, rect.height);
                var layoutStyle = new GUIStyle(EditorStyles.miniLabel)
                {
                    normal = { textColor = new Color(0.85f, 0.85f, 0.85f) }
                };
                GUI.Label(labelRectLayout, text, layoutStyle);
                return;
            }

            // Clamp to avoid overflow
            var clampedRect = new Rect(
                rect.x,
                rect.y,
                Mathf.Max(0, rect.width - 1),
                rect.height);

            // Background fill
            var bgRect = new Rect(clampedRect.x + 1, clampedRect.y + 1, clampedRect.width - 2, clampedRect.height - 2);
            EditorGUI.DrawRect(bgRect, new Color(0.15f, 0.15f, 0.15f, 0.5f));

            // Solid border
            var borderColor = new Color(0.5f, 0.5f, 0.5f, 0.6f);
            EditorGUI.DrawRect(new Rect(clampedRect.x, clampedRect.y, clampedRect.width, 1), borderColor);
            EditorGUI.DrawRect(new Rect(clampedRect.x, clampedRect.yMax - 1, clampedRect.width, 1), borderColor);
            EditorGUI.DrawRect(new Rect(clampedRect.x, clampedRect.y, 1, clampedRect.height), borderColor);
            EditorGUI.DrawRect(new Rect(clampedRect.xMax - 1, clampedRect.y, 1, clampedRect.height), borderColor);

            // Text inside
            var labelRect = new Rect(clampedRect.x + 4, clampedRect.y, clampedRect.width - 8, clampedRect.height);
            var style = new GUIStyle(EditorStyles.miniLabel)
            {
                normal = { textColor = new Color(0.85f, 0.85f, 0.85f) }
            };
            GUI.Label(labelRect, text, style);
        }
    }
}
#endif
