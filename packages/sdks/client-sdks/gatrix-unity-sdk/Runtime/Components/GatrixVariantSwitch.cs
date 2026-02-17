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
    ///
    /// Usage:
    ///   1. Add this component to any GameObject
    ///   2. Set the Flag Name
    ///   3. Add variant-to-object mappings (e.g., "variant-a" → PanelA, "variant-b" → PanelB)
    ///   4. The matching variant's object is activated; all others are deactivated
    /// </summary>
    [AddComponentMenu("Gatrix/Variant Switch")]
    public class GatrixVariantSwitch : MonoBehaviour
    {
        [Header("Flag Configuration")]
        [Tooltip("The feature flag name to watch")]
        [SerializeField] private string _flagName;

        [Header("Variant Mappings")]
        [Tooltip("Map variant names to GameObjects")]
        [SerializeField] private List<VariantMapping> _mappings = new List<VariantMapping>();

        [Header("Fallback")]
        [Tooltip("GameObject to activate when no variant matches (optional)")]
        [SerializeField] private GameObject _fallbackObject;

        [Tooltip("Deactivate all mapped objects when flag is disabled")]
        [SerializeField] private bool _hideWhenDisabled = true;

        private Action _unwatch;
        private string _currentVariant;

        [Serializable]
        public class VariantMapping
        {
            [Tooltip("The variant name from the server")]
            public string variantName;

            [Tooltip("GameObject(s) to activate for this variant")]
            public List<GameObject> targets = new List<GameObject>();
        }

        /// <summary>Current active variant name</summary>
        public string CurrentVariant => _currentVariant;

        /// <summary>Current flag name</summary>
        public string FlagName
        {
            get => _flagName;
            set
            {
                if (_flagName == value) return;
                _flagName = value;
                Resubscribe();
            }
        }

        private void OnEnable()
        {
            Subscribe();
        }

        private void OnDisable()
        {
            Unsubscribe();
        }

        private void Subscribe()
        {
            if (string.IsNullOrEmpty(_flagName)) return;

            var client = GatrixBehaviour.Client;
            if (client == null) return;

            _unwatch = client.Features.WatchFlagWithInitialState(_flagName, OnFlagChanged,
                $"VariantSwitch:{gameObject.name}");
        }

        private void Unsubscribe()
        {
            _unwatch?.Invoke();
            _unwatch = null;
        }

        private void Resubscribe()
        {
            Unsubscribe();
            if (isActiveAndEnabled) Subscribe();
        }

        private void OnFlagChanged(FlagProxy flag)
        {
            // If flag is disabled and hideWhenDisabled, deactivate all
            if (!flag.Enabled && _hideWhenDisabled)
            {
                _currentVariant = null;
                DeactivateAll();
                if (_fallbackObject != null)
                    _fallbackObject.SetActive(true);
                return;
            }

            var variantName = flag.Variant?.Name ?? "";
            _currentVariant = variantName;

            bool matched = false;

            for (int i = 0; i < _mappings.Count; i++)
            {
                var mapping = _mappings[i];
                bool isMatch = string.Equals(mapping.variantName, variantName,
                    StringComparison.OrdinalIgnoreCase);

                for (int j = 0; j < mapping.targets.Count; j++)
                {
                    if (mapping.targets[j] != null)
                        mapping.targets[j].SetActive(isMatch);
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
            for (int i = 0; i < _mappings.Count; i++)
            {
                for (int j = 0; j < _mappings[i].targets.Count; j++)
                {
                    if (_mappings[i].targets[j] != null)
                        _mappings[i].targets[j].SetActive(false);
                }
            }
        }
    }
}
