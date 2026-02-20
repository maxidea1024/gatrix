// GatrixFlagAudioMixer - Control AudioMixer exposed parameters via feature flags
// Useful for A/B testing music volumes, reverb levels, or sound effect intensities

using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Audio;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Sets an AudioMixer's exposed parameter value based on a feature flag.
    /// Variant names map to specific dB/float values.
    /// </summary>
    [AddComponentMenu("Gatrix/Audio/Flag Audio Mixer")]
    public class GatrixFlagAudioMixer : GatrixFlagComponentBase
    {
        [Header("Audio Mixer")]
        [Tooltip("Target AudioMixer asset")]
        [SerializeField] private AudioMixer _mixer;

        [Tooltip("Exposed parameter name in the AudioMixer (set via Expose in Mixer Inspector)")]
        [SerializeField] private string _parameterName = "MasterVolume";

        [Header("Values")]
        [Tooltip("Parameter value when flag is enabled and no variant matches")]
        [SerializeField] private float _enabledValue = 0f;       // 0 dB
        [Tooltip("Parameter value when flag is disabled")]
        [SerializeField] private float _disabledValue = -80f;    // -80 dB (silence)

        [Header("Transition")]
        [SerializeField] private bool _animate = true;
        [SerializeField] private float _lerpSpeed = 5f;

        [Header("Variant Mapping")]
        [Tooltip("Map variant names to specific AudioMixer parameter values")]
        [SerializeField] private List<VariantFloat> _variantMap = new List<VariantFloat>();

        [System.Serializable]
        public class VariantFloat
        {
            public string VariantName;
            [Tooltip("Value in dB for volume parameters, or raw float for others")]
            public float Value = 0f;
        }

        private float _targetValue;
        private float _originalValue;

        private void Awake()
        {
            if (_mixer != null && !string.IsNullOrEmpty(_parameterName))
                _mixer.GetFloat(_parameterName, out _originalValue);
            _targetValue = _originalValue;
        }

        protected override void OnFlagChanged(FlagProxy flag)
        {
            if (flag == null || _mixer == null || string.IsNullOrEmpty(_parameterName)) return;

            _targetValue = ResolveFloat(flag);

            if (!_animate)
                _mixer.SetFloat(_parameterName, _targetValue);
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

        private void Update()
        {
            if (!_animate || _mixer == null || string.IsNullOrEmpty(_parameterName)) return;

            _mixer.GetFloat(_parameterName, out float current);
            float next = Mathf.Lerp(current, _targetValue, Time.deltaTime * _lerpSpeed);
            _mixer.SetFloat(_parameterName, next);
        }

        private void OnDestroy()
        {
            if (_mixer != null && !string.IsNullOrEmpty(_parameterName))
                _mixer.SetFloat(_parameterName, _originalValue);
        }
    }
}
