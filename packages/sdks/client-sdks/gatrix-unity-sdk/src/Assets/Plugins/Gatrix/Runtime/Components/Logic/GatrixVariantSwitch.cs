// GatrixVariantSwitch - Activate different GameObjects based on variant name
// Ideal for A/B testing: map variant names to different UI/prefab setups

using System;
using System.Collections.Generic;
using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Activates specific GameObjects based on the current variant name of a feature flag.
    /// Perfect for A/B testing where different variants show different UI or game content.
    /// </summary>
    [AddComponentMenu("Gatrix/Variant Switch")]
    public class GatrixVariantSwitch : GatrixFlagComponentBase
    {
        [Header("Variant Mappings")]
        [Tooltip("Map variant names to GameObjects")]
        [SerializeField] private List<VariantMapping> _mappings = new List<VariantMapping>();

        [Header("Fallback")]
        [Tooltip("GameObject to activate when no variant matches (optional)")]
        [SerializeField] private GameObject _fallbackObject;

        [Tooltip("Deactivate all mapped objects when flag is disabled")]
        [SerializeField] private bool _hideWhenDisabled = true;

        [Serializable]
        public class VariantMapping
        {
            [Tooltip("The variant name from the server")]
            public string variantName;

            [Tooltip("GameObject(s) to activate for this variant")]
            public List<GameObject> targets = new List<GameObject>();
        }

        protected override void OnFlagChanged(FlagProxy flag)
        {
            if (flag == null) return;

            // If flag is disabled and hideWhenDisabled, deactivate all
            if (!flag.Enabled && _hideWhenDisabled)
            {
                DeactivateAll();
                if (_fallbackObject != null)
                    _fallbackObject.SetActive(true);
                return;
            }

            var variantName = flag.Variant?.Name ?? "";
            bool matched = false;

            foreach (var mapping in _mappings)
            {
                bool isMatch = string.Equals(mapping.variantName, variantName,
                    StringComparison.OrdinalIgnoreCase);

                foreach (var target in mapping.targets)
                {
                    if (target != null) target.SetActive(isMatch);
                }

                if (isMatch) matched = true;
            }

            // Handle fallback
            if (_fallbackObject != null)
            {
                _fallbackObject.SetActive(!matched);
            }
        }

        private void DeactivateAll()
        {
            foreach (var mapping in _mappings)
            {
                foreach (var target in mapping.targets)
                {
                    if (target != null) target.SetActive(false);
                }
            }
        }
    }
}
