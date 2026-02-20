// GatrixFlagEffector2D - Control Physics Effector2D (AreaEffector2D etc.) via feature flags
// Useful for toggling wind zones, force fields, or buoyancy areas

using System;
using System.Collections.Generic;
using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Controls a 2D physics Effector's enabled state and force magnitude
    /// based on a feature flag. Supports AreaEffector2D, PointEffector2D, etc.
    /// Variant names map to specific force values.
    /// </summary>
    [AddComponentMenu("Gatrix/2D/Flag Effector 2D")]
    public class GatrixFlagEffector2D : GatrixFlagComponentBase
    {
        public enum EffectorControlMode
        {
            ToggleEnabled,
            ForceMagnitude
        }

        [Header("Effector Control")]
        [SerializeField] private EffectorControlMode _mode = EffectorControlMode.ToggleEnabled;

        [Header("Force Magnitude (AreaEffector2D / PointEffector2D)")]
        [SerializeField] private float _enabledForce = 10f;
        [SerializeField] private float _disabledForce = 0f;
        [SerializeField] private List<VariantFloat> _variantMap = new List<VariantFloat>();

        [System.Serializable]
        public class VariantFloat { public string VariantName; public float Force; }

        private Effector2D _effector;
        private AreaEffector2D _areaEffector;
        private PointEffector2D _pointEffector;

        private void Awake()
        {
            _effector = GetComponent<Effector2D>();
            _areaEffector = GetComponent<AreaEffector2D>();
            _pointEffector = GetComponent<PointEffector2D>();
        }

        protected override void OnFlagChanged(FlagProxy flag)
        {
            if (flag == null) return;

            switch (_mode)
            {
                case EffectorControlMode.ToggleEnabled:
                    if (_effector != null) _effector.enabled = flag.Enabled;
                    break;

                case EffectorControlMode.ForceMagnitude:
                    float force = ResolveFloat(flag);
                    if (_areaEffector != null) _areaEffector.forceMagnitude = force;
                    else if (_pointEffector != null) _pointEffector.forceMagnitude = force;
                    break;
            }
        }

        private float ResolveFloat(FlagProxy flag)
        {
            if (!flag.Enabled) return _disabledForce;
            var name = flag.Variant?.Name ?? "";
            foreach (var e in _variantMap)
                if (e.VariantName == name) return e.Force;
            if (flag.Variant?.Value != null)
            {
                try { return Convert.ToSingle(flag.Variant.Value); } catch { }
            }
            return _enabledForce;
        }
    }
}
