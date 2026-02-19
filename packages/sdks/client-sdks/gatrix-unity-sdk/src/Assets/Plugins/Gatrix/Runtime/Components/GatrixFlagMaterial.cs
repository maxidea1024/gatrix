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
    public class GatrixFlagMaterial : MonoBehaviour
    {
        public enum Mode { SwapMaterial, UpdateColor, UpdateFloat }

        [Header("Flag Configuration")]
        [GatrixFlagName]
        [SerializeField] private string _flagName;

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

        private Action _unwatch;
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

        private void OnEnable()
        {
            DetectTarget();
            CaptureOriginal();
            Subscribe();
        }

        private void OnDisable()
        {
            Unsubscribe();
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

        private void Subscribe()
        {
            if (string.IsNullOrEmpty(_flagName)) return;

            var client = GatrixBehaviour.Client;
            if (client == null) return;

            _unwatch = client.Features.WatchRealtimeFlagWithInitialState(_flagName, OnFlagChanged,
                $"FlagMaterial:{gameObject.name}");
        }

        private void Unsubscribe()
        {
            _unwatch?.Invoke();
            _unwatch = null;
        }

        private void OnFlagChanged(FlagProxy flag)
        {
            if (_renderer == null) return;

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
                        // JSON Color { r: 1, g: 0, b: 0, a: 1 }
                        float r = GetFloat(dict, "r", _originalColor.r);
                        float g = GetFloat(dict, "g", _originalColor.g);
                        float b = GetFloat(dict, "b", _originalColor.b);
                        float a = GetFloat(dict, "a", _originalColor.a);
                        _renderer.material.SetColor(_propertyName, new Color(r, g, b, a));
                    }
                    else if (value is string hex)
                    {
                        // Hex string "#FF0000"
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
