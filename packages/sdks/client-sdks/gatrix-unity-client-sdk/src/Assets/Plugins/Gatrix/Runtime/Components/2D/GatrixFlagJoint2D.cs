// GatrixFlagJoint2D - Enable/disable or adjust 2D Joint constraints via feature flags
// Useful for gating rope/chain mechanics, breakable joints, or puzzle elements

using System;
using System.Collections.Generic;
using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Controls a Joint2D component's enabled state and breaking force/torque
    /// based on a feature flag. Variant names map to specific breaking force values.
    /// </summary>
    [AddComponentMenu("Gatrix/2D/Flag Joint 2D")]
    [RequireComponent(typeof(Joint2D))]
    public class GatrixFlagJoint2D : GatrixFlagComponentBase
    {
        public enum JointControlMode
        {
            ToggleEnabled,
            BreakForce,
            BreakTorque
        }

        [Header("Joint Control")]
        [SerializeField] private JointControlMode _mode = JointControlMode.ToggleEnabled;

        [Header("Values")]
        [Tooltip("Value when flag is enabled and no variant matches")]
        [SerializeField] private float _enabledValue = Mathf.Infinity;
        [Tooltip("Value when flag is disabled (0 = immediately broken)")]
        [SerializeField] private float _disabledValue = 0f;

        [Header("Variant Mapping")]
        [SerializeField] private List<VariantFloat> _variantMap = new List<VariantFloat>();

        [System.Serializable]
        public class VariantFloat
        {
            public string VariantName;
            [Tooltip("Force value (Infinity = unbreakable)")]
            public float Value = Mathf.Infinity;
        }

        private Joint2D _joint;

        private void Awake()
        {
            _joint = GetComponent<Joint2D>();
        }

        protected override void OnFlagChanged(FlagProxy flag)
        {
            if (flag == null || _joint == null) return;

            switch (_mode)
            {
                case JointControlMode.ToggleEnabled:
                    _joint.enabled = flag.Enabled;
                    break;

                case JointControlMode.BreakForce:
                    _joint.breakForce = ResolveFloat(flag);
                    break;

                case JointControlMode.BreakTorque:
                    _joint.breakTorque = ResolveFloat(flag);
                    break;
            }
        }

        private float ResolveFloat(FlagProxy flag)
        {
            if (!flag.Enabled) return _disabledValue;
            var name = flag.Variant?.Name ?? "";
            foreach (var e in _variantMap)
                if (e.VariantName == name) return e.Value;
            if (flag.Variant?.Value != null)
            {
                try { return Convert.ToSingle(flag.Variant.Value); } catch { }
            }
            return _enabledValue;
        }
    }
}
