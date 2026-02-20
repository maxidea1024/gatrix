// GatrixComponentEditor - Unified inspector for all Gatrix flag-binding components
// Provides consistent UI, branding, flag autocomplete, Sync Mode support,
// and a live Flag Status section showing realtime/synced flag info (Play Mode).

#if UNITY_EDITOR
using UnityEditor;
using UnityEngine;
using Gatrix.Unity.SDK;

namespace Gatrix.Unity.SDK.Editor
{
    /// <summary>
    /// Base editor for Gatrix components to ensure consistent UI.
    /// Supports FlagName autocomplete, SyncMode selection,
    /// and a live flag status display in the inspector.
    /// </summary>
    [CustomEditor(typeof(MonoBehaviour), true)]
    [CanEditMultipleObjects]
    public class GatrixComponentEditor : UnityEditor.Editor
    {
        private bool _isFlagComponent;
        private bool _isOtherGatrixComponent;
        private SerializedProperty _flagNameProp;
        private SerializedProperty _useProp;

        private void OnEnable()
        {
            var type = target.GetType();

            // Check if it inherits from our new base class
            _isFlagComponent = typeof(GatrixFlagComponentBase).IsAssignableFrom(type);

            // Check if it's another Gatrix component that might need branding but doesn't use the base
            _isOtherGatrixComponent = !_isFlagComponent &&
                                     type.Namespace == "Gatrix.Unity.SDK" &&
                                     (type.Name.StartsWith("Gatrix") || type.Name.Contains("Gatrix"));

            if (_isFlagComponent)
            {
                _flagNameProp = serializedObject.FindProperty("_flagName");
                _useProp = serializedObject.FindProperty("_use");
            }
        }

