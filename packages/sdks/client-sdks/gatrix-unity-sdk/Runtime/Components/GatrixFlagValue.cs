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
    ///
    /// Usage:
    ///   1. Add this component to a UI Text/TMP GameObject
    ///   2. Set the Flag Name
    ///   3. Optionally set a format string (e.g., "Speed: {0}x")
    ///   4. Text updates automatically when the flag value changes
    /// </summary>
    [AddComponentMenu("Gatrix/Flag Value")]
    public class GatrixFlagValue : MonoBehaviour
    {
        [Header("Flag Configuration")]
        [Tooltip("The feature flag name to watch")]
        [GatrixFlagName]
        [SerializeField] private string _flagName;

        [Header("Display Settings")]
        [Tooltip("Format string for the value. Use {0} as placeholder. Leave empty for raw value.")]
        [SerializeField] private string _format = "";

        [Tooltip("Text to show when flag is not found or disabled")]
        [SerializeField] private string _fallbackText = "-";

        [Tooltip("Only show value when flag is enabled")]
        [SerializeField] private bool _hideWhenDisabled;

        [Header("Target (auto-detected if empty)")]
        [Tooltip("Target Text component. If empty, uses Text component on this GameObject.")]
        [SerializeField] private Text _targetText;

        private Action _unwatch;
        private Component _tmpComponent;
        private System.Reflection.PropertyInfo _tmpTextProperty;
        private bool _tmpChecked;

        public string FlagName
        {
            get => _flagName;
            set
            {
                if (_flagName == value) return;
                _flagName = value;
                Resubscribe();
            }
        }

        private void OnEnable()
        {
            DetectTarget();
            Subscribe();
        }

        private void OnDisable()
        {
            Unsubscribe();
        }

        private void DetectTarget()
        {
            // Try Unity UI Text first
            if (_targetText == null)
            {
                _targetText = GetComponent<Text>();
            }

            // Try TextMeshPro via reflection (avoid hard dependency)
            if (!_tmpChecked)
            {
                _tmpChecked = true;
                if (_targetText == null)
                {
                    var tmpType = Type.GetType("TMPro.TMP_Text, Unity.TextMeshPro");
                    if (tmpType != null)
                    {
                        _tmpComponent = GetComponent(tmpType);
                        if (_tmpComponent != null)
                        {
                            _tmpTextProperty = tmpType.GetProperty("text");
                        }
                    }
                }
            }
        }

        private void Subscribe()
        {
            if (string.IsNullOrEmpty(_flagName)) return;

            var client = GatrixBehaviour.Client;
            if (client == null) return;

            _unwatch = client.Features.WatchFlagWithInitialState(_flagName, OnFlagChanged,
                $"FlagValue:{gameObject.name}");
        }

        private void Unsubscribe()
        {
            _unwatch?.Invoke();
            _unwatch = null;
        }

        private void Resubscribe()
        {
            Unsubscribe();
            if (isActiveAndEnabled) Subscribe();
        }

        private void OnFlagChanged(FlagProxy flag)
        {
            string displayText;

            if (!flag.Enabled && _hideWhenDisabled)
            {
                displayText = _fallbackText;
            }
            else
            {
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

            // TextMeshPro fallback
            if (_tmpComponent != null && _tmpTextProperty != null)
            {
                _tmpTextProperty.SetValue(_tmpComponent, text);
            }
        }
    }
}
