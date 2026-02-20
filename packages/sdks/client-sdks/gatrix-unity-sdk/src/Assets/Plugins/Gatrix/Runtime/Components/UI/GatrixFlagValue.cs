// GatrixFlagValue - Bind feature flag values to UI components
// Automatically updates Text/TMP components when flag values change

using System;
using UnityEngine;
using UnityEngine.UI;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Binds a feature flag's value to a Unity UI Text component.
    /// Supports string, number, and boolean flag values with formatting.
    /// </summary>
    [AddComponentMenu("Gatrix/Flag Value")]
    public class GatrixFlagValue : GatrixFlagComponentBase
    {
        [Header("Display Settings")]
        [Tooltip("Format string for the value. Use {0} as placeholder. Leave empty for raw value.")]
        [SerializeField] private string _format = "";

        [Tooltip("Text to show when flag is not found or disabled")]
        [SerializeField] private string _fallbackText = "-";

        [Tooltip("Hide the target GameObject when flag is disabled")]
        [SerializeField] private bool _hideWhenDisabled;

        [Header("Target (auto-detected if empty)")]
        [Tooltip("Target Text component. If empty, uses Text component on this GameObject.")]
        [SerializeField] private Text _targetText;

        private Component _tmpComponent;
        private System.Reflection.PropertyInfo _tmpTextProperty;
        private bool _tmpChecked;

        protected override void OnEnable()
        {
            DetectTarget();
            base.OnEnable();
        }

        private static Type _cachedTmpType;
        private static System.Reflection.PropertyInfo _cachedTmpTextProp;
        private static bool _typeResolveAttempted;

        private void DetectTarget()
        {
            if (!_tmpChecked)
            {
                _tmpChecked = true;

                // Prefer TMP over Legacy Text
                if (!_typeResolveAttempted)
                {
                    _typeResolveAttempted = true;
                    _cachedTmpType = Type.GetType("TMPro.TMP_Text, Unity.TextMeshPro");
                    if (_cachedTmpType != null)
                    {
                        _cachedTmpTextProp = _cachedTmpType.GetProperty("text");
                    }
                }

                if (_cachedTmpType != null)
                {
                    var cmp = GetComponent(_cachedTmpType);
                    if (cmp != null)
                    {
                        _tmpComponent = cmp;
                        _tmpTextProperty = _cachedTmpTextProp;
                        return; // TMP found — skip legacy Text detection
                    }
                }
            }

            // Fallback: use Legacy Text if TMP is not present
            if (_targetText == null)
            {
                _targetText = GetComponent<Text>();
            }
        }

        protected override void OnFlagChanged(FlagProxy flag)
        {
            if (flag == null) return;

            // Hide the target text component when flag is disabled
            // (We cannot use gameObject.SetActive(false) because OnDisable would unsubscribe us)
            if (_hideWhenDisabled)
            {
                SetTargetEnabled(flag.Enabled);
                if (!flag.Enabled) return;
            }

            // Resolve display text
            string displayText;
            var value = flag.Variant?.Value;
            if (value == null)
            {
                displayText = _fallbackText;
            }
            else
            {
                var valueStr = value.ToString();
                displayText = string.IsNullOrEmpty(_format)
                    ? valueStr
                    : string.Format(_format, valueStr);
            }

            SetText(displayText);
        }

        private void SetText(string text)
        {
            if (_targetText != null)
            {
                _targetText.text = text;
                return;
            }

            if (_tmpComponent != null && _tmpTextProperty != null)
            {
                _tmpTextProperty.SetValue(_tmpComponent, text);
            }
        }

        /// <summary>
        /// Enable or disable the target text component without affecting the GameObject.
        /// This preserves the subscription lifecycle.
        /// </summary>
        private void SetTargetEnabled(bool enabled)
        {
            if (_targetText != null)
            {
                _targetText.enabled = enabled;
                return;
            }

            if (_tmpComponent is Behaviour behaviour)
            {
                behaviour.enabled = enabled;
            }
        }

#if UNITY_EDITOR
        protected override void OnValidate()
        {
            base.OnValidate(); // handles Play Mode Resubscribe

            // Edit Mode: apply a preview from the local flag cache so the
            // designer can see the flag value without entering Play Mode.
            if (!Application.isPlaying)
            {
                ApplyEditorPreview();
            }
        }

        /// <summary>
        /// Reads the locally cached flags and applies the flag value to the
        /// target text component for an in-editor preview.
        /// </summary>
        private void ApplyEditorPreview()
        {
            if (string.IsNullOrEmpty(_flagName)) return;

            // Determine the cache key prefix from GatrixBehaviour in the scene (if any)
            var behaviour = FindFirstObjectByType<GatrixBehaviour>();
            var prefix = behaviour?.Settings?.CacheKeyPrefix ?? "gatrix_cache";

            var json = FeaturesClient.EditorGetCachedFlagsJson(prefix);
            if (string.IsNullOrEmpty(json)) return;

            var flags = GatrixJson.DeserializeFlags(json);
            if (flags == null) return;

            EvaluatedFlag found = null;
            foreach (var f in flags)
            {
                if (f.Name == _flagName) { found = f; break; }
            }

            if (found == null) return;

            // Re-detect target each time so component swaps are picked up in Edit Mode
            _tmpChecked = false;
            DetectTarget();

            // Replicate the same display logic as OnFlagChanged
            string displayText;
            var value = found.Variant?.Value;
            if (value == null)
            {
                displayText = _fallbackText;
            }
            else
            {
                var valueStr = value.ToString();
                displayText = string.IsNullOrEmpty(_format)
                    ? valueStr
                    : string.Format(_format, valueStr);
            }

            SetText(displayText);

            // Notify the editor that this object was changed
            UnityEditor.EditorUtility.SetDirty(this);
        }
#endif
    }
}
