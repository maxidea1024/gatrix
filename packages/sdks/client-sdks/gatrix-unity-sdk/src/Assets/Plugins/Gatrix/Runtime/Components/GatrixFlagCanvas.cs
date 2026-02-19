// GatrixFlagCanvas - Show/hide entire Canvas groups based on feature flag state
// Useful for feature gating entire UI panels, overlays, or HUD elements

using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Controls a CanvasGroup's visibility and interactability based on a feature flag.
    /// Supports alpha fading and can disable raycasting without hiding the element.
    /// </summary>
    [AddComponentMenu("Gatrix/Flag Canvas")]
    [RequireComponent(typeof(CanvasGroup))]
    public class GatrixFlagCanvas : GatrixFlagComponentBase
    {
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
        private float _targetAlpha;

        private void Awake()
        {
            _canvasGroup = GetComponent<CanvasGroup>();
            _targetAlpha = _canvasGroup.alpha;
        }

        protected override void OnFlagChanged(FlagProxy flag)
        {
            if (flag == null || _canvasGroup == null) return;

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

        private void Update()
        {
            if (!_animate || _canvasGroup == null) return;

            if (Mathf.Abs(_canvasGroup.alpha - _targetAlpha) > 0.001f)
            {
                _canvasGroup.alpha = Mathf.Lerp(_canvasGroup.alpha, _targetAlpha, Time.deltaTime * _fadeSpeed);
            }
        }
    }
}
