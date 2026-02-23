// GatrixFlagDetectionRange - Control AI detection sphere/circle range via feature flags
// Useful for toggling stealth mechanics, alert radiuses, or threat detection systems

using System;
using System.Collections.Generic;
using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Exposes configurable detection range and angle values controlled by feature flags.
    /// Other scripts read DetectionRange and DetectionAngle at runtime.
    /// Variant names map to specific range/angle presets.
    /// </summary>
    [AddComponentMenu("Gatrix/AI/Flag Detection Range")]
    public class GatrixFlagDetectionRange : GatrixFlagComponentBase
    {
        [Header("Detection Range")]
        [Tooltip("Detection radius when flag is enabled and no variant matches")]
        [SerializeField] private float _enabledRange = 10f;
        [Tooltip("Detection radius when flag is disabled")]
        [SerializeField] private float _disabledRange = 0f;

        [Header("Detection Angle (degrees)")]
        [SerializeField] private float _enabledAngle = 90f;
        [SerializeField] private float _disabledAngle = 0f;

        [Header("Gizmo")]
        [Tooltip("Visualize detection range in Scene view")]
        [SerializeField] private Color _gizmoColor = new Color(1f, 0.3f, 0.3f, 0.3f);

        [Header("Variant Mapping")]
        [Tooltip("Map variant names to detection range presets")]
        [SerializeField] private List<VariantPreset> _variantMap = new List<VariantPreset>();

        [System.Serializable]
        public class VariantPreset
        {
            public string VariantName;
            public float Range = 10f;
            public float Angle = 90f;
        }

        /// <summary>Current detection radius in world units.</summary>
        public float DetectionRange { get; private set; }

        /// <summary>Current detection half-angle in degrees.</summary>
        public float DetectionAngle { get; private set; }

        /// <summary>Whether detection is currently active.</summary>
        public bool IsActive { get; private set; }

        private void Awake()
        {
            DetectionRange = _enabledRange;
            DetectionAngle = _enabledAngle;
            IsActive = false;
        }

        protected override void OnFlagChanged(FlagProxy flag)
        {
            if (flag == null) return;

            if (!flag.Enabled)
            {
                DetectionRange = _disabledRange;
                DetectionAngle = _disabledAngle;
                IsActive = false;
                return;
            }

            IsActive = true;

            // Variant preset map
            var variantName = flag.Variant?.Name ?? "";
            foreach (var entry in _variantMap)
            {
                if (entry.VariantName == variantName)
                {
                    DetectionRange = entry.Range;
                    DetectionAngle = entry.Angle;
                    return;
                }
            }

            // Numeric variant value → range only
            if (flag.Variant?.Value != null)
            {
                try { DetectionRange = Convert.ToSingle(flag.Variant.Value); return; } catch { }
            }

            DetectionRange = _enabledRange;
            DetectionAngle = _enabledAngle;
        }

        /// <summary>
        /// Returns true if the target transform is within detection range and angle.
        /// </summary>
        public bool CanDetect(Transform target)
        {
            if (!IsActive || target == null) return false;
            Vector3 dir = target.position - transform.position;
            if (dir.magnitude > DetectionRange) return false;
            if (DetectionAngle < 360f)
            {
                float angle = Vector3.Angle(transform.forward, dir);
                if (angle > DetectionAngle * 0.5f) return false;
            }
            return true;
        }

        private void OnDrawGizmosSelected()
        {
            Gizmos.color = _gizmoColor;
            Gizmos.DrawWireSphere(transform.position, DetectionRange > 0 ? DetectionRange : _enabledRange);
        }
    }
}