        public override void OnInspectorGUI()
        {
            if (!_isFlagComponent && !_isOtherGatrixComponent)
            {
                base.OnInspectorGUI();
                return;
            }

            serializedObject.Update();

            string title = target.GetType().Name.Replace("GatrixFlag", "").Replace("Gatrix", "");
            if (string.IsNullOrEmpty(title)) title = "COMPONENT";

            // 1. Branding Header
            GatrixEditorStyle.DrawWindowHeader("GATRIX", title.ToUpper(), "\u25c6");

            if (_isFlagComponent)
            {
                // 2. Flag Configuration Section
                GatrixEditorStyle.DrawSectionHeader("Flag Configuration", GatrixEditorStyle.AccentBlue);

                if (_flagNameProp != null)
                {
                    EditorGUILayout.PropertyField(_flagNameProp, new GUIContent("Flag Name"));
                }

                if (_useProp != null)
                {
                    // Draw Sync Mode as an Enum-like dropdown instead of a simple toggle
                    int currentIndex = _useProp.boolValue ? 0 : 1;
                    string[] options = { "Realtime (Immediate)", "Synced (Manual · Controlled)" };

                    int newIndex = EditorGUILayout.Popup("Sync Mode", currentIndex, options);
                    if (newIndex != currentIndex)
                    {
                        _useProp.boolValue = (newIndex == 0);
                    }

                    EditorGUILayout.HelpBox(_useProp.boolValue
                        ? "Immediate updates whenever the flag changes on the server."
                        : "Update only when the client explicitly synchronizes flag states.",
                        MessageType.None);

                    // Warn if Synced mode but SDK Explicit Sync is off
                    // Works in both Edit and Play mode
                    if (!_useProp.boolValue)
                    {
                        bool explicitSyncOff = false;
                        GatrixSettings settingsToPin = null;
                        if (Application.isPlaying && GatrixBehaviour.IsInitialized)
                        {
                            var client = GatrixBehaviour.Client;
                            explicitSyncOff = client != null && !client.Features.IsExplicitSync();
                            // Try to get settings for ping
                            var beh = FindFirstObjectByType<GatrixBehaviour>();
                            settingsToPin = beh != null ? beh.Settings : null;
                        }
                        else
                        {
                            // Edit mode: find the GatrixBehaviour in the scene and read its settings
                            var behaviour = FindFirstObjectByType<GatrixBehaviour>();
                            if (behaviour != null && behaviour.Settings != null)
                            {
                                explicitSyncOff = !behaviour.Settings.ExplicitSyncMode;
                                settingsToPin = behaviour.Settings;
                            }
                        }

                        if (explicitSyncOff)
                        {
                            bool isDark = EditorGUIUtility.isProSkin;
                            var warnColor = isDark
                                ? new Color(0.55f, 0.45f, 0.15f, 0.25f)
                                : new Color(1f, 0.85f, 0.3f, 0.3f);
                            var warnRect = EditorGUILayout.GetControlRect(false, 32);
                            if (Event.current.type == EventType.Repaint)
                                EditorGUI.DrawRect(warnRect, warnColor);
                            var warnStyle = new GUIStyle(EditorStyles.miniLabel)
                            {
                                wordWrap = true,
                                fontSize = 10,
                                normal = { textColor = isDark
                                    ? new Color(1f, 0.85f, 0.4f)
                                    : new Color(0.55f, 0.35f, 0f) }
                            };
                            EditorGUIUtility.AddCursorRect(warnRect, MouseCursor.Link);
                            GUI.Label(new Rect(warnRect.x + 4, warnRect.y + 1, warnRect.width - 8, warnRect.height - 2),
                                "\u26a0 Explicit Sync Mode is OFF in SDK settings. Click to open settings.",
                                warnStyle);

                            // Click to ping the settings asset
                            if (Event.current.type == EventType.MouseDown && warnRect.Contains(Event.current.mousePosition))
                            {
                                if (settingsToPin != null)
                                {
                                    EditorGUIUtility.PingObject(settingsToPin);
                                    Selection.activeObject = settingsToPin;
                                }
                                Event.current.Use();
                            }
                        }
                    }
                }

                EditorGUILayout.Space(8);

                // 3. Other Settings
                GatrixEditorStyle.DrawSectionHeader("Settings", GatrixEditorStyle.AccentGreen);
                DrawPropertiesExcluding(serializedObject, "m_Script", "_flagName", "_use");

                // 4. Live Flag Status (Play Mode only)
                DrawLiveFlagStatus();
            }
            else
            {
                // Just draw everything for non-flag components, but with branding
                DrawPropertiesExcluding(serializedObject, "m_Script");
            }

            serializedObject.ApplyModifiedProperties();

            EditorGUILayout.Space(12);
        }

        // ==================== Live Flag Status ====================

        /// <summary>
        /// Draws the live flag status section at the bottom of the inspector.
        /// Shows flag info in a monitor-style table (Play Mode only).
        /// </summary>
        private void DrawLiveFlagStatus()
        {
            EditorGUILayout.Space(8);
            GatrixEditorStyle.DrawSectionHeader("Flag Status", GatrixEditorStyle.AccentTeal);

            string flagName = _flagNameProp?.stringValue;
            if (string.IsNullOrEmpty(flagName))
            {
                GatrixEditorStyle.DrawHelpBox("Flag name is not configured.", MessageType.Info);
                return;
            }

            // GatrixBehaviour.Client returns the offline editor client in Edit Mode
            // and the live runtime client in Play Mode — no special-casing needed here.
            var client = GatrixBehaviour.Client;
            if (client == null)
            {
                GatrixEditorStyle.DrawHelpBox(
                    "No cached data. Assign GatrixSettings to a GatrixBehaviour and run the game once.",
                    MessageType.Info);
                return;
            }

            var features = client.Features;

            if (Application.isPlaying && GatrixBehaviour.IsInitialized)
            {
                // Play Mode: show realtime / synced distinction
                bool isRealtime = _useProp != null && _useProp.boolValue;
                bool isExplicitSync = features.IsExplicitSync();

                if (isRealtime)
                    DrawFlagStatusForMode(features, flagName, true, "Realtime");
                else
                    DrawSyncedFlagStatus(features, flagName, isExplicitSync);

                Repaint();
            }
            else
            {
                // Edit Mode: GatrixEditorClient loaded cached flags — just display them
                DrawFlagStatusForMode(features, flagName, false, "Cached");
            }
        }

