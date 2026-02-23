// GatrixFlagLight - Control Light properties per variant via feature flags
// Supports variant-to-intensity/color/range mapping for A/B lighting experiments

using System;
using System.Collections.Generic;
using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Controls a Light component's intensity, color, and range based on a feature flag.
    /// Variant names are mapped to specific values; falls back to enabled/disabled defaults.
    /// </summary>
    [AddComponentMenu("Gatrix/Lighting/Flag Light")]
    [RequireComponent(typeof(Light))]
    public class GatrixFlagLight : GatrixFlagComponentBase
    {
        public enum LightControlMode
        {
            ToggleEnabled,
            Intensity,
            Color,
            Range
        }

        [Header("Light Control")]
        [SerializeField] private LightControlMode _mode = LightControlMode.Intensity;

        [Header("Intensity")]
        [Tooltip("Intensity when flag enabled and no variant matches")]
        [SerializeField] private float _enabledIntensity = 1f;
        [Tooltip("Intensity when flag disabled")]
        [SerializeField] private float _disabledIntensity = 0f;
        [Tooltip("Per-variant intensity mapping")]
        [SerializeField] private List<VariantFloat> _intensityMap = new List<VariantFloat>();

        [Header("Color")]
        [SerializeField] private Color _enabledColor = Color.white;
        [SerializeField] private Color _disabledColor = Color.grey;
        [Tooltip("Per-variant color mapping (use HTML hex e.g. #FF4400 in variant string value, or fill list below)")]
        [SerializeField] private List<VariantColor> _colorMap = new List<VariantColor>();

        [Header("Range")]
        [SerializeField] private float _enabledRange = 10f;
        [SerializeField] private float _disabledRange = 0f;
        [SerializeField] private List<VariantFloat> _rangeMap = new List<VariantFloat>();

        [Header("Transition")]
        [SerializeField] private bool _animate = true;
        [SerializeField] private float _lerpSpeed = 5f;

        [Serializable] public class VariantFloat { public string VariantName; public float Value; }
        [Serializable] public class VariantColor { public string VariantName; public Color Value = Color.white; }

        private Light _light;
        private float _targetIntensity;
        private Color _targetColor;
        private float _targetRange;

        private void Awake()
        {
            _light = GetComponent<Light>();
            _targetIntensity = _light.intensity;
            _targetColor = _light.color;
            _targetRange = _light.range;
        }

        protected override void OnFlagChanged(FlagProxy flag)
        {
            if (flag == null || _light == null) return;

            switch (_mode)
            {
                case LightControlMode.ToggleEnabled:
                    _light.enabled = flag.Enabled;
                    break;

                case LightControlMode.Intensity:
                    _targetIntensity = ResolveFloat(flag, _intensityMap, _enabledIntensity, _disabledIntensity);
                    if (!_animate) _light.intensity = _targetIntensity;
                    break;

                case LightControlMode.Color:
                    _targetColor = ResolveColor(flag, _colorMap, _enabledColor, _disabledColor);
                    if (!_animate) _light.color = _targetColor;
                    break;

                case LightControlMode.Range:
                    _targetRange = ResolveFloat(flag, _rangeMap, _enabledRange, _disabledRange);
                    if (!_animate) _light.range = _targetRange;
                    break;
            }
        }

        private void Update()
        {
            if (!_animate || _light == null) return;
            switch (_mode)
            {
                case LightControlMode.Intensity:
                    _light.intensity = Mathf.Lerp(_light.intensity, _targetIntensity, Time.deltaTime * _lerpSpeed);
                    break;
                case LightControlMode.Color:
                    _light.color = Color.Lerp(_light.color, _targetColor, Time.deltaTime * _lerpSpeed);
                    break;
                case LightControlMode.Range:
                    _light.range = Mathf.Lerp(_light.range, _targetRange, Time.deltaTime * _lerpSpeed);
                    break;
            }
        }

        // Resolve float: variant map first, then numeric variant value, then enabled/disabled default
        private static float ResolveFloat(FlagProxy flag, List<VariantFloat> map, float enabled, float disabled)
        {
            if (!flag.Enabled) return disabled;
            var name = flag.Variant?.Name ?? "";
            foreach (var e in map)
                if (e.VariantName == name) return e.Value;
            if (flag.Variant?.Value != null)
            {
                try { return Convert.ToSingle(flag.Variant.Value); } catch { }
            }
            return enabled;
        }

        // Resolve Color: variant map first, then hex string variant value, then enabled/disabled default
        private static Color ResolveColor(FlagProxy flag, List<VariantColor> map, Color enabled, Color disabled)
        {
            if (!flag.Enabled) return disabled;
            var name = flag.Variant?.Name ?? "";
            foreach (var e in map)
                if (e.VariantName == name) return e.Value;
            if (flag.Variant?.Value is string hex && ColorUtility.TryParseHtmlString(hex, out Color parsed))
                return parsed;
            return enabled;
        }
    }
}
