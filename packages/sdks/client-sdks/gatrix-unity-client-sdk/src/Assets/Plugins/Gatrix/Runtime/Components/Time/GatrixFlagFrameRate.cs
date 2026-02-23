// GatrixFlagFrameRate - Control Application.targetFrameRate via feature flags
// Supports variant-to-framerate mapping for performance/battery A/B experiments

using System;
using System.Collections.Generic;
using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Controls Application.targetFrameRate based on a feature flag.
    /// Variant names map to specific frame rates; restores original on destroy.
    /// </summary>
    [AddComponentMenu("Gatrix/Time/Flag Frame Rate")]
    public class GatrixFlagFrameRate : GatrixFlagComponentBase
    {
        [Header("Frame Rate")]
        [Tooltip("Target frame rate when flag is enabled and no variant matches")]
        [SerializeField] private int _enabledFrameRate = 30;
        [Tooltip("Target frame rate when flag is disabled (-1 = platform default)")]
        [SerializeField] private int _disabledFrameRate = -1;

        [Header("Variant Mapping")]
        [Tooltip("Map variant names to specific target frame rates")]
        [SerializeField] private List<VariantInt> _variantMap = new List<VariantInt>();

        [System.Serializable]
        public class VariantInt
        {
            public string VariantName;
            [Tooltip("Target frame rate (-1 = platform default, 30 = battery saver, 60 = standard, 120 = high)")]
            public int FrameRate = 60;
        }

        private int _originalFrameRate;

        private void Awake()
        {
            _originalFrameRate = Application.targetFrameRate;
        }

        protected override void OnFlagChanged(FlagProxy flag)
        {
            if (flag == null) return;

            if (!flag.Enabled)
            {
                Application.targetFrameRate = _disabledFrameRate;
                return;
            }

            // Variant name map takes priority
            var variantName = flag.Variant?.Name ?? "";
            foreach (var entry in _variantMap)
            {
                if (entry.VariantName == variantName)
                {
                    Application.targetFrameRate = entry.FrameRate;
                    return;
                }
            }

            // Numeric variant value as fallback
            if (flag.Variant?.Value != null)
            {
                try
                {
                    Application.targetFrameRate = Convert.ToInt32(flag.Variant.Value);
                    return;
                }
                catch { }
            }

            Application.targetFrameRate = _enabledFrameRate;
        }

        private void OnDestroy()
        {
            Application.targetFrameRate = _originalFrameRate;
        }
    }
}
