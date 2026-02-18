// GatrixFlagParticles - Control ParticleSystem based on feature flag state
// Useful for enabling special effects, seasonal particles, or A/B testing visual feedback

using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Controls a ParticleSystem based on a feature flag's state.
    /// Can play, stop, or pause particles when the flag changes.
    ///
    /// Usage:
    ///   1. Add this component to a GameObject with a ParticleSystem
    ///   2. Set the Flag Name
    ///   3. Configure the play/stop behavior
    /// </summary>
    [AddComponentMenu("Gatrix/Flag Particles")]
    [RequireComponent(typeof(ParticleSystem))]
    public class GatrixFlagParticles : MonoBehaviour
    {
        [Header("Flag Configuration")]
        [Tooltip("The feature flag name to watch")]
        [GatrixFlagName]
        [SerializeField] private string _flagName;

        [Header("Behavior")]
        [Tooltip("Action when flag is enabled")]
        [SerializeField] private ParticleAction _onEnabled = ParticleAction.Play;

        [Tooltip("Action when flag is disabled")]
        [SerializeField] private ParticleAction _onDisabled = ParticleAction.Stop;

        [Tooltip("Include child particle systems")]
        [SerializeField] private bool _withChildren = true;

        public enum ParticleAction
        {
            Play,
            Stop,
            Pause,
            None
        }

        private ParticleSystem _particles;
        private System.Action _unwatch;

        private void Awake()
        {
            _particles = GetComponent<ParticleSystem>();
        }

        private void OnEnable()
        {
            if (string.IsNullOrEmpty(_flagName)) return;
            var client = GatrixBehaviour.Client;
            if (client == null) return;

            _unwatch = client.Features.WatchFlagWithInitialState(_flagName, OnFlagChanged,
                $"FlagParticles:{gameObject.name}");
        }

        private void OnDisable()
        {
            _unwatch?.Invoke();
            _unwatch = null;
        }

        private void OnFlagChanged(FlagProxy flag)
        {
            if (_particles == null) return;

            var action = flag.Enabled ? _onEnabled : _onDisabled;
            ApplyAction(action);
        }

        private void ApplyAction(ParticleAction action)
        {
            switch (action)
            {
                case ParticleAction.Play:
                    _particles.Play(_withChildren);
                    break;
                case ParticleAction.Stop:
                    _particles.Stop(_withChildren);
                    break;
                case ParticleAction.Pause:
                    _particles.Pause(_withChildren);
                    break;
                case ParticleAction.None:
                    break;
            }
        }
    }
}
