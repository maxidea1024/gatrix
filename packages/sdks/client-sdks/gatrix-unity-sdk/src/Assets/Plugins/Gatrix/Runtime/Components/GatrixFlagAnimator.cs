// GatrixFlagAnimator - Control Animator parameters based on feature flag state or variant
// Useful for A/B testing animations, enabling special effects, or gradual rollouts of new animations

using System.Collections.Generic;
using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Controls Animator parameters based on a feature flag's state or variant.
    /// Supports Bool, Trigger, Int, and Float parameter types.
    /// </summary>
    [AddComponentMenu("Gatrix/Flag Animator")]
    [RequireComponent(typeof(Animator))]
    public class GatrixFlagAnimator : GatrixFlagComponentBase
    {
        [Header("Bool Parameter")]
        [Tooltip("Animator bool parameter to set based on flag state")]
        [SerializeField] private string _boolParameter;

        [Header("Trigger Parameters")]
        [Tooltip("Trigger to fire when flag becomes enabled")]
        [SerializeField] private string _enabledTrigger;

        [Tooltip("Trigger to fire when flag becomes disabled")]
        [SerializeField] private string _disabledTrigger;

        [Header("Variant Int Parameter")]
        [Tooltip("Animator int parameter to set based on variant")]
        [SerializeField] private string _variantIntParameter;

        [Tooltip("Map variant names to integer values")]
        [SerializeField] private List<VariantIntEntry> _variantIntMap = new List<VariantIntEntry>();

        [System.Serializable]
        public class VariantIntEntry
        {
            public string VariantName;
            public int Value;
        }

        private Animator _animator;
        private bool _lastEnabled;

        private void Awake()
        {
            _animator = GetComponent<Animator>();
        }

        protected override void OnFlagChanged(FlagProxy flag)
        {
            if (flag == null || _animator == null) return;

            // Bool parameter
            if (!string.IsNullOrEmpty(_boolParameter))
            {
                _animator.SetBool(_boolParameter, flag.Enabled);
            }

            // Trigger parameters (only fire on state change)
            if (flag.Enabled != _lastEnabled)
            {
                if (flag.Enabled && !string.IsNullOrEmpty(_enabledTrigger))
                {
                    _animator.SetTrigger(_enabledTrigger);
                }
                else if (!flag.Enabled && !string.IsNullOrEmpty(_disabledTrigger))
                {
                    _animator.SetTrigger(_disabledTrigger);
                }
            }

            // Variant Int parameter
            if (!string.IsNullOrEmpty(_variantIntParameter))
            {
                var variantName = flag.Variant?.Name ?? "";
                foreach (var entry in _variantIntMap)
                {
                    if (entry.VariantName == variantName)
                    {
                        _animator.SetInteger(_variantIntParameter, entry.Value);
                        break;
                    }
                }
            }

            _lastEnabled = flag.Enabled;
        }
    }
}
