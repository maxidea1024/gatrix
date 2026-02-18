// SdkEventEntryDrawer - Custom property drawer for SDK event entries
// Shows a toggleable checkbox with event name label and foldable UnityEvent

#if UNITY_EDITOR
using UnityEditor;
using UnityEngine;

namespace Gatrix.Unity.SDK.Editor
{
    /// <summary>
    /// Custom property drawer for GatrixBehaviour.SdkEventEntry.
    /// Displays: [✓] Event Name
    ///              └─ UnityEvent callbacks (foldable)
    /// </summary>
    [CustomPropertyDrawer(typeof(GatrixBehaviour.SdkEventEntry))]
    public class SdkEventEntryDrawer : PropertyDrawer
    {
        public override float GetPropertyHeight(SerializedProperty property, GUIContent label)
        {
            var enabledProp = property.FindPropertyRelative("enabled");
            var callbackProp = property.FindPropertyRelative("callback");

            // Base height: toggle + label line
            float height = EditorGUIUtility.singleLineHeight + 2f;

            // If enabled, add callback height
            if (enabledProp.boolValue)
            {
                height += EditorGUI.GetPropertyHeight(callbackProp) + 4f;
            }

            return height;
        }

        public override void OnGUI(Rect position, SerializedProperty property, GUIContent label)
        {
            var enabledProp = property.FindPropertyRelative("enabled");
            var eventNameProp = property.FindPropertyRelative("eventName");
            var callbackProp = property.FindPropertyRelative("callback");

            EditorGUI.BeginProperty(position, label, property);

            // First line: toggle + event name
            var toggleRect = new Rect(position.x, position.y, 18f, EditorGUIUtility.singleLineHeight);
            var labelRect = new Rect(position.x + 20f, position.y,
                position.width - 20f, EditorGUIUtility.singleLineHeight);

            // Draw toggle
            enabledProp.boolValue = EditorGUI.Toggle(toggleRect, enabledProp.boolValue);

            // Format event name for display
            var eventName = eventNameProp.stringValue;
            var displayName = FormatEventName(eventName);

            // Draw label with styling based on enabled state
            var style = new GUIStyle(EditorStyles.label);
            if (!enabledProp.boolValue)
            {
                style.normal.textColor = new Color(0.5f, 0.5f, 0.5f);
            }
            else
            {
                style.fontStyle = FontStyle.Bold;
            }

            EditorGUI.LabelField(labelRect, displayName, style);

            // If enabled, draw the UnityEvent below
            if (enabledProp.boolValue)
            {
                var callbackRect = new Rect(
                    position.x,
                    position.y + EditorGUIUtility.singleLineHeight + 4f,
                    position.width,
                    EditorGUI.GetPropertyHeight(callbackProp));

                EditorGUI.PropertyField(callbackRect, callbackProp, GUIContent.none);
            }

            EditorGUI.EndProperty();
        }

        private static string FormatEventName(string eventName)
        {
            if (string.IsNullOrEmpty(eventName)) return "Unknown Event";

            // "flags.ready" -> "Ready"
            // "flags.fetch_start" -> "Fetch Start"
            // "flags.streaming_connected" -> "Streaming Connected"
            var parts = eventName.Split('.');
            var name = parts.Length > 1 ? parts[parts.Length - 1] : eventName;

            // Convert snake_case to Title Case
            var words = name.Split('_');
            for (int i = 0; i < words.Length; i++)
            {
                if (words[i].Length > 0)
                {
                    words[i] = char.ToUpper(words[i][0]) + words[i].Substring(1);
                }
            }

            return string.Join(" ", words);
        }
    }
}
#endif
