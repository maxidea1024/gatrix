// GatrixFlagParticles - Control ParticleSystem based on feature flag state
// Useful for enabling special effects, seasonal particles, or A/B testing visual feedback

using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Controls a ParticleSystem based on a feature flag's state.
    /// Can play, stop, or pause particles when the flag changes.
    /// </summary>
    [AddComponentMenu("Gatrix/Flag Particles")]
    [RequireComponent(typeof(ParticleSystem))]
    public class GatrixFlagParticles : GatrixFlagComponentBase
    {
        [Header("Particle Behavior")]
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

        private void Awake()
        {
            _particles = GetComponent<ParticleSystem>();
        }

        protected override void OnFlagChanged(FlagProxy flag)
        {
            if (flag == null || _particles == null) return;

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
