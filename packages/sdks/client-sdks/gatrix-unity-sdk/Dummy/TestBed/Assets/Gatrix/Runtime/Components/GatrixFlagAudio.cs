// GatrixFlagAudio - Play different AudioClips based on feature flag state or variant
// Useful for A/B testing sound effects, seasonal music, or gradual audio rollouts

using System.Collections.Generic;
using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Plays AudioClips based on a feature flag's state or variant name.
    /// Useful for A/B testing audio, seasonal events, or gradual audio rollouts.
    ///
    /// Usage:
    ///   1. Add this component to a GameObject with an AudioSource
    ///   2. Set the Flag Name
    ///   3. Assign AudioClips for each variant or the enabled/disabled states
    ///   4. Audio plays automatically when the flag changes
    /// </summary>
    [AddComponentMenu("Gatrix/Flag Audio")]
    [RequireComponent(typeof(AudioSource))]
    public class GatrixFlagAudio : MonoBehaviour
    {
        [Header("Flag Configuration")]
        [Tooltip("The feature flag name to watch")]
        [GatrixFlagName]
        [SerializeField] private string _flagName;

        [Header("Playback Mode")]
        [Tooltip("How to determine which clip to play")]
        [SerializeField] private AudioMode _mode = AudioMode.ByVariant;

        [Header("State Clips")]
        [Tooltip("Clip to play when flag is enabled")]
        [SerializeField] private AudioClip _enabledClip;

        [Tooltip("Clip to play when flag is disabled")]
        [SerializeField] private AudioClip _disabledClip;

        [Header("Variant Clips")]
        [Tooltip("Map variant names to AudioClips")]
        [SerializeField] private List<VariantAudioEntry> _variantClips = new List<VariantAudioEntry>();

        [Header("Options")]
        [Tooltip("Play the clip on flag change (vs. just switching the assigned clip)")]
        [SerializeField] private bool _playOnChange = true;

        [Tooltip("Loop the assigned clip")]
        [SerializeField] private bool _loop = false;

        [Tooltip("Volume multiplier")]
        [Range(0f, 1f)]
        [SerializeField] private float _volume = 1f;

        private AudioSource _audioSource;
        private System.Action _unwatch;

        public enum AudioMode
        {
            ByState,    // Play enabledClip / disabledClip based on flag state
            ByVariant,  // Play clip mapped to variant name
        }

        [System.Serializable]
        public class VariantAudioEntry
        {
            public string VariantName;
            public AudioClip Clip;
        }

        private void Awake()
        {
            _audioSource = GetComponent<AudioSource>();
        }

        private void OnEnable()
        {
            if (string.IsNullOrEmpty(_flagName)) return;
            var client = GatrixBehaviour.Client;
            if (client == null) return;

            _unwatch = client.Features.WatchFlagWithInitialState(_flagName, OnFlagChanged,
                $"FlagAudio:{gameObject.name}");
        }

        private void OnDisable()
        {
            _unwatch?.Invoke();
            _unwatch = null;
        }

        private void OnFlagChanged(FlagProxy flag)
        {
            AudioClip clip = null;

            if (_mode == AudioMode.ByState)
            {
                clip = flag.Enabled ? _enabledClip : _disabledClip;
            }
            else
            {
                var variantName = flag.Variant?.Name ?? "";
                foreach (var entry in _variantClips)
                {
                    if (entry.VariantName == variantName)
                    {
                        clip = entry.Clip;
                        break;
                    }
                }
            }

            if (clip == null) return;

            _audioSource.clip = clip;
            _audioSource.loop = _loop;
            _audioSource.volume = _volume;

            if (_playOnChange)
            {
                _audioSource.Play();
            }
        }
    }
}
