// GatrixFlagLineRenderer - Control LineRenderer via feature flags
// Useful for toggling debug lines, UI underlines, or path visualization

using System;
using System.Collections.Generic;
using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Controls a LineRenderer's enabled state, width, and colors
    /// based on a feature flag. Variant names map to specific values.
    /// </summary>
    [AddComponentMenu("Gatrix/Rendering/Flag Line Renderer")]
    [RequireComponent(typeof(LineRenderer))]
    public class GatrixFlagLineRenderer : GatrixFlagComponentBase
    {
        public enum LineControlMode
        {
            ToggleEnabled,
            StartWidth,
            StartColor,
            EndColor
        }

        [Header("Line Control")]
        [SerializeField] private LineControlMode _mode = LineControlMode.ToggleEnabled;

        [Header("Float Values")]
        [SerializeField] private float _enabledWidth = 0.1f;
        [SerializeField] private float _disabledWidth = 0f;
        [SerializeField] private List<VariantFloat> _widthMap = new List<VariantFloat>();

        [Header("Color Values")]
        [SerializeField] private Color _enabledColor = Color.white;
        [SerializeField] private Color _disabledColor = Color.clear;
        [SerializeField] private List<VariantColor> _colorMap = new List<VariantColor>();

        [System.Serializable] public class VariantFloat { public string VariantName; public float Value; }
        [System.Serializable] public class VariantColor { public string VariantName; public Color Color = Color.white; }

        private LineRenderer _line;

        private void Awake()
        {
            _line = GetComponent<LineRenderer>();
        }

        protected override void OnFlagChanged(FlagProxy flag)
        {
            if (flag == null || _line == null) return;

            switch (_mode)
            {
                case LineControlMode.ToggleEnabled:
                    _line.enabled = flag.Enabled;
                    break;

                case LineControlMode.StartWidth:
                    _line.startWidth = ResolveFloat(flag);
                    break;

                case LineControlMode.StartColor:
                    _line.startColor = ResolveColor(flag);
                    break;

                case LineControlMode.EndColor:
                    _line.endColor = ResolveColor(flag);
                    break;
            }
        }

        private float ResolveFloat(FlagProxy flag)
        {
            if (!flag.Enabled) return _disabledWidth;
            var name = flag.Variant?.Name ?? "";
            foreach (var e in _widthMap)
                if (e.VariantName == name) return e.Value;
            if (flag.Variant?.Value != null)
            {
                try { return Convert.ToSingle(flag.Variant.Value); } catch { }
            }
            return _enabledWidth;
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
