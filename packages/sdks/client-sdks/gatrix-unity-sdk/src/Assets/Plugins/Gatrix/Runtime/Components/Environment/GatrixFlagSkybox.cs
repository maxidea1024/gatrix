// GatrixFlagSkybox - Swap or control Skybox material via feature flags
// Useful for dynamic weather/time-of-day, A/B testing visual environments

using System.Collections.Generic;
using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Swaps the global Skybox material based on a feature flag's variant.
    /// Supports mapping variant names to specific Skybox materials.
    /// </summary>
    [AddComponentMenu("Gatrix/Environment/Flag Skybox")]
    public class GatrixFlagSkybox : GatrixFlagComponentBase
    {
        [Header("Skybox Materials")]
        [Tooltip("Default Skybox material (used when flag is disabled or no variant matches)")]
        [SerializeField] private Material _defaultSkybox;

        [Tooltip("Map variant names to Skybox materials")]
        [SerializeField] private List<VariantSkyboxEntry> _variantSkyboxes = new List<VariantSkyboxEntry>();

        [System.Serializable]
        public class VariantSkyboxEntry
        {
            public string VariantName;
            public Material Skybox;
        }

        private Material _originalSkybox;

        private void Awake()
        {
            _originalSkybox = RenderSettings.skybox;
        }

        protected override void OnFlagChanged(FlagProxy flag)
        {
            if (flag == null) return;

            if (!flag.Enabled)
            {
                RenderSettings.skybox = _defaultSkybox ?? _originalSkybox;
                DynamicGI.UpdateEnvironment();
                return;
            }

            var variantName = flag.Variant?.Name ?? "";
            Material skybox = _defaultSkybox ?? _originalSkybox;

            foreach (var entry in _variantSkyboxes)
            {
                if (entry.VariantName == variantName && entry.Skybox != null)
                {
                    skybox = entry.Skybox;
                    break;
                }
            }

            RenderSettings.skybox = skybox;
            DynamicGI.UpdateEnvironment();
        }

        private void OnDestroy()
        {
            RenderSettings.skybox = _originalSkybox;
            DynamicGI.UpdateEnvironment();
        }
    }
}
