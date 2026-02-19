// GatrixFlagMaterial - Swap materials or update material properties based on flags
// Great for dynamic item highlighting, seasonal skins, or VFX changes

using System;
using System.Collections.Generic;
using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Changes a Renderer's material or updates material properties (like Color) based on feature flags.
    /// Supports mapping variants to materials or using JSON values for colors.
    /// </summary>
    [AddComponentMenu("Gatrix/Flag Material")]
    public class GatrixFlagMaterial : GatrixFlagComponentBase
    {
        public enum Mode { SwapMaterial, UpdateColor, UpdateFloat }

        [Header("Behavior")]
        [SerializeField] private Mode _mode = Mode.SwapMaterial;
        [SerializeField] private string _propertyName = "_Color";

        [Header("Material Mapping")]
        [Tooltip("Default material used when flag is disabled")]
        [SerializeField] private Material _defaultMaterial;

        [Tooltip("Mapping of variant names to materials")]
        [SerializeField] private List<VariantMaterialMap> _variantMaps = new List<VariantMaterialMap>();

        [Header("Target (auto-detected)")]
        [SerializeField] private Renderer _renderer;

        private Material _originalMaterial;
        private Color _originalColor;
        private float _originalFloat;
        private bool _hasOriginal;

        [Serializable]
        public class VariantMaterialMap
        {
            public string variantName;
            public Material material;
        }

        protected override void OnEnable()
        {
            DetectTarget();
            CaptureOriginal();
            base.OnEnable();
        }

        protected override void OnDisable()
        {
            base.OnDisable();
            RestoreOriginal();
        }

        private void DetectTarget()
        {
            if (_renderer == null) _renderer = GetComponent<Renderer>();
        }

        private void CaptureOriginal()
        {
            if (_hasOriginal || _renderer == null) return;
            
            _originalMaterial = _renderer.sharedMaterial;
            if (_renderer.sharedMaterial != null)
            {
                if (_renderer.sharedMaterial.HasProperty(_propertyName))
                {
                    _originalColor = _renderer.sharedMaterial.GetColor(_propertyName);
                    _originalFloat = _renderer.sharedMaterial.GetFloat(_propertyName);
                }
            }
            _hasOriginal = true;
        }

        protected override void OnFlagChanged(FlagProxy flag)
        {
            if (flag == null || _renderer == null) return;

            if (!flag.Enabled)
            {
                RestoreOriginal();
                return;
            }

            var value = flag.Variant?.Value;
            var variantName = flag.Variant?.Name;

            switch (_mode)
            {
                case Mode.SwapMaterial:
                    Material targetMat = null;
                    foreach (var map in _variantMaps)
                    {
                        if (map.variantName == variantName)
                        {
                            targetMat = map.material;
                            break;
                        }
                    }
                    _renderer.material = targetMat ?? _defaultMaterial;
                    break;

                case Mode.UpdateColor:
                    if (value is Dictionary<string, object> dict)
                    {
                        float r = GetFloat(dict, "r", _originalColor.r);
                        float g = GetFloat(dict, "g", _originalColor.g);
                        float b = GetFloat(dict, "b", _originalColor.b);
                        float a = GetFloat(dict, "a", _originalColor.a);
                        _renderer.material.SetColor(_propertyName, new Color(r, g, b, a));
                    }
                    else if (value is string hex)
                    {
                        if (ColorUtility.TryParseHtmlString(hex, out Color parsed))
                        {
                            _renderer.material.SetColor(_propertyName, parsed);
                        }
                    }
                    break;

                case Mode.UpdateFloat:
                    if (value != null)
                    {
                        float num = Convert.ToSingle(value);
                        _renderer.material.SetFloat(_propertyName, num);
                    }
                    break;
            }
        }

        private void RestoreOriginal()
        {
            if (!_hasOriginal || _renderer == null) return;
            if (_mode == Mode.SwapMaterial)
            {
                _renderer.material = _originalMaterial;
            }
            else if (_renderer.sharedMaterial != null && _renderer.sharedMaterial.HasProperty(_propertyName))
            {
                _renderer.material.SetColor(_propertyName, _originalColor);
                _renderer.material.SetFloat(_propertyName, _originalFloat);
            }
        }

        private float GetFloat(Dictionary<string, object> dict, string key, float @default)
        {
            if (dict.TryGetValue(key, out var val)) return Convert.ToSingle(val);
            return @default;
        }
    }
}
