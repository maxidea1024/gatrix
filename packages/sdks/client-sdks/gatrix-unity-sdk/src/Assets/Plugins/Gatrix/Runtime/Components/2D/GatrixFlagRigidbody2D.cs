// GatrixFlagRigidbody2D - Control Rigidbody2D properties via feature flags
// Supports variant-to-value mapping for A/B 2D physics experiments

using System;
using System.Collections.Generic;
using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Controls a Rigidbody2D's physics properties (gravity scale, mass, drag, body type)
    /// based on a feature flag. Variant names map to specific values.
    /// </summary>
    [AddComponentMenu("Gatrix/2D/Flag Rigidbody 2D")]
    [RequireComponent(typeof(Rigidbody2D))]
    public class GatrixFlagRigidbody2D : GatrixFlagComponentBase
    {
        public enum Rigidbody2DControlMode
        {
            ToggleSimulated,
            GravityScale,
            Mass,
            LinearDrag,
            AngularDrag,
            BodyType
        }

        [Header("Rigidbody2D Control")]
        [SerializeField] private Rigidbody2DControlMode _mode = Rigidbody2DControlMode.GravityScale;

        [Header("Fallback Values")]
        [Tooltip("Value when flag is enabled and no variant matches")]
        [SerializeField] private float _enabledValue = 1f;
        [Tooltip("Value when flag is disabled")]
        [SerializeField] private float _disabledValue = 0f;

        [Header("Body Type (for BodyType mode)")]
        [SerializeField] private RigidbodyType2D _enabledBodyType = RigidbodyType2D.Dynamic;
        [SerializeField] private RigidbodyType2D _disabledBodyType = RigidbodyType2D.Static;

        [Header("Variant Mapping")]
        [Tooltip("Map variant names to specific float values")]
        [SerializeField] private List<VariantFloat> _variantMap = new List<VariantFloat>();

        [System.Serializable]
        public class VariantFloat
        {
            public string VariantName;
            public float Value;
        }

        private Rigidbody2D _rigidbody;
        private float _originalGravity;
        private float _originalMass;
        private float _originalLinearDrag;
        private float _originalAngularDrag;
        private RigidbodyType2D _originalBodyType;

        private void Awake()
        {
            _rigidbody = GetComponent<Rigidbody2D>();
            _originalGravity = _rigidbody.gravityScale;
            _originalMass = _rigidbody.mass;
            _originalLinearDrag = _rigidbody.linearDamping;
            _originalAngularDrag = _rigidbody.angularDamping;
            _originalBodyType = _rigidbody.bodyType;
        }

        protected override void OnFlagChanged(FlagProxy flag)
        {
            if (flag == null || _rigidbody == null) return;

            switch (_mode)
            {
                case Rigidbody2DControlMode.ToggleSimulated:
                    _rigidbody.simulated = flag.Enabled;
                    break;

                case Rigidbody2DControlMode.GravityScale:
                    _rigidbody.gravityScale = ResolveFloat(flag, _originalGravity);
                    break;

                case Rigidbody2DControlMode.Mass:
                    _rigidbody.mass = ResolveFloat(flag, _originalMass);
                    break;

                case Rigidbody2DControlMode.LinearDrag:
                    _rigidbody.linearDamping = ResolveFloat(flag, _originalLinearDrag);
                    break;

                case Rigidbody2DControlMode.AngularDrag:
                    _rigidbody.angularDamping = ResolveFloat(flag, _originalAngularDrag);
                    break;

                case Rigidbody2DControlMode.BodyType:
                    _rigidbody.bodyType = flag.Enabled ? _enabledBodyType : _disabledBodyType;
                    break;
            }
        }

        private float ResolveFloat(FlagProxy flag, float originalValue)
        {
            if (!flag.Enabled) return _disabledValue;
            var variantName = flag.Variant?.Name ?? "";
            foreach (var entry in _variantMap)
                if (entry.VariantName == variantName) return entry.Value;
            if (flag.Variant?.Value != null)
            {
                try { return Convert.ToSingle(flag.Variant.Value); } catch { }
            }
            return _enabledValue;
        }
    }
}
