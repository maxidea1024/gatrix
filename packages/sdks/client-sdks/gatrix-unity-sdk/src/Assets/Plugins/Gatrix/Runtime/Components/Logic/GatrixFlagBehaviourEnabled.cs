// GatrixFlagBehaviourEnabled - Toggle any MonoBehaviour.enabled via feature flags
// More targeted than GatrixFlagToggle (GameObject active) — controls specific components

using System.Collections.Generic;
using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Enables or disables a list of MonoBehaviour components based on a feature flag.
    /// Unlike GatrixFlagToggle (which controls GameObject.activeSelf), this togles
    /// individual component enabled states, leaving the GameObject active.
    /// </summary>
    [AddComponentMenu("Gatrix/Logic/Flag Behaviour Enabled")]
    public class GatrixFlagBehaviourEnabled : GatrixFlagComponentBase
    {
        [Header("Target Behaviours")]
        [Tooltip("Components to enable when flag is ON, disable when flag is OFF")]
        [SerializeField] private List<Behaviour> _enableTargets = new List<Behaviour>();

        [Tooltip("Components to disable when flag is ON, enable when flag is OFF (inverse)")]
        [SerializeField] private List<Behaviour> _disableTargets = new List<Behaviour>();

        protected override void OnFlagChanged(FlagProxy flag)
        {
            if (flag == null) return;

            foreach (var b in _enableTargets)
            {
                if (b != null) b.enabled = flag.Enabled;
            }

            foreach (var b in _disableTargets)
            {
                if (b != null) b.enabled = !flag.Enabled;
            }
        }
    }
}