        /// <summary>
        /// Draws flag status for Synced mode.
        /// Shows both synced and pending realtime values when they differ.
        /// </summary>
        private void DrawSyncedFlagStatus(IFeaturesClient client, string flagName, bool isExplicitSync)
        {
            if (!isExplicitSync)
            {
                // Not in explicit sync mode: synced behaves like realtime
                DrawFlagStatusForMode(client, flagName, false, "Synced");
                return;
            }

            // Explicit sync mode: show synced value
            DrawFlagStatusForMode(client, flagName, false, "Current (Synced)");

            // Check for pending realtime value
            bool hasPending = client.HasPendingSyncFlags();
            if (hasPending)
            {
                // Use GetFlagRaw() which does NOT trigger metrics tracking
                var syncedFlag   = client.GetFlagRaw(flagName, forceRealtime: false);
                var realtimeFlag = client.GetFlagRaw(flagName, forceRealtime: true);

                // Compare to determine if values differ
                bool differs = (syncedFlag?.Enabled ?? false) != (realtimeFlag?.Enabled ?? false)
                    || (syncedFlag?.Variant?.Name ?? "") != (realtimeFlag?.Variant?.Name ?? "")
                    || FormatValue(syncedFlag?.Variant?.Value) != FormatValue(realtimeFlag?.Variant?.Value);

                if (differs)
                {
                    EditorGUILayout.Space(4);
                    DrawFlagStatusForMode(client, flagName, true, "Pending (Realtime)");

                    // Visual indicator for pending sync
                    GatrixEditorStyle.DrawHelpBox(
                        "Pending changes detected. These values will be applied after SyncFlags().",
                        MessageType.Warning);
                }
                else
                {
                    // Values are the same, no need to show pending
                    DrawSyncedStatusIndicator(true);
                }
            }
            else
            {
                DrawSyncedStatusIndicator(true);
            }
        }

        /// <summary>
        /// Draws a small "Synchronized" or "Pending" indicator.
        /// </summary>
        private static void DrawSyncedStatusIndicator(bool isSynced)
        {
            EditorGUILayout.Space(2);
            var rect = EditorGUILayout.GetControlRect(false, 16);
            bool isDark = EditorGUIUtility.isProSkin;

            var style = new GUIStyle(EditorStyles.miniLabel)
            {
                alignment = TextAnchor.MiddleLeft,
                richText = true,
                normal = { textColor = isSynced
                    ? (isDark ? new Color(0.45f, 0.85f, 0.50f) : new Color(0.10f, 0.50f, 0.15f))
                    : (isDark ? new Color(0.95f, 0.75f, 0.30f) : new Color(0.60f, 0.45f, 0.05f)) }
            };
            string text = isSynced ? "\u2713 Synchronized" : "\u25cf Pending sync";
            GUI.Label(new Rect(rect.x + 4, rect.y, rect.width - 8, rect.height), text, style);
        }

        private static void DrawFlagStatusForMode(IFeaturesClient client, string flagName, bool forceRealtime, string label)
        {
            // Use GetFlagRaw() which does NOT trigger metrics tracking (unlike GetFlag/IsEnabled/GetVariant)
            EvaluatedFlag evaluatedFlag = client.GetFlagRaw(flagName, forceRealtime);

            if (evaluatedFlag == null)
            {
                GatrixEditorStyle.DrawHelpBox(
                    $"[{label}] Flag \"{flagName}\" not found in cache.", MessageType.Warning);
                return;
            }

            DrawFlagStatusForEvaluatedFlag(evaluatedFlag, label);
        }

