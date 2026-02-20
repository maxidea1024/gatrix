// GatrixFlagTable - Shared flag table renderer
// Used by both GatrixMonitorWindow (Flags tab) and GatrixBehaviourInspector.
// Supports inline pending-change sub-rows and transient flash highlighting.

#if UNITY_EDITOR
using System.Collections.Generic;
using UnityEditor;
using UnityEngine;

namespace Gatrix.Unity.SDK.Editor
{
    /// <summary>
    /// Shared static renderer for the feature-flag table used in the Monitor
    /// window and the GatrixBehaviour inspector.
    /// </summary>
    internal static class GatrixFlagTable
    {
        // ─── Public entry point ─────────────────────────────────────────────

        /// <summary>
        /// Draws the flag table with header, rows, and optional pending sub-rows.
        /// </summary>
        /// <param name="flags">Synchronized (active) flag list to display.</param>
        /// <param name="filter">Lower-case search string; empty = show all.</param>
        /// <param name="changedTimes">Optional map of flag name → timeSinceStartup when it last changed (for flash highlight).</param>
        /// <param name="highlightDuration">How long the flash highlight lasts in seconds.</param>
        /// <param name="pendingMap">Optional map of flag name → realtime flag (for pending sub-rows).</param>
        public static void Draw(
            List<EvaluatedFlag> flags,
            string filter = "",
            Dictionary<string, float> changedTimes = null,
            float highlightDuration = 2f,
            Dictionary<string, EvaluatedFlag> pendingMap = null)
        {
            if (flags == null || flags.Count == 0)
            {
                GatrixEditorStyle.DrawHelpBox("No flags loaded yet.", MessageType.Info);
                return;
            }

            bool isDark = EditorGUIUtility.isProSkin;

            // ─── Column layout ────────────────────────────────────────────────
            // State | Name | Variant | Type | Value | Rev
            const float stateX = 4f;
            const float stateW = 38f;
            const float nameX  = 48f;
            const float typeW  = 50f;
            const float revW   = 30f;
            float totalW   = EditorGUIUtility.currentViewWidth;
            float dynamicW = totalW - nameX - typeW - revW - 30f;
            float nameW    = dynamicW * 0.25f;
            float variantX = nameX + nameW;
            float variantW = dynamicW * 0.38f;
            float typeX    = variantX + variantW;
            float valueX   = typeX + typeW;
            float valueW   = dynamicW * 0.37f;
            float revX     = valueX + valueW + 4f;

            // ─── Header ──────────────────────────────────────────────────────
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
            var revHStyle = new GUIStyle(hStyle) { alignment = TextAnchor.MiddleRight };
            GUI.Label(new Rect(headerRect.x + stateX,   headerRect.y, stateW,   headerRect.height), "State",   hStyle);
            GUI.Label(new Rect(headerRect.x + nameX,    headerRect.y, nameW,    headerRect.height), "Name",    hStyle);
            GUI.Label(new Rect(headerRect.x + variantX, headerRect.y, variantW, headerRect.height), "Variant", hStyle);
            GUI.Label(new Rect(headerRect.x + typeX,    headerRect.y, typeW,    headerRect.height), "Type",    hStyle);
            GUI.Label(new Rect(headerRect.x + valueX,   headerRect.y, valueW,   headerRect.height), "Value",   hStyle);
            GUI.Label(new Rect(headerRect.x + revX,     headerRect.y, revW,     headerRect.height), "Rev",     revHStyle);

            // ─── Row styles ───────────────────────────────────────────────────
            var flagOnStyle = new GUIStyle(EditorStyles.miniLabel)
            {
                fontStyle = FontStyle.Bold,
                alignment = TextAnchor.MiddleCenter,
                normal    = { textColor = Color.white }
            };
            var flagOffStyle = new GUIStyle(flagOnStyle);
            var rowValueStyle = new GUIStyle(EditorStyles.label)
            {
                fontSize = 11,
                normal   = { textColor = isDark ? new Color(0.88f, 0.90f, 0.92f) : new Color(0.08f, 0.10f, 0.12f) }
            };
            var rowLabelStyle = new GUIStyle(EditorStyles.label)
            {
                fontSize = 11,
                normal   = { textColor = isDark ? new Color(0.58f, 0.63f, 0.70f) : new Color(0.32f, 0.35f, 0.40f) }
            };
            var revStyle = new GUIStyle(EditorStyles.miniLabel)
            {
                alignment = TextAnchor.MiddleRight,
                normal    = { textColor = isDark ? new Color(0.50f, 0.53f, 0.58f) : new Color(0.40f, 0.42f, 0.45f) }
            };
            var changedLabelStyle = new GUIStyle(EditorStyles.miniLabel)
            {
                fontStyle = FontStyle.Bold,
                normal    = { textColor = new Color(1f, 0.65f, 0.10f, 1f) }
            };

            // ─── Rows ─────────────────────────────────────────────────────────
            int visibleIndex = 0;
            for (int i = 0; i < flags.Count; i++)
            {
                var flag = flags[i];
                if (!string.IsNullOrEmpty(filter) &&
                    !flag.Name.ToLowerInvariant().Contains(filter))
                    continue;

                // Check for pending change (sub-row)
                EvaluatedFlag pendingFlag = null;
                bool hasPending = pendingMap != null &&
                                  pendingMap.TryGetValue(flag.Name, out pendingFlag) &&
                                  (pendingFlag.Enabled != flag.Enabled ||
                                   pendingFlag.Variant?.Name != flag.Variant?.Name ||
                                   !Equals(pendingFlag.Variant?.Value, flag.Variant?.Value));

                var rowRect = EditorGUILayout.GetControlRect(false, 20);
                // Reserve the sub-row rect now (in layout pass) so we can compute the
                // combined bounding box before any Repaint drawing.
                var subRect = hasPending ? EditorGUILayout.GetControlRect(false, 20) : default;

                // Flash highlight or alternating tint (only when no pending change)
                float changeTime = 0f;
                bool isChanged = changedTimes != null && changedTimes.TryGetValue(flag.Name, out changeTime);
                float elapsed  = isChanged ? (float)EditorApplication.timeSinceStartup - changeTime : highlightDuration;
                bool showFlash = isChanged && elapsed < highlightDuration;

                if (Event.current.type == EventType.Repaint)
                {
                    if (hasPending)
                    {
                        // Combined bounding box that groups the main row + sub-row
                        var combined = new Rect(rowRect.x, rowRect.y, rowRect.width, subRect.yMax - rowRect.y);
                        var amberBg     = isDark ? new Color(0.75f, 0.45f, 0.05f, 0.18f) : new Color(0.90f, 0.60f, 0.10f, 0.13f);
                        var amberAccent = new Color(1f, 0.65f, 0.10f, 0.9f);

                        // Background fill for entire group
                        EditorGUI.DrawRect(combined, amberBg);

                        // Left accent bar
                        EditorGUI.DrawRect(new Rect(combined.x, combined.y, 3f, combined.height), amberAccent);

                        // Border box: top / bottom / right of the group
                        float bx = combined.x + 3f;
                        float bw = combined.width - 4f;
                        EditorGUI.DrawRect(new Rect(bx, combined.y,        bw, 1f), amberAccent * 0.7f);
                        EditorGUI.DrawRect(new Rect(bx, combined.yMax - 1, bw, 1f), amberAccent * 0.7f);
                        EditorGUI.DrawRect(new Rect(combined.xMax - 1, combined.y, 1f, combined.height), amberAccent * 0.7f);

                        // Subtle separator between main and sub row
                        EditorGUI.DrawRect(new Rect(bx, rowRect.yMax - 1, bw, 1f),
                            new Color(amberAccent.r, amberAccent.g, amberAccent.b, 0.25f));
                    }
                    else if (showFlash)
                    {
                        float alpha = Mathf.Lerp(0.35f, 0f, elapsed / highlightDuration);
                        EditorGUI.DrawRect(rowRect, new Color(1f, 0.85f, 0f, alpha));
                    }
                    else if (visibleIndex % 2 == 0)
                    {
                        EditorGUI.DrawRect(rowRect,
                            isDark ? new Color(0.16f, 0.16f, 0.18f, 0.5f) : new Color(0.84f, 0.84f, 0.86f, 0.5f));
                    }
                }

                DrawRow(flag, rowRect, stateX, stateW, nameX, nameW, variantX, variantW,
                    typeX, typeW, valueX, valueW, revX, revW,
                    flagOnStyle, flagOffStyle, rowValueStyle, rowLabelStyle, revStyle);

                visibleIndex++;

                // ── Pending change sub-row ──────────────────────────────────
                if (hasPending)
                {

                    // Pending ON/OFF badge
                    bool pOn = pendingFlag.Enabled;
                    var pBadge = pOn ? new Color(0.10f, 0.45f, 0.18f, 1f) : new Color(0.45f, 0.10f, 0.10f, 1f);
                    var pBadgeRect = new Rect(subRect.x + stateX, subRect.y + 3, stateW, 14);
                    if (Event.current.type == EventType.Repaint)
                        EditorGUI.DrawRect(pBadgeRect, pBadge);
                    GUI.Label(pBadgeRect, pOn ? "ON" : "OFF", pOn ? flagOnStyle : flagOffStyle);

                    // "→ Changed" in Name column
                    GUI.Label(new Rect(subRect.x + nameX, subRect.y, nameW, subRect.height),
                        "\u2192 Changed", changedLabelStyle);

                    // Remaining columns from pending flag
                    GUI.Label(new Rect(subRect.x + variantX, subRect.y, variantW, subRect.height),
                        new GUIContent(pendingFlag.Variant?.Name ?? "", pendingFlag.Variant?.Name ?? ""), rowLabelStyle);
                    GUI.Label(new Rect(subRect.x + typeX, subRect.y, typeW, subRect.height),
                        ValueTypeHelper.ToApiString(pendingFlag.ValueType), rowLabelStyle);
                    string pVal = FormatPayload(pendingFlag.Variant?.Value);
                    GUI.Label(new Rect(subRect.x + valueX, subRect.y, valueW, subRect.height),
                        new GUIContent(pVal, pendingFlag.Variant?.Value?.ToString() ?? ""), rowValueStyle);
                    GUI.Label(new Rect(subRect.x + revX, subRect.y, revW, subRect.height),
                        pendingFlag.Version.ToString(), revStyle);
                }
            }

            if (visibleIndex == 0)
                GatrixEditorStyle.DrawHelpBox("No flags found matching filter.", MessageType.Info);
        }

