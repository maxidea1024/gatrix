// GatrixFlagGravity - Control global Physics.gravity scale via feature flags
// Supports variant-to-gravity-scale mapping for A/B gravity experiments

using System;
using System.Collections.Generic;
using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Scales or replaces the global Physics.gravity based on a feature flag.
    /// Variant names map to specific gravity scales; restores original on destroy.
    /// </summary>
    [AddComponentMenu("Gatrix/Physics/Flag Gravity")]
    public class GatrixFlagGravity : GatrixFlagComponentBase
    {
        [Header("Gravity Control")]
        [Tooltip("Gravity multiplier when flag is enabled (1 = normal, 0 = zero-G)")]
        [SerializeField] private float _enabledGravityScale = 0f;
        [Tooltip("Gravity multiplier when flag is disabled")]
        [SerializeField] private float _disabledGravityScale = 1f;

        [Header("Variant Mapping")]
        [Tooltip("Map variant names to specific gravity scale multipliers")]
        [SerializeField] private List<VariantFloat> _variantMap = new List<VariantFloat>();

        [Header("Transition")]
        [SerializeField] private bool _animate = true;
        [SerializeField] private float _lerpSpeed = 3f;

        [Serializable]
        public class VariantFloat
        {
            public string VariantName;
            [Tooltip("Gravity scale multiplier (0 = zero-G, 1 = normal, 2 = double gravity)")]
            public float Scale = 1f;
        }

        private Vector3 _originalGravity;
        private float _targetScale;

        private void Awake()
        {
            _originalGravity = Physics.gravity;
            _targetScale = 1f;
        }

        protected override void OnFlagChanged(FlagProxy flag)
        {
            if (flag == null) return;

            float scale = flag.Enabled ? _enabledGravityScale : _disabledGravityScale;

            if (flag.Enabled)
            {
                // Variant name map takes priority
                var variantName = flag.Variant?.Name ?? "";
                foreach (var entry in _variantMap)
                {
                    if (entry.VariantName == variantName)
                    {
                        scale = entry.Scale;
                        break;
                    }
                }

                // Numeric variant value as fallback
                if (scale == _enabledGravityScale && flag.Variant?.Value != null)
                {
                    try { scale = Convert.ToSingle(flag.Variant.Value); } catch { }
                }
            }

            _targetScale = scale;

            if (!_animate)
                Physics.gravity = _originalGravity * _targetScale;
        }

        private void Update()
        {
            if (!_animate) return;

            float currentMag = _originalGravity.magnitude > 0f ? _originalGravity.magnitude : 1f;
            float current = Physics.gravity.magnitude / currentMag;
            float next = Mathf.Lerp(current, _targetScale, Time.deltaTime * _lerpSpeed);
            Physics.gravity = _originalGravity * next;
        }

        private void OnDestroy()
        {
            Physics.gravity = _originalGravity;
        }
    }
}