        /// <summary>
        /// Renders the flag status mini table for a given EvaluatedFlag.
        /// Shared by both the live (Play Mode) and cached (Edit Mode) paths.
        /// </summary>
        private static void DrawFlagStatusForEvaluatedFlag(EvaluatedFlag evaluatedFlag, string label)
        {
            bool isDark = EditorGUIUtility.isProSkin;

            // Label row
            var labelRect = EditorGUILayout.GetControlRect(false, 16);
            var labelStyle = new GUIStyle(EditorStyles.miniLabel)
            {
                fontStyle = FontStyle.Bold,
                normal = { textColor = isDark
                    ? new Color(0.60f, 0.75f, 0.90f)
                    : new Color(0.15f, 0.30f, 0.55f) }
            };
            GUI.Label(new Rect(labelRect.x + 4, labelRect.y, labelRect.width - 8, labelRect.height),
                label, labelStyle);

            // Flag info rows inside a box
            GatrixEditorStyle.BeginBox();

            DrawFlagInfoRow("State",   null, isDark, evaluatedFlag);
            DrawFlagInfoRow("Variant", evaluatedFlag.Variant?.Name ?? "-", isDark);
            DrawFlagInfoRow("Type",    ValueTypeHelper.ToApiString(evaluatedFlag.ValueType), isDark);
            DrawFlagInfoRow("Value",   FormatValue(evaluatedFlag.Variant?.Value), isDark);
            DrawFlagInfoRow("Revision", evaluatedFlag.Version.ToString(), isDark);

            GatrixEditorStyle.EndBox();
        }

        /// <summary>
        /// Draws a single labeled row in the flag info section.
        /// When evaluatedFlag is provided and value is null, draws the ON/OFF badge.
        /// </summary>
        private static void DrawFlagInfoRow(string label, string value, bool isDark, EvaluatedFlag flagForBadge = null)
        {
            var rect = EditorGUILayout.GetControlRect(false, 18);

            // Label
            float labelWidth = 70f;
            var labelStyle = new GUIStyle(EditorStyles.miniLabel)
            {
                fontStyle = FontStyle.Bold,
                normal = { textColor = isDark
                    ? new Color(0.55f, 0.60f, 0.65f)
                    : new Color(0.35f, 0.38f, 0.42f) }
            };
            GUI.Label(new Rect(rect.x + 4, rect.y, labelWidth, rect.height), label, labelStyle);

            if (flagForBadge != null && value == null)
            {
                // Draw ON/OFF badge (same style as Monitor)
                bool on = flagForBadge.Enabled;
                var badgeColor = on
                    ? new Color(0.10f, 0.45f, 0.18f, 1f)
                    : new Color(0.45f, 0.10f, 0.10f, 1f);
                var badgeRect = new Rect(rect.x + labelWidth + 4, rect.y + 2, 38, 14);

                if (Event.current.type == EventType.Repaint)
                    EditorGUI.DrawRect(badgeRect, badgeColor);

                var badgeStyle = new GUIStyle(EditorStyles.miniLabel)
                {
                    fontStyle = FontStyle.Bold,
                    alignment = TextAnchor.MiddleCenter,
                    normal = { textColor = Color.white }
                };
                GUI.Label(badgeRect, on ? "ON" : "OFF", badgeStyle);
            }
            else
            {
                // Draw value text
                var valueStyle = new GUIStyle(EditorStyles.label)
                {
                    fontSize = 11,
                    normal = { textColor = isDark
                        ? new Color(0.88f, 0.90f, 0.92f)
                        : new Color(0.08f, 0.10f, 0.12f) }
                };
                GUI.Label(new Rect(rect.x + labelWidth + 4, rect.y, rect.width - labelWidth - 8, rect.height),
                    value ?? "-", valueStyle);
            }
        }

        /// <summary>
        /// Formats a variant value for display, matching the Monitor's FormatPayload logic.
        /// </summary>
        private static string FormatValue(object payload)
        {
            if (payload == null) return "-";
            if (payload is bool boolVal) return boolVal ? "true" : "false";
            var str = payload.ToString();
            if (str == "") return "\"\"";
            if (str.Length > 50) str = str.Substring(0, 47) + "...";
            return str;
        }
    }
}
#endif
