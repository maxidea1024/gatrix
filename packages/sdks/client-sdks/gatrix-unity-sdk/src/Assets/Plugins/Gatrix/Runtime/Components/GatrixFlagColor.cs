// GatrixFlagColor - Tint UI Graphics or Renderers based on feature flag state or variant
// Useful for A/B testing UI color themes, seasonal color changes, or status indicators

using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Changes the color of a Graphic (UI) or Renderer based on a feature flag's state or variant.
    /// Supports smooth color transitions via lerp.
    ///
    /// Usage:
    ///   1. Add this component to a GameObject with a Graphic or Renderer
    ///   2. Set the Flag Name
    ///   3. Configure colors for enabled/disabled states or variant name mappings
    /// </summary>
    [AddComponentMenu("Gatrix/Flag Color")]
    public class GatrixFlagColor : MonoBehaviour
    {
        [Header("Flag Configuration")]
        [Tooltip("The feature flag name to watch")]
        [GatrixFlagName]
        [SerializeField] private string _flagName;

        [Header("Color Mode")]
        [SerializeField] private ColorMode _mode = ColorMode.ByState;

        [Header("State Colors")]
        [Tooltip("Color when flag is enabled")]
        [SerializeField] private Color _enabledColor = Color.green;

        [Tooltip("Color when flag is disabled")]
        [SerializeField] private Color _disabledColor = Color.gray;

        [Header("Variant Colors")]
        [Tooltip("Map variant names to colors")]
        [SerializeField] private List<VariantColorEntry> _variantColors = new List<VariantColorEntry>();

        [Header("Transition")]
        [Tooltip("Smoothly lerp between colors")]
        [SerializeField] private bool _animate = true;

        [Tooltip("Lerp speed (higher = faster)")]
        [SerializeField] private float _lerpSpeed = 5f;

        [Header("Targets")]
        [Tooltip("UI Graphic to tint (auto-detected if null)")]
        [SerializeField] private Graphic _graphic;

        [Tooltip("Renderer to tint (auto-detected if null)")]
        [SerializeField] private Renderer _renderer;

        public enum ColorMode
        {
            ByState,
            ByVariant
        }

        [System.Serializable]
        public class VariantColorEntry
        {
            public string VariantName;
            public Color Color = Color.white;
        }

        private System.Action _unwatch;
        private Color _targetColor;
        private bool _hasTarget;

        private void Awake()
        {
            if (_graphic == null) _graphic = GetComponent<Graphic>();
            if (_renderer == null) _renderer = GetComponent<Renderer>();

            _hasTarget = _graphic != null || _renderer != null;
        }

        private void OnEnable()
        {
            if (string.IsNullOrEmpty(_flagName)) return;
            var client = GatrixBehaviour.Client;
            if (client == null) return;

            _unwatch = client.Features.WatchRealtimeFlagWithInitialState(_flagName, OnFlagChanged,
                $"FlagColor:{gameObject.name}");
        }

        private void OnDisable()
        {
            _unwatch?.Invoke();
            _unwatch = null;
        }

        private void Update()
        {
            if (!_animate || !_hasTarget) return;

            if (_graphic != null)
            {
                _graphic.color = Color.Lerp(_graphic.color, _targetColor, Time.deltaTime * _lerpSpeed);
            }
            else if (_renderer != null)
            {
                var mat = _renderer.material;
                mat.color = Color.Lerp(mat.color, _targetColor, Time.deltaTime * _lerpSpeed);
            }
        }

        private void OnFlagChanged(FlagProxy flag)
        {
            Color color;

            if (_mode == ColorMode.ByState)
            {
                color = flag.Enabled ? _enabledColor : _disabledColor;
            }
            else
            {
                color = Color.white;
                var variantName = flag.Variant?.Name ?? "";
                foreach (var entry in _variantColors)
                {
                    if (entry.VariantName == variantName)
                    {
                        color = entry.Color;
                        break;
                    }
                }
            }

            _targetColor = color;

            if (!_animate)
            {
                // Apply immediately
                if (_graphic != null) _graphic.color = color;
                else if (_renderer != null) _renderer.material.color = color;
            }
        }
    }
}
