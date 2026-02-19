// GatrixFlagEvent - Fire UnityEvents based on feature flag state changes
// Connect any Unity method to flag state changes without code

using System;
using UnityEngine;
using UnityEngine.Events;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Fires UnityEvents when a feature flag changes state.
    /// Connect any component method to flag state changes via the Inspector.
    ///
    /// Usage:
    ///   1. Add this component to any GameObject
    ///   2. Set the Flag Name
    ///   3. Wire up UnityEvents (OnEnabled, OnDisabled, OnChanged)
    ///   4. Events fire automatically when flag state changes
    /// </summary>
    [AddComponentMenu("Gatrix/Flag Event")]
    public class GatrixFlagEvent : MonoBehaviour
    {
        [Header("Flag Configuration")]
        [Tooltip("The feature flag name to watch")]
        [GatrixFlagName]
        [SerializeField] private string _flagName;

        [Tooltip("Fire events on initial state (when component enables)")]
        [SerializeField] private bool _fireOnInitial = true;

        [Header("Events")]
        [Tooltip("Fired when the flag becomes enabled")]
        [SerializeField] private UnityEvent _onEnabled = new UnityEvent();

        [Tooltip("Fired when the flag becomes disabled")]
        [SerializeField] private UnityEvent _onDisabled = new UnityEvent();

        [Tooltip("Fired whenever the flag state changes (passes enabled state)")]
        [SerializeField] private BoolEvent _onChanged = new BoolEvent();

        [Tooltip("Fired whenever the variant changes (passes variant name)")]
        [SerializeField] private StringEvent _onVariantChanged = new StringEvent();

        private Action _unwatch;
        private bool? _lastEnabled;
        private string _lastVariant;

        [Serializable]
        public class BoolEvent : UnityEvent<bool> { }

        [Serializable]
        public class StringEvent : UnityEvent<string> { }

        /// <summary>Access to OnEnabled event for code-based wiring</summary>
        public UnityEvent OnFlagEnabled => _onEnabled;

        /// <summary>Access to OnDisabled event for code-based wiring</summary>
        public UnityEvent OnFlagDisabled => _onDisabled;

        /// <summary>Access to OnChanged event for code-based wiring</summary>
        public BoolEvent OnFlagChanged => _onChanged;

        /// <summary>Access to OnVariantChanged event for code-based wiring</summary>
        public StringEvent OnFlagVariantChanged => _onVariantChanged;

        public string FlagName
        {
            get => _flagName;
            set
            {
                if (_flagName == value) return;
                _flagName = value;
                _lastEnabled = null;
                _lastVariant = null;
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

            _unwatch = client.Features.WatchRealtimeFlagWithInitialState(_flagName, OnFlagChangedCallback,
                $"FlagEvent:{gameObject.name}");
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

        private void OnFlagChangedCallback(FlagProxy flag)
        {
            var isEnabled = flag.Enabled;
            var variantName = flag.Variant?.Name ?? "";

            bool isInitial = !_lastEnabled.HasValue;

            // Skip initial if not configured to fire on initial
            if (isInitial && !_fireOnInitial)
            {
                _lastEnabled = isEnabled;
                _lastVariant = variantName;
                return;
            }

            // Check if enabled state changed
            bool enabledChanged = !_lastEnabled.HasValue || _lastEnabled.Value != isEnabled;
            if (enabledChanged)
            {
                _onChanged?.Invoke(isEnabled);

                if (isEnabled)
                    _onEnabled?.Invoke();
                else
                    _onDisabled?.Invoke();
            }

            // Check if variant changed
            bool variantChanged = _lastVariant != variantName;
            if (variantChanged)
            {
                _onVariantChanged?.Invoke(variantName);
            }

            _lastEnabled = isEnabled;
            _lastVariant = variantName;
        }
    }
}
