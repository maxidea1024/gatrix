// GatrixFlagToggle - Enable/disable GameObjects based on feature flag state
// Zero-code component: assign flag name and target objects in Inspector

using System;
using System.Collections.Generic;
using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Toggles target GameObjects based on a feature flag's enabled state.
    /// Automatically watches for flag changes and updates in real-time.
    ///
    /// Usage:
    ///   1. Add this component to any GameObject
    ///   2. Set the Flag Name
    ///   3. Assign GameObjects to "When Enabled" and/or "When Disabled" lists
    ///   4. Objects activate/deactivate automatically based on flag state
    /// </summary>
    [AddComponentMenu("Gatrix/Flag Toggle")]
    public class GatrixFlagToggle : MonoBehaviour
    {
        [Header("Flag Configuration")]
        [Tooltip("The feature flag name to watch")]
        [GatrixFlagName]
        [SerializeField] private string _flagName;

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

        private Action _unwatch;
        private bool _lastKnownState;

        public enum SelfActivation
        {
            WhenEnabled,
            WhenDisabled
        }

        /// <summary>Current flag name</summary>
        public string FlagName
        {
            get => _flagName;
            set
            {
                if (_flagName == value) return;
                _flagName = value;
                Resubscribe();
            }
        }

        private void OnEnable()
        {
            Subscribe();
        }

        private void OnDisable()
        {
            Unsubscribe();
        }

        private void Subscribe()
        {
            if (string.IsNullOrEmpty(_flagName)) return;

            var client = GatrixBehaviour.Client;
            if (client == null) return;

            _unwatch = client.Features.WatchFlagWithInitialState(_flagName, OnFlagChanged,
                $"FlagToggle:{gameObject.name}");
        }

        private void Unsubscribe()
        {
            _unwatch?.Invoke();
            _unwatch = null;
        }

        private void Resubscribe()
        {
            Unsubscribe();
            if (isActiveAndEnabled) Subscribe();
        }

        private void OnFlagChanged(FlagProxy flag)
        {
            var isEnabled = flag.Enabled;
            if (_invertLogic) isEnabled = !isEnabled;

            _lastKnownState = isEnabled;
            ApplyState(isEnabled);
        }

        private void ApplyState(bool flagEnabled)
        {
            // Activate/deactivate "when enabled" targets
            for (int i = 0; i < _whenEnabled.Count; i++)
            {
                if (_whenEnabled[i] != null)
                    _whenEnabled[i].SetActive(flagEnabled);
            }

            // Activate/deactivate "when disabled" targets
            for (int i = 0; i < _whenDisabled.Count; i++)
            {
                if (_whenDisabled[i] != null)
                    _whenDisabled[i].SetActive(!flagEnabled);
            }

            // Self control
            if (_controlSelf)
            {
                var shouldBeActive = _selfActivation == SelfActivation.WhenEnabled
                    ? flagEnabled
                    : !flagEnabled;
                gameObject.SetActive(shouldBeActive);
            }
        }
    }
}
