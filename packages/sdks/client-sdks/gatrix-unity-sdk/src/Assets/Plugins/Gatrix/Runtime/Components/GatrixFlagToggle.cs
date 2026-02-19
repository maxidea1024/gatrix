// GatrixFlagToggle - Enable/disable GameObjects based on feature flag state
// Zero-code component: assign flag name and target objects in Inspector

using System;
using System.Collections.Generic;
using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Toggles target GameObjects based on a feature flag's enabled state.
    /// </summary>
    [AddComponentMenu("Gatrix/Flag Toggle")]
    public class GatrixFlagToggle : GatrixFlagComponentBase
    {
        [Header("Toggle Settings")]
        [Tooltip("Invert the flag logic (ON becomes OFF and vice versa)")]
        [SerializeField] private bool _invertLogic;

        [Header("Targets")]
        [Tooltip("GameObjects to activate when the flag is enabled (or disabled if inverted)")]
        [SerializeField] private List<GameObject> _whenEnabled = new List<GameObject>();

        [Tooltip("GameObjects to activate when the flag is disabled (or enabled if inverted)")]
        [SerializeField] private List<GameObject> _whenDisabled = new List<GameObject>();

        [Header("Self Control")]
        [Tooltip("Also control this GameObject's active state")]
        [SerializeField] private bool _controlSelf;

        [Tooltip("Which state activates this GameObject")]
        [SerializeField] private SelfActivation _selfActivation = SelfActivation.WhenEnabled;

        public enum SelfActivation
        {
            WhenEnabled,
            WhenDisabled
        }

        protected override void OnFlagChanged(FlagProxy flag)
        {
            if (flag == null) return;

            var isEnabled = flag.Enabled;
            if (_invertLogic) isEnabled = !isEnabled;

            ApplyState(isEnabled);
        }

        private void ApplyState(bool flagEnabled)
        {
            // Activate/deactivate "when enabled" targets
            foreach (var go in _whenEnabled)
            {
                if (go != null) go.SetActive(flagEnabled);
            }

            // Activate/deactivate "when disabled" targets
            foreach (var go in _whenDisabled)
            {
                if (go != null) go.SetActive(!flagEnabled);
            }

            // Self control
            if (_controlSelf)
            {
                var shouldBeActive = _selfActivation == SelfActivation.WhenEnabled
                    ? flagEnabled
                    : !flagEnabled;
                
                if (gameObject.activeSelf != shouldBeActive)
                {
                    gameObject.SetActive(shouldBeActive);
                }
            }
        }
    }
}
