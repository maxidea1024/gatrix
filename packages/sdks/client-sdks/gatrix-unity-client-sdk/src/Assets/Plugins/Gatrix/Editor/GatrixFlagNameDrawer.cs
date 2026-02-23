// GatrixFlagNameDrawer - Custom PropertyDrawer for flag name autocomplete
// Shows a searchable dropdown with cached flag names

#if UNITY_EDITOR
using System.Collections.Generic;
using UnityEditor;
using UnityEngine;

namespace Gatrix.Unity.SDK.Editor
{
    /// <summary>
    /// PropertyDrawer for [GatrixFlagName] attribute.
    /// Renders a text field with a dropdown button that shows
    /// all known flag names with search filtering.
    /// </summary>
    [CustomPropertyDrawer(typeof(GatrixFlagNameAttribute))]
    public class GatrixFlagNameDrawer : PropertyDrawer
    {
        public override void OnGUI(Rect position, SerializedProperty property, GUIContent label)
        {
            if (property.propertyType != SerializedPropertyType.String)
            {
                EditorGUI.PropertyField(position, property, label);
                return;
            }

            EditorGUI.BeginProperty(position, label, property);

            // Layout: [Label] [TextField ........] [▼ button]
            var labelRect = new Rect(position.x, position.y, EditorGUIUtility.labelWidth, position.height);
            var buttonWidth = 24f;
            var fieldRect = new Rect(
                position.x + EditorGUIUtility.labelWidth + 2,
                position.y,
                position.width - EditorGUIUtility.labelWidth - buttonWidth - 4,
                position.height);
            var buttonRect = new Rect(
                position.x + position.width - buttonWidth,
                position.y,
                buttonWidth,
                position.height);

            // Draw label
            EditorGUI.LabelField(labelRect, label);

            // Draw text field (still allows manual input)
            property.stringValue = EditorGUI.TextField(fieldRect, property.stringValue);

            // Draw dropdown button
            if (GUI.Button(buttonRect, "\u25BC", EditorStyles.miniButton))
            {
                ShowFlagNamePopup(property);
            }

            // Colorize if the name doesn't match any known flag
            if (!string.IsNullOrEmpty(property.stringValue) && GatrixFlagNameCache.Count > 0)
            {
                bool found = false;
                foreach (var n in GatrixFlagNameCache.FlagNames)
                {
                    if (n == property.stringValue) { found = true; break; }
                }
                if (!found)
                {
                    // Draw a subtle warning indicator
                    var warningRect = new Rect(fieldRect.x + fieldRect.width - 18, fieldRect.y + 2, 16, 16);
                    var prevColor = GUI.color;
                    GUI.color = new Color(1f, 0.7f, 0.2f, 0.8f);
                    GUI.Label(warningRect, new GUIContent("⚠", "Flag name not found in cache. It may be valid but not yet fetched."));
                    GUI.color = prevColor;
                }
            }

            EditorGUI.EndProperty();
        }

        private void ShowFlagNamePopup(SerializedProperty property)
        {
            var menu = new GenericMenu();
            var flagNames = GatrixFlagNameCache.Search("");

            if (flagNames.Count == 0)
            {
                menu.AddDisabledItem(new GUIContent("No flags cached. Run the game to populate."));
            }
            else
            {
                // Group by prefix if flags use dot notation (e.g., "feature.dark_mode")
                foreach (var name in flagNames)
                {
                    // Use '/' as menu separator for dot-delimited names
                    var menuPath = name.Replace('.', '/');
                    var captured = name;
                    menu.AddItem(
                        new GUIContent(menuPath),
                        property.stringValue == name,
                        () =>
                        {
                            property.serializedObject.Update();
                            property.stringValue = captured;
                            property.serializedObject.ApplyModifiedProperties();
                        });
                }

                menu.AddSeparator("");
            }

            // Refresh option
            menu.AddItem(new GUIContent("Refresh Cache"), false, () =>
            {
                GatrixFlagNameCache.ForceSync();
            });

            menu.ShowAsContext();
        }
    }
}
#endif
