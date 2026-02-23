// GatrixFlagTimeScale - Control Time.timeScale via feature flags
// Supports variant-to-timescale mapping for slow-motion, freeze, or speed-up A/B experiments

using System;
using System.Collections.Generic;
using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Controls Unity's Time.timeScale based on a feature flag.
    /// Variant names map to specific time scales; restores original on destroy.
    /// </summary>
    [AddComponentMenu("Gatrix/Time/Flag Time Scale")]
    public class GatrixFlagTimeScale : GatrixFlagComponentBase
    {
        [Header("Time Scale")]
        [Tooltip("Time scale when flag is enabled and no variant matches")]
        [SerializeField] private float _enabledTimeScale = 0.5f;
        [Tooltip("Time scale when flag is disabled (usually 1.0)")]
        [SerializeField] private float _disabledTimeScale = 1f;

        [Header("Variant Mapping")]
        [Tooltip("Map variant names to specific time scale values")]
        [SerializeField] private List<VariantFloat> _variantMap = new List<VariantFloat>();

        [System.Serializable]
        public class VariantFloat
        {
            public string VariantName;
            [Tooltip("Time scale (0 = frozen, 0.5 = slow-mo, 1 = normal, 2 = fast)")]
            public float TimeScale = 1f;
        }

        private float _originalTimeScale;

        private void Awake()
        {
            _originalTimeScale = Time.timeScale;
        }

        protected override void OnFlagChanged(FlagProxy flag)
        {
            if (flag == null) return;

            if (!flag.Enabled)
            {
                Time.timeScale = _disabledTimeScale;
                return;
            }

            // Variant name map takes priority
            var variantName = flag.Variant?.Name ?? "";
            foreach (var entry in _variantMap)
            {
                if (entry.VariantName == variantName)
                {
                    Time.timeScale = entry.TimeScale;
                    return;
                }
            }

            // Numeric variant value as fallback
            if (flag.Variant?.Value != null)
            {
                try
                {
                    Time.timeScale = Convert.ToSingle(flag.Variant.Value);
                    return;
                }
                catch { }
            }

            Time.timeScale = _enabledTimeScale;
        }

        private void OnDestroy()
        {
            Time.timeScale = _originalTimeScale;
        }
    }
}
