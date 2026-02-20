// GatrixFlagAudioSource - Control AudioSource properties via feature flags
// More granular than GatrixFlagAudio (clip/play) — controls volume, pitch, etc.

using System;
using System.Collections.Generic;
using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Controls an AudioSource's volume, pitch, spatial blend, or mute state
    /// based on a feature flag. Variant names map to specific float values.
    /// </summary>
    [AddComponentMenu("Gatrix/Audio/Flag Audio Source")]
    [RequireComponent(typeof(AudioSource))]
    public class GatrixFlagAudioSource : GatrixFlagComponentBase
    {
        public enum AudioSourceControlMode
        {
            Mute,
            Volume,
            Pitch,
            SpatialBlend,
            Priority
        }

        [Header("AudioSource Control")]
        [SerializeField] private AudioSourceControlMode _mode = AudioSourceControlMode.Volume;

        [Header("Values")]
        [SerializeField] private float _enabledValue = 1f;
        [SerializeField] private float _disabledValue = 0f;

        [Header("Variant Mapping")]
        [SerializeField] private List<VariantFloat> _variantMap = new List<VariantFloat>();

        [System.Serializable]
        public class VariantFloat { public string VariantName; public float Value; }

        private AudioSource _audioSource;
        private float _originalVolume;
        private float _originalPitch;
        private float _originalSpatialBlend;
        private int   _originalPriority;
        private bool  _originalMute;

        private void Awake()
        {
            _audioSource         = GetComponent<AudioSource>();
            _originalVolume      = _audioSource.volume;
            _originalPitch       = _audioSource.pitch;
            _originalSpatialBlend = _audioSource.spatialBlend;
            _originalPriority    = _audioSource.priority;
            _originalMute        = _audioSource.mute;
        }

        protected override void OnFlagChanged(FlagProxy flag)
        {
            if (flag == null || _audioSource == null) return;

            switch (_mode)
            {
                case AudioSourceControlMode.Mute:
                    _audioSource.mute = !flag.Enabled;
                    break;

                case AudioSourceControlMode.Volume:
                    _audioSource.volume = ResolveFloat(flag, _originalVolume);
                    break;

                case AudioSourceControlMode.Pitch:
                    _audioSource.pitch = ResolveFloat(flag, _originalPitch);
                    break;

                case AudioSourceControlMode.SpatialBlend:
                    _audioSource.spatialBlend = ResolveFloat(flag, _originalSpatialBlend);
                    break;

                case AudioSourceControlMode.Priority:
                    _audioSource.priority = (int)ResolveFloat(flag, _originalPriority);
                    break;
            }
        }

        private float ResolveFloat(FlagProxy flag, float original)
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
