// GatrixFlagGlobalShader - Set global shader properties via feature flags
// Affects ALL materials that reference the global property — powerful for scene-wide A/B effects

using System;
using System.Collections.Generic;
using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Sets a global shader property (Shader.SetGlobalFloat/Color/Int/Vector)
    /// based on a feature flag. Variant names map to specific values.
    /// Restores original values on destroy.
    /// </summary>
    [AddComponentMenu("Gatrix/Rendering/Flag Global Shader")]
    public class GatrixFlagGlobalShader : GatrixFlagComponentBase
    {
        public enum GlobalShaderType
        {
            Float,
            Color,
            Int,
            Vector
        }

        [Header("Global Shader Property")]
        [SerializeField] private GlobalShaderType _type = GlobalShaderType.Float;
        [Tooltip("Global shader property name (e.g., _GlobalWetness, _TimeOfDay)")]
        [SerializeField] private string _propertyName;

        [Header("Float Values")]
        [SerializeField] private float _enabledFloat = 1f;
        [SerializeField] private float _disabledFloat = 0f;
        [SerializeField] private List<VariantFloat> _floatMap = new List<VariantFloat>();

        [Header("Color Values")]
        [SerializeField] private Color _enabledColor = Color.white;
        [SerializeField] private Color _disabledColor = Color.black;
        [SerializeField] private List<VariantColor> _colorMap = new List<VariantColor>();

        [Header("Int Values")]
        [SerializeField] private int _enabledInt = 1;
        [SerializeField] private int _disabledInt = 0;

        [Header("Vector Values")]
        [SerializeField] private Vector4 _enabledVector = Vector4.one;
        [SerializeField] private Vector4 _disabledVector = Vector4.zero;

        [System.Serializable] public class VariantFloat { public string VariantName; public float Value; }
        [System.Serializable] public class VariantColor { public string VariantName; public Color Color = Color.white; }

        private float _originalFloat;
        private Color _originalColor;
        private int   _originalInt;

        private void Awake()
        {
            if (string.IsNullOrEmpty(_propertyName)) return;
            switch (_type)
            {
                case GlobalShaderType.Float:  _originalFloat = Shader.GetGlobalFloat(_propertyName); break;
                case GlobalShaderType.Color:  _originalColor = Shader.GetGlobalColor(_propertyName); break;
                case GlobalShaderType.Int:    _originalInt   = Shader.GetGlobalInt(_propertyName);   break;
            }
        }

        protected override void OnFlagChanged(FlagProxy flag)
        {
            if (flag == null || string.IsNullOrEmpty(_propertyName)) return;

            switch (_type)
            {
                case GlobalShaderType.Float:
                    Shader.SetGlobalFloat(_propertyName, ResolveFloat(flag));
                    break;

                case GlobalShaderType.Color:
                    Shader.SetGlobalColor(_propertyName, ResolveColor(flag));
                    break;

                case GlobalShaderType.Int:
                    Shader.SetGlobalInt(_propertyName, flag.Enabled ? _enabledInt : _disabledInt);
                    break;

                case GlobalShaderType.Vector:
                    Shader.SetGlobalVector(_propertyName, flag.Enabled ? _enabledVector : _disabledVector);
                    break;
            }
        }

        private float ResolveFloat(FlagProxy flag)
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

        private void OnDestroy()
        {
            if (string.IsNullOrEmpty(_propertyName)) return;
            switch (_type)
            {
                case GlobalShaderType.Float: Shader.SetGlobalFloat(_propertyName, _originalFloat); break;
                case GlobalShaderType.Color: Shader.SetGlobalColor(_propertyName, _originalColor); break;
                case GlobalShaderType.Int:   Shader.SetGlobalInt(_propertyName, _originalInt);     break;
            }
        }
    }
}
