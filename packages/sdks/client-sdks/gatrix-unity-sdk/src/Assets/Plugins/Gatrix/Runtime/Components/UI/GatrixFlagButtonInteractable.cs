// GatrixFlagButtonInteractable - Control Button interactable state via feature flags
// Useful for gating buttons behind feature flags (e.g., new checkout flow, premium feature)

using UnityEngine;
using UnityEngine.UI;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Controls a Button's interactable state based on a feature flag.
    /// When the flag is disabled, the button becomes non-interactable (grayed out).
    /// </summary>
    [AddComponentMenu("Gatrix/UI/Flag Button Interactable")]
    [RequireComponent(typeof(Button))]
    public class GatrixFlagButtonInteractable : GatrixFlagComponentBase
    {
        [Header("Button Control")]
        [Tooltip("Invert the flag state (disabled flag = button enabled)")]
        [SerializeField] private bool _invert;

        private Button _button;

        private void Awake()
        {
            _button = GetComponent<Button>();
        }

        protected override void OnFlagChanged(FlagProxy flag)
        {
            if (flag == null || _button == null) return;

            bool interactable = flag.Enabled;
            if (_invert) interactable = !interactable;

            _button.interactable = interactable;
        }
    }
}
