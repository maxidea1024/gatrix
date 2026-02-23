// GatrixFlagTrailRenderer - Control TrailRenderer via feature flags
// Useful for toggling particle trails, comet effects, or movement visualization

using System;
using System.Collections.Generic;
using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Controls a TrailRenderer's enabled state, time, and width
    /// based on a feature flag. Variant names map to specific values.
    /// </summary>
    [AddComponentMenu("Gatrix/Rendering/Flag Trail Renderer")]
    [RequireComponent(typeof(TrailRenderer))]
    public class GatrixFlagTrailRenderer : GatrixFlagComponentBase
    {
        public enum TrailControlMode
        {
            ToggleEnabled,
            Time,
            StartWidth,
            StartColor
        }

        [Header("Trail Control")]
        [SerializeField] private TrailControlMode _mode = TrailControlMode.ToggleEnabled;

        [Header("Float Values")]
        [SerializeField] private float _enabledFloat = 1f;
        [SerializeField] private float _disabledFloat = 0f;
        [SerializeField] private List<VariantFloat> _floatMap = new List<VariantFloat>();

        [Header("Color Values")]
        [SerializeField] private Color _enabledColor = Color.white;
        [SerializeField] private Color _disabledColor = Color.clear;
        [SerializeField] private List<VariantColor> _colorMap = new List<VariantColor>();

        [System.Serializable] public class VariantFloat { public string VariantName; public float Value; }
        [System.Serializable] public class VariantColor { public string VariantName; public Color Color = Color.white; }

        private TrailRenderer _trail;
        private float _originalTime;
        private float _originalWidth;

        private void Awake()
        {
            _trail = GetComponent<TrailRenderer>();
            _originalTime  = _trail.time;
            _originalWidth = _trail.startWidth;
        }

        protected override void OnFlagChanged(FlagProxy flag)
        {
            if (flag == null || _trail == null) return;

            switch (_mode)
            {
                case TrailControlMode.ToggleEnabled:
                    _trail.enabled = flag.Enabled;
                    break;

                case TrailControlMode.Time:
                    _trail.time = ResolveFloat(flag, _originalTime);
                    break;

                case TrailControlMode.StartWidth:
                    _trail.startWidth = ResolveFloat(flag, _originalWidth);
                    break;

                case TrailControlMode.StartColor:
                    _trail.startColor = ResolveColor(flag);
                    break;
            }
        }

        private float ResolveFloat(FlagProxy flag, float original)
        {
            if (!flag.Enabled) return _disabledFloat;
            var name = flag.Variant?.Name ?? "";
            foreach (var e in _floatMap)
                if (e.VariantName == name) return e.Value;
            if (flag.Variant?.Value != null)
            {
                try { return Convert.ToSingle(flag.Variant.Value); } catch { }
            }
            return _enabledFloat;
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
    }
}
