// GatrixFlagShaderProperty - Set Material shader properties via feature flags
// More granular than GatrixFlagMaterial — controls individual shader params

using System;
using System.Collections.Generic;
using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Sets a specific shader property (float, color, int, keyword) on a Material
    /// based on a feature flag. Variant names map to specific property values.
    /// </summary>
    [AddComponentMenu("Gatrix/Rendering/Flag Shader Property")]
    public class GatrixFlagShaderProperty : GatrixFlagComponentBase
    {
        public enum ShaderPropertyType
        {
            Float,
            Color,
            Int,
            Keyword
        }

        [Header("Shader Property")]
        [Tooltip("Target type of this shader property")]
        [SerializeField] private ShaderPropertyType _propertyType = ShaderPropertyType.Float;
        [Tooltip("Shader property name (e.g., _Metallic, _EmissionColor, EMISSION)")]
        [SerializeField] private string _propertyName;

        [Header("Renderer (auto-detected)")]
        [SerializeField] private Renderer _renderer;

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

        [System.Serializable] public class VariantFloat { public string VariantName; public float Value; }
        [System.Serializable] public class VariantColor { public string VariantName; public Color Color = Color.white; }

        private Material _materialInstance;

        private void Awake()
        {
            if (_renderer == null) _renderer = GetComponent<Renderer>();
            if (_renderer != null)
                _materialInstance = _renderer.material; // instantiate a copy
        }

        protected override void OnFlagChanged(FlagProxy flag)
        {
            if (flag == null || _materialInstance == null || string.IsNullOrEmpty(_propertyName)) return;

            switch (_propertyType)
            {
                case ShaderPropertyType.Float:
                    _materialInstance.SetFloat(_propertyName, ResolveFloat(flag));
                    break;

                case ShaderPropertyType.Color:
                    _materialInstance.SetColor(_propertyName, ResolveColor(flag));
                    break;

                case ShaderPropertyType.Int:
                    _materialInstance.SetInt(_propertyName, flag.Enabled ? _enabledInt : _disabledInt);
                    break;

                case ShaderPropertyType.Keyword:
                    if (flag.Enabled)
                        _materialInstance.EnableKeyword(_propertyName);
                    else
                        _materialInstance.DisableKeyword(_propertyName);
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
    }
}
