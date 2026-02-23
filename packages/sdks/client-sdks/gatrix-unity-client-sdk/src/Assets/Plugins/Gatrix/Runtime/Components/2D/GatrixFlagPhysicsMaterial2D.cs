// GatrixFlagPhysicsMaterial2D - Swap PhysicsMaterial2D or adjust friction/bounciness via flags
// Useful for A/B testing slippery surfaces, bouncy platforms, or icy zones

using System;
using System.Collections.Generic;
using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Swaps a Collider2D's PhysicsMaterial2D or adjusts friction/bounciness
    /// based on a feature flag. Variant names map to specific materials or float values.
    /// </summary>
    [AddComponentMenu("Gatrix/2D/Flag Physics Material 2D")]
    [RequireComponent(typeof(Collider2D))]
    public class GatrixFlagPhysicsMaterial2D : GatrixFlagComponentBase
    {
        public enum PhysicsMatMode
        {
            SwapMaterial,
            Friction,
            Bounciness
        }

        [Header("Mode")]
        [SerializeField] private PhysicsMatMode _mode = PhysicsMatMode.SwapMaterial;

        [Header("Material Mapping")]
        [Tooltip("Material when flag is disabled")]
        [SerializeField] private PhysicsMaterial2D _defaultMaterial;
        [Tooltip("Map variant names to specific PhysicsMaterial2D assets")]
        [SerializeField] private List<VariantMaterial> _materialMap = new List<VariantMaterial>();

        [Header("Friction / Bounciness")]
        [SerializeField] private float _enabledValue = 0f;
        [SerializeField] private float _disabledValue = 0.4f;
        [SerializeField] private List<VariantFloat> _valueMap = new List<VariantFloat>();

        [System.Serializable] public class VariantMaterial { public string VariantName; public PhysicsMaterial2D Material; }
        [System.Serializable] public class VariantFloat { public string VariantName; public float Value; }

        private Collider2D _collider;
        private PhysicsMaterial2D _originalMaterial;

        private void Awake()
        {
            _collider = GetComponent<Collider2D>();
            _originalMaterial = _collider.sharedMaterial;
        }

        protected override void OnFlagChanged(FlagProxy flag)
        {
            if (flag == null || _collider == null) return;

            switch (_mode)
            {
                case PhysicsMatMode.SwapMaterial:
                    if (!flag.Enabled)
                    {
                        _collider.sharedMaterial = _defaultMaterial ?? _originalMaterial;
                        return;
                    }
                    var variantName = flag.Variant?.Name ?? "";
                    PhysicsMaterial2D resolved = _defaultMaterial;
                    foreach (var e in _materialMap)
                        if (e.VariantName == variantName) { resolved = e.Material; break; }
                    _collider.sharedMaterial = resolved ?? _originalMaterial;
                    break;

                case PhysicsMatMode.Friction:
                    float friction = ResolveFloat(flag);
                    if (_collider.sharedMaterial != null)
                        _collider.sharedMaterial.friction = friction;
                    break;

                case PhysicsMatMode.Bounciness:
                    float bounce = ResolveFloat(flag);
                    if (_collider.sharedMaterial != null)
                        _collider.sharedMaterial.bounciness = bounce;
                    break;
            }
        }

        private float ResolveFloat(FlagProxy flag)
        {
            if (!flag.Enabled) return _disabledValue;
            var name = flag.Variant?.Name ?? "";
            foreach (var e in _valueMap)
                if (e.VariantName == name) return e.Value;
            if (flag.Variant?.Value != null)
            {
                try { return Convert.ToSingle(flag.Variant.Value); } catch { }
            }
            return _enabledValue;
        }
    }
}
