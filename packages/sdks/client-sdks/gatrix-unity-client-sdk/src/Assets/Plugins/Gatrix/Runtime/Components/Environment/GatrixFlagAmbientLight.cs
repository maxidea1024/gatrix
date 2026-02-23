// GatrixFlagAmbientLight - Control global Ambient Light via feature flags
// Supports variant-to-color mapping for A/B lighting theme experiments

using System.Collections.Generic;
using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Controls Unity's global Ambient Light color based on a feature flag.
    /// Variant names map to specific ambient colors; supports smooth transitions.
    /// </summary>
    [AddComponentMenu("Gatrix/Environment/Flag Ambient Light")]
    public class GatrixFlagAmbientLight : GatrixFlagComponentBase
    {
        [Header("Ambient Light Colors")]
        [SerializeField] private Color _enabledColor = new Color(0.2f, 0.2f, 0.2f);
        [SerializeField] private Color _disabledColor = new Color(0.2f, 0.2f, 0.2f);

        [Header("Variant Mapping")]
        [Tooltip("Map variant names to specific ambient light colors")]
        [SerializeField] private List<VariantColor> _variantMap = new List<VariantColor>();

        [Header("Transition")]
        [SerializeField] private bool _animate = true;
        [SerializeField] private float _lerpSpeed = 3f;

        [System.Serializable]
        public class VariantColor
        {
            public string VariantName;
            public Color Color = new Color(0.2f, 0.2f, 0.2f);
        }

        private Color _originalColor;
        private Color _targetColor;

        private void Awake()
        {
            _originalColor = RenderSettings.ambientLight;
            _targetColor = _originalColor;
        }

        protected override void OnFlagChanged(FlagProxy flag)
        {
            if (flag == null) return;

            if (!flag.Enabled)
            {
                _targetColor = _disabledColor;
            }
            else
            {
                // Variant name map takes priority
                var variantName = flag.Variant?.Name ?? "";
                Color resolved = _enabledColor;
                foreach (var entry in _variantMap)
                {
                    if (entry.VariantName == variantName)
                    {
                        resolved = entry.Color;
                        break;
                    }
                }

                // Hex string variant value as fallback
                if (resolved == _enabledColor && flag.Variant?.Value is string hex
                    && ColorUtility.TryParseHtmlString(hex, out Color parsed))
                {
                    resolved = parsed;
                }

                _targetColor = resolved;
            }

            if (!_animate) RenderSettings.ambientLight = _targetColor;
        }

        private void Update()
        {
            if (!_animate) return;
            RenderSettings.ambientLight = Color.Lerp(RenderSettings.ambientLight, _targetColor, Time.deltaTime * _lerpSpeed);
        }

        private void OnDestroy()
        {
            RenderSettings.ambientLight = _originalColor;
        }
    }
}
