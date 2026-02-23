// GatrixFlagInputField - Control UI InputField via feature flags
// Useful for A/B testing placeholder text, character limits, or gating input

using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Controls a UI InputField's interactable state, placeholder text, and
    /// character limit based on a feature flag.
    /// Variant names map to specific placeholder strings or char limits.
    /// </summary>
    [AddComponentMenu("Gatrix/UI/Flag Input Field")]
    public class GatrixFlagInputField : GatrixFlagComponentBase
    {
        public enum InputFieldControlMode
        {
            ToggleInteractable,
            PlaceholderText,
            CharacterLimit
        }

        [Header("InputField Control")]
        [SerializeField] private InputFieldControlMode _mode = InputFieldControlMode.ToggleInteractable;

        [Header("Target")]
        [SerializeField] private InputField _inputField;

        [Header("Placeholder Text Variant Mapping")]
        [Tooltip("Placeholder text when flag is enabled and no variant matches")]
        [SerializeField] private string _enabledPlaceholder = "Enter text...";
        [Tooltip("Placeholder text when flag is disabled")]
        [SerializeField] private string _disabledPlaceholder = "Input disabled";
        [SerializeField] private List<VariantString> _textMap = new List<VariantString>();

        [Header("Character Limit")]
        [SerializeField] private int _enabledLimit = 100;
        [SerializeField] private int _disabledLimit = 0;
        [SerializeField] private List<VariantInt> _limitMap = new List<VariantInt>();

        [System.Serializable] public class VariantString { public string VariantName; public string Text; }
        [System.Serializable] public class VariantInt    { public string VariantName; public int Limit; }

        private void Awake()
        {
            if (_inputField == null) _inputField = GetComponent<InputField>();
        }

        protected override void OnFlagChanged(FlagProxy flag)
        {
            if (flag == null || _inputField == null) return;

            switch (_mode)
            {
                case InputFieldControlMode.ToggleInteractable:
                    _inputField.interactable = flag.Enabled;
                    break;

                case InputFieldControlMode.PlaceholderText:
                    var text = ResolvePlaceholder(flag);
                    var placeholder = _inputField.placeholder as Text;
                    if (placeholder != null) placeholder.text = text;
                    break;

                case InputFieldControlMode.CharacterLimit:
                    _inputField.characterLimit = ResolveLimit(flag);
                    break;
            }
        }

        private string ResolvePlaceholder(FlagProxy flag)
        {
            if (!flag.Enabled) return _disabledPlaceholder;
            var name = flag.Variant?.Name ?? "";
            foreach (var e in _textMap)
                if (e.VariantName == name) return e.Text;
            if (flag.Variant?.Value is string s) return s;
            return _enabledPlaceholder;
        }

        private int ResolveLimit(FlagProxy flag)
        {
            if (!flag.Enabled) return _disabledLimit;
            var name = flag.Variant?.Name ?? "";
            foreach (var e in _limitMap)
                if (e.VariantName == name) return e.Limit;
            if (flag.Variant?.Value != null)
            {
                try { return Convert.ToInt32(flag.Variant.Value); } catch { }
            }
            return _enabledLimit;
        }
    }
}
