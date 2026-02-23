// GatrixFlagCollider - Enable or disable Collider components via feature flags
// Useful for toggling collision zones, invisible walls, or trigger areas

using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Enables or disables a Collider (or Collider2D) component based on a feature flag.
    /// Supports both 3D and 2D colliders; auto-detects if not assigned.
    /// </summary>
    [AddComponentMenu("Gatrix/Physics/Flag Collider")]
    public class GatrixFlagCollider : GatrixFlagComponentBase
    {
        [Header("Collider Control")]
        [Tooltip("3D Collider to control (auto-detected if null)")]
        [SerializeField] private Collider _collider;

        [Tooltip("2D Collider to control (auto-detected if null)")]
        [SerializeField] private Collider2D _collider2D;

        [Tooltip("Invert the enabled state from the flag")]
        [SerializeField] private bool _invert;

        private void Awake()
        {
            if (_collider == null) _collider = GetComponent<Collider>();
            if (_collider2D == null) _collider2D = GetComponent<Collider2D>();
        }

        protected override void OnFlagChanged(FlagProxy flag)
        {
            if (flag == null) return;

            bool enabled = flag.Enabled;
            if (_invert) enabled = !enabled;

            if (_collider != null) _collider.enabled = enabled;
            if (_collider2D != null) _collider2D.enabled = enabled;
        }
    }
}
