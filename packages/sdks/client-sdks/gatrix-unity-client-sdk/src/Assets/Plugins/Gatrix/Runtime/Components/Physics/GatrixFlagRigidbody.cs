// GatrixFlagRigidbody - Control Rigidbody physics properties via feature flags
// Supports variant-to-value mapping for A/B physics experiments

using System;
using System.Collections.Generic;
using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Controls a Rigidbody's physics properties (gravity, kinematic, mass, drag)
    /// based on a feature flag's state or variant value.
    /// Variant names map to specific values; falls back to enabled/disabled defaults.
    /// </summary>
    [AddComponentMenu("Gatrix/Physics/Flag Rigidbody")]
    [RequireComponent(typeof(Rigidbody))]
    public class GatrixFlagRigidbody : GatrixFlagComponentBase
    {
        public enum RigidbodyControlMode
        {
            ToggleGravity,
            ToggleKinematic,
            Mass,
            Drag,
            AngularDrag
        }

        [Header("Rigidbody Control")]
        [SerializeField] private RigidbodyControlMode _mode = RigidbodyControlMode.ToggleGravity;

        [Header("Fallback Values")]
        [Tooltip("Value when flag is enabled and no variant matches")]
        [SerializeField] private float _enabledValue = 1f;
        [Tooltip("Value when flag is disabled")]
        [SerializeField] private float _disabledValue = 0f;

        [Header("Variant Mapping")]
        [Tooltip("Map variant names to specific values")]
        [SerializeField] private List<VariantFloat> _variantMap = new List<VariantFloat>();

        [Serializable]
        public class VariantFloat
        {
            public string VariantName;
            public float Value;
        }

        private Rigidbody _rigidbody;
        private float _originalMass;
        private float _originalDrag;
        private float _originalAngularDrag;

        private void Awake()
        {
            _rigidbody = GetComponent<Rigidbody>();
            _originalMass = _rigidbody.mass;
            _originalDrag = _rigidbody.linearDamping;
            _originalAngularDrag = _rigidbody.angularDamping;
        }

        protected override void OnFlagChanged(FlagProxy flag)
        {
            if (flag == null || _rigidbody == null) return;

            switch (_mode)
            {
                case RigidbodyControlMode.ToggleGravity:
                    _rigidbody.useGravity = flag.Enabled;
                    break;

                case RigidbodyControlMode.ToggleKinematic:
                    _rigidbody.isKinematic = flag.Enabled;
                    break;

                case RigidbodyControlMode.Mass:
                    _rigidbody.mass = ResolveFloat(flag, _originalMass);
                    break;

                case RigidbodyControlMode.Drag:
                    _rigidbody.linearDamping = ResolveFloat(flag, _originalDrag);
                    break;

                case RigidbodyControlMode.AngularDrag:
                    _rigidbody.angularDamping = ResolveFloat(flag, _originalAngularDrag);
                    break;
            }
        }

        private float ResolveFloat(FlagProxy flag, float originalValue)
        {
            if (!flag.Enabled) return _disabledValue;

            // Variant name map takes priority
            var variantName = flag.Variant?.Name ?? "";
            foreach (var entry in _variantMap)
                if (entry.VariantName == variantName) return entry.Value;

            // Numeric variant value as fallback
            if (flag.Variant?.Value != null)
            {
                try { return Convert.ToSingle(flag.Variant.Value); } catch { }
            }

            return _enabledValue;
        }
    }
}
