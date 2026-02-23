// GatrixFlagPostProcessVolume - Control Post Process Volume weight via feature flags
// Supports variant-to-weight mapping for A/B visual effect experiments
// Uses reflection to avoid hard dependency on URP/HDRP/Legacy PostProcessing packages

using System;
using System.Collections.Generic;
using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Controls a Post Processing Volume's weight based on a feature flag.
    /// Detects Volume component via reflection to support URP, HDRP, and Legacy PP stack
    /// without a hard package dependency. Variant names map to specific weight values.
    /// </summary>
    [AddComponentMenu("Gatrix/PostFX/Flag Post Process Volume")]
    public class GatrixFlagPostProcessVolume : GatrixFlagComponentBase
    {
        [Header("Volume Weight")]
        [Tooltip("Volume weight when flag is enabled and no variant matches (0-1)")]
        [Range(0f, 1f)] [SerializeField] private float _enabledWeight = 1f;
        [Tooltip("Volume weight when flag is disabled (0-1)")]
        [Range(0f, 1f)] [SerializeField] private float _disabledWeight = 0f;

        [Header("Transition")]
        [SerializeField] private bool _animate = true;
        [SerializeField] private float _lerpSpeed = 5f;

        [Header("Variant Mapping")]
        [Tooltip("Map variant names to specific volume weight values")]
        [SerializeField] private List<VariantFloat> _variantMap = new List<VariantFloat>();

        [System.Serializable]
        public class VariantFloat
        {
            public string VariantName;
            [Range(0f, 1f)] public float Weight = 1f;
        }

        // Reflection cache for URP/HDRP Volume component
        private Component _volume;
        private System.Reflection.PropertyInfo _weightProp;
        private float _targetWeight;

        private void Awake()
        {
            // Try URP / HDRP Volume first
            var urpType = Type.GetType("UnityEngine.Rendering.Volume, Unity.RenderPipelines.Core.Runtime");
            // Try legacy PostProcessing stack
            var legacyType = Type.GetType("UnityEngine.Rendering.PostProcessing.PostProcessVolume, Unity.Postprocessing.Runtime");

            var volumeType = urpType ?? legacyType;
            if (volumeType != null)
            {
                _volume = GetComponent(volumeType);
                if (_volume != null)
                    _weightProp = volumeType.GetProperty("weight");
            }

            _targetWeight = GetCurrentWeight();
        }

        protected override void OnFlagChanged(FlagProxy flag)
        {
            if (flag == null) return;
            _targetWeight = ResolveFloat(flag);
            if (!_animate) SetWeight(_targetWeight);
        }

        private float ResolveFloat(FlagProxy flag)
        {
            if (!flag.Enabled) return _disabledWeight;
            var name = flag.Variant?.Name ?? "";
            foreach (var e in _variantMap)
                if (e.VariantName == name) return e.Weight;
            if (flag.Variant?.Value != null)
            {
                try { return Mathf.Clamp01(Convert.ToSingle(flag.Variant.Value)); } catch { }
            }
            return _enabledWeight;
        }

        private void Update()
        {
            if (!_animate) return;
            float current = GetCurrentWeight();
            SetWeight(Mathf.Lerp(current, _targetWeight, Time.deltaTime * _lerpSpeed));
        }

        private float GetCurrentWeight()
        {
            if (_volume != null && _weightProp != null)
                return Convert.ToSingle(_weightProp.GetValue(_volume));
            return 0f;
        }

        private void SetWeight(float w)
        {
            if (_volume != null && _weightProp != null)
                _weightProp.SetValue(_volume, w);
        }
    }
}