        // ─── Helpers ─────────────────────────────────────────────────────────

        private static void DrawRow(EvaluatedFlag flag, Rect rowRect,
            float stateX, float stateW, float nameX, float nameW,
            float variantX, float variantW, float typeX, float typeW,
            float valueX, float valueW, float revX, float revW,
            GUIStyle flagOnStyle, GUIStyle flagOffStyle,
            GUIStyle rowValueStyle, GUIStyle rowLabelStyle, GUIStyle revStyle)
        {
            bool on = flag.Enabled;
            var badgeColor = on ? new Color(0.10f, 0.45f, 0.18f, 1f) : new Color(0.45f, 0.10f, 0.10f, 1f);
            var badgeRect  = new Rect(rowRect.x + stateX, rowRect.y + 3, stateW, 14);
            if (Event.current.type == EventType.Repaint)
                EditorGUI.DrawRect(badgeRect, badgeColor);
            GUI.Label(badgeRect, on ? "ON" : "OFF", on ? flagOnStyle : flagOffStyle);

            GUI.Label(new Rect(rowRect.x + nameX,    rowRect.y, nameW,    rowRect.height), new GUIContent(flag.Name, flag.Name), rowValueStyle);
            GUI.Label(new Rect(rowRect.x + variantX, rowRect.y, variantW, rowRect.height), new GUIContent(flag.Variant?.Name ?? "", flag.Variant?.Name ?? ""), rowLabelStyle);
            GUI.Label(new Rect(rowRect.x + typeX,    rowRect.y, typeW,    rowRect.height), ValueTypeHelper.ToApiString(flag.ValueType), rowLabelStyle);

            string valStr = FormatPayload(flag.Variant?.Value);
            GUI.Label(new Rect(rowRect.x + valueX, rowRect.y, valueW, rowRect.height),
                new GUIContent(valStr, flag.Variant?.Value?.ToString() ?? ""), rowValueStyle);

            GUI.Label(new Rect(rowRect.x + revX, rowRect.y, revW, rowRect.height),
                flag.Version.ToString(), revStyle);
        }

        internal static string FormatPayload(object payload)
        {
            if (payload == null) return "-";
            if (payload is bool b) return b ? "true" : "false";
            var s = payload.ToString();
            if (s == "") return "\"\"";
            if (s.Length > 50) s = s.Substring(0, 47) + "...";
            return s;
        }
    }
}
#endif
