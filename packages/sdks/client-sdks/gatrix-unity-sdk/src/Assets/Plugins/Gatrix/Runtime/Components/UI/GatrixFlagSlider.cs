// GatrixFlagSlider - Control UI Slider value via feature flags
// Supports variant-to-value mapping for A/B default value experiments

using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Binds a UI Slider's value or interactable state to a feature flag.
    /// Variant names map to specific slider values.
    /// </summary>
    [AddComponentMenu("Gatrix/UI/Flag Slider")]
    [RequireComponent(typeof(Slider))]
    public class GatrixFlagSlider : GatrixFlagComponentBase
    {
        public enum SliderControlMode
        {
            Value,
            Interactable
        }

        [Header("Slider Control")]
        [SerializeField] private SliderControlMode _mode = SliderControlMode.Value;

        [Header("Value")]
        [Tooltip("Slider value when flag is enabled and no variant matches")]
        [SerializeField] private float _enabledValue = 1f;
        [Tooltip("Slider value when flag is disabled")]
        [SerializeField] private float _disabledValue = 0f;

        [Header("Variant Mapping")]
        [Tooltip("Map variant names to specific slider values")]
        [SerializeField] private List<VariantFloat> _variantMap = new List<VariantFloat>();

        [System.Serializable]
        public class VariantFloat
        {
            public string VariantName;
            public float Value;
        }

        private Slider _slider;

        private void Awake()
        {
            _slider = GetComponent<Slider>();
        }

        protected override void OnFlagChanged(FlagProxy flag)
        {
            if (flag == null || _slider == null) return;

            switch (_mode)
            {
                case SliderControlMode.Value:
                    _slider.value = Mathf.Clamp(ResolveFloat(flag), _slider.minValue, _slider.maxValue);
                    break;

                case SliderControlMode.Interactable:
                    _slider.interactable = flag.Enabled;
                    break;
            }
        }

        private float ResolveFloat(FlagProxy flag)
        {
            if (!flag.Enabled) return _disabledValue;

            // Variant name map takes priority
            var variantName = flag.Variant?.Name ?? "";
            foreach (var entry in _variantMap)
                if (entry.VariantName == variantName) return entry.Value;

            // Numeric variant value as fallback
            if (flag.Variant?.Value != null)
            {
                try { return Convert.ToSingle(flag.Variant.Value); } catch { }
            }

            return _enabledValue;
        }
    }
}
