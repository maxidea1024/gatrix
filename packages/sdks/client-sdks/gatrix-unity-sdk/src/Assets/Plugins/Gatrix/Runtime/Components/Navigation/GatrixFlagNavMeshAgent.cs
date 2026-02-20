// GatrixFlagNavMeshAgent - Control NavMeshAgent properties via feature flags
// Supports variant-to-value mapping for A/B NPC behavior experiments

using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.AI;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Controls a NavMeshAgent's properties (enabled, speed, radius, stopping distance)
    /// based on a feature flag. Variant names map to specific values.
    /// </summary>
    [AddComponentMenu("Gatrix/Navigation/Flag NavMesh Agent")]
    [RequireComponent(typeof(NavMeshAgent))]
    public class GatrixFlagNavMeshAgent : GatrixFlagComponentBase
    {
        public enum NavMeshControlMode
        {
            ToggleEnabled,
            Speed,
            Radius,
            StoppingDistance,
            AngularSpeed
        }

        [Header("NavMeshAgent Control")]
        [SerializeField] private NavMeshControlMode _mode = NavMeshControlMode.ToggleEnabled;

        [Header("Fallback Values")]
        [Tooltip("Value when flag is enabled and no variant matches")]
        [SerializeField] private float _enabledValue = 3.5f;
        [Tooltip("Value when flag is disabled")]
        [SerializeField] private float _disabledValue = 0f;

        [Header("Variant Mapping")]
        [Tooltip("Map variant names to specific values")]
        [SerializeField] private List<VariantFloat> _variantMap = new List<VariantFloat>();

        [System.Serializable]
        public class VariantFloat
        {
            public string VariantName;
            public float Value;
        }

        private NavMeshAgent _agent;
        private float _originalSpeed;
        private float _originalRadius;
        private float _originalStoppingDistance;
        private float _originalAngularSpeed;

        private void Awake()
        {
            _agent = GetComponent<NavMeshAgent>();
            _originalSpeed = _agent.speed;
            _originalRadius = _agent.radius;
            _originalStoppingDistance = _agent.stoppingDistance;
            _originalAngularSpeed = _agent.angularSpeed;
        }

        protected override void OnFlagChanged(FlagProxy flag)
        {
            if (flag == null || _agent == null) return;

            switch (_mode)
            {
                case NavMeshControlMode.ToggleEnabled:
                    _agent.enabled = flag.Enabled;
                    break;

                case NavMeshControlMode.Speed:
                    _agent.speed = ResolveFloat(flag, _originalSpeed);
                    break;

                case NavMeshControlMode.Radius:
                    _agent.radius = ResolveFloat(flag, _originalRadius);
                    break;

                case NavMeshControlMode.StoppingDistance:
                    _agent.stoppingDistance = ResolveFloat(flag, _originalStoppingDistance);
                    break;

                case NavMeshControlMode.AngularSpeed:
                    _agent.angularSpeed = ResolveFloat(flag, _originalAngularSpeed);
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
