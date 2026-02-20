// GatrixFlagFog - Control global Fog settings via feature flags
// Supports variant-to-density/color mapping for A/B atmospheric experiments

using System;
using System.Collections.Generic;
using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Controls Unity's global Fog settings (enabled, density, color) based on a feature flag.
    /// Variant names map to specific density or color values.
    /// </summary>
    [AddComponentMenu("Gatrix/Environment/Flag Fog")]
    public class GatrixFlagFog : GatrixFlagComponentBase
    {
        public enum FogControlMode
        {
            ToggleEnabled,
            Density,
            Color
        }

        [Header("Fog Control")]
        [SerializeField] private FogControlMode _mode = FogControlMode.ToggleEnabled;

        [Header("Density")]
        [SerializeField] private float _enabledDensity = 0.05f;
        [SerializeField] private float _disabledDensity = 0f;
        [Tooltip("Map variant names to specific fog density values")]
        [SerializeField] private List<VariantFloat> _densityMap = new List<VariantFloat>();

        [Header("Color")]
        [SerializeField] private Color _enabledColor = new Color(0.5f, 0.5f, 0.5f);
        [SerializeField] private Color _disabledColor = new Color(0.5f, 0.5f, 0.5f);
        [Tooltip("Map variant names to specific fog colors")]
        [SerializeField] private List<VariantColor> _colorMap = new List<VariantColor>();

        [Header("Transition")]
        [SerializeField] private bool _animate = true;
        [SerializeField] private float _lerpSpeed = 3f;

        [Serializable] public class VariantFloat { public string VariantName; public float Density; }
        [Serializable] public class VariantColor { public string VariantName; public Color Color = Color.grey; }

        private float _originalDensity;
        private Color _originalColor;
        private bool _originalFogEnabled;
        private float _targetDensity;
        private Color _targetColor;

        private void Awake()
        {
            _originalFogEnabled = RenderSettings.fog;
            _originalDensity = RenderSettings.fogDensity;
            _originalColor = RenderSettings.fogColor;
            _targetDensity = _originalDensity;
            _targetColor = _originalColor;
        }

        protected override void OnFlagChanged(FlagProxy flag)
        {
            if (flag == null) return;

            switch (_mode)
            {
                case FogControlMode.ToggleEnabled:
                    RenderSettings.fog = flag.Enabled;
                    break;

                case FogControlMode.Density:
                    _targetDensity = ResolveDensity(flag);
                    if (!_animate) RenderSettings.fogDensity = _targetDensity;
                    break;

                case FogControlMode.Color:
                    _targetColor = ResolveColor(flag);
                    if (!_animate) RenderSettings.fogColor = _targetColor;
                    break;
            }
        }

        private float ResolveDensity(FlagProxy flag)
        {
            if (!flag.Enabled) return _disabledDensity;
            var name = flag.Variant?.Name ?? "";
            foreach (var e in _densityMap)
                if (e.VariantName == name) return e.Density;
            if (flag.Variant?.Value != null)
            {
                try { return Convert.ToSingle(flag.Variant.Value); } catch { }
            }
            return _enabledDensity;
        }

        private Color ResolveColor(FlagProxy flag)
        {
            if (!flag.Enabled) return _disabledColor;
            var name = flag.Variant?.Name ?? "";
            foreach (var e in _colorMap)
                if (e.VariantName == name) return e.Color;
            if (flag.Variant?.Value is string hex && ColorUtility.TryParseHtmlString(hex, out Color parsed))
                return parsed;
            return _enabledColor;
        }

        private void Update()
        {
            if (!_animate) return;
            switch (_mode)
            {
                case FogControlMode.Density:
                    RenderSettings.fogDensity = Mathf.Lerp(RenderSettings.fogDensity, _targetDensity, Time.deltaTime * _lerpSpeed);
                    break;
                case FogControlMode.Color:
                    RenderSettings.fogColor = Color.Lerp(RenderSettings.fogColor, _targetColor, Time.deltaTime * _lerpSpeed);
                    break;
            }
        }

        private void OnDestroy()
        {
            RenderSettings.fog = _originalFogEnabled;
            RenderSettings.fogDensity = _originalDensity;
            RenderSettings.fogColor = _originalColor;
        }
    }
}
