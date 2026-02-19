// GatrixFlagCanvas - Show/hide entire Canvas groups based on feature flag state
// Useful for feature gating entire UI panels, overlays, or HUD elements

using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Controls a CanvasGroup's visibility and interactability based on a feature flag.
    /// More powerful than GatrixFlagToggle for UI because it supports alpha fading
    /// and can disable raycasting without hiding the element.
    ///
    /// Usage:
    ///   1. Add this component to a GameObject with a CanvasGroup
    ///   2. Set the Flag Name
    ///   3. Configure alpha and interactable settings for each state
    /// </summary>
    [AddComponentMenu("Gatrix/Flag Canvas")]
    [RequireComponent(typeof(CanvasGroup))]
    public class GatrixFlagCanvas : MonoBehaviour
    {
        [Header("Flag Configuration")]
        [Tooltip("The feature flag name to watch")]
        [GatrixFlagName]
        [SerializeField] private string _flagName;

        [Header("Enabled State")]
        [SerializeField] private float _enabledAlpha = 1f;
        [SerializeField] private bool _enabledInteractable = true;
        [SerializeField] private bool _enabledBlocksRaycasts = true;

        [Header("Disabled State")]
        [SerializeField] private float _disabledAlpha = 0f;
        [SerializeField] private bool _disabledInteractable = false;
        [SerializeField] private bool _disabledBlocksRaycasts = false;

        [Header("Transition")]
        [Tooltip("Smoothly fade between states")]
        [SerializeField] private bool _animate = true;

        [Tooltip("Fade speed (higher = faster)")]
        [SerializeField] private float _fadeSpeed = 4f;

        private CanvasGroup _canvasGroup;
        private System.Action _unwatch;
        private float _targetAlpha;
        private bool _targetInteractable;
        private bool _targetBlocksRaycasts;

        private void Awake()
        {
            _canvasGroup = GetComponent<CanvasGroup>();
            _targetAlpha = _canvasGroup.alpha;
        }

        private void OnEnable()
        {
            if (string.IsNullOrEmpty(_flagName)) return;
            var client = GatrixBehaviour.Client;
            if (client == null) return;

            _unwatch = client.Features.WatchRealtimeFlagWithInitialState(_flagName, OnFlagChanged,
                $"FlagCanvas:{gameObject.name}");
        }

        private void OnDisable()
        {
            _unwatch?.Invoke();
            _unwatch = null;
        }

        private void Update()
        {
            if (!_animate || _canvasGroup == null) return;

            _canvasGroup.alpha = Mathf.Lerp(_canvasGroup.alpha, _targetAlpha, Time.deltaTime * _fadeSpeed);
        }

        private void OnFlagChanged(FlagProxy flag)
        {
            if (_canvasGroup == null) return;

            if (flag.Enabled)
            {
                _targetAlpha = _enabledAlpha;
                _canvasGroup.interactable = _enabledInteractable;
                _canvasGroup.blocksRaycasts = _enabledBlocksRaycasts;
            }
            else
            {
                _targetAlpha = _disabledAlpha;
                _canvasGroup.interactable = _disabledInteractable;
                _canvasGroup.blocksRaycasts = _disabledBlocksRaycasts;
            }

            if (!_animate)
            {
                _canvasGroup.alpha = _targetAlpha;
            }
        }
    }
}
