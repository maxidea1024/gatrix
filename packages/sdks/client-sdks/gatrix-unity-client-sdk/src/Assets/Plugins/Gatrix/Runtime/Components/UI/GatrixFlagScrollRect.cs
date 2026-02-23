// GatrixFlagScrollRect - Control UI ScrollRect via feature flags
// Useful for toggling scroll behavior, adjusting scroll speed, or enabling pull-to-refresh

using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Controls a ScrollRect's enabled state, scroll sensitivity, and inertia
    /// based on a feature flag. Variant names map to specific sensitivity values.
    /// </summary>
    [AddComponentMenu("Gatrix/UI/Flag Scroll Rect")]
    [RequireComponent(typeof(ScrollRect))]
    public class GatrixFlagScrollRect : GatrixFlagComponentBase
    {
        public enum ScrollControlMode
        {
            ToggleEnabled,
            ScrollSensitivity,
            ToggleInertia,
            ToggleHorizontal,
            ToggleVertical
        }

        [Header("Scroll Control")]
        [SerializeField] private ScrollControlMode _mode = ScrollControlMode.ScrollSensitivity;

        [Header("Sensitivity Values")]
        [SerializeField] private float _enabledSensitivity = 1f;
        [SerializeField] private float _disabledSensitivity = 0f;
        [SerializeField] private List<VariantFloat> _sensitivityMap = new List<VariantFloat>();

        [System.Serializable]
        public class VariantFloat { public string VariantName; public float Sensitivity; }

        private ScrollRect _scrollRect;
        private float _originalSensitivity;

        private void Awake()
        {
            _scrollRect = GetComponent<ScrollRect>();
            _originalSensitivity = _scrollRect.scrollSensitivity;
        }

        protected override void OnFlagChanged(FlagProxy flag)
        {
            if (flag == null || _scrollRect == null) return;

            switch (_mode)
            {
                case ScrollControlMode.ToggleEnabled:
                    _scrollRect.enabled = flag.Enabled;
                    break;

                case ScrollControlMode.ScrollSensitivity:
                    _scrollRect.scrollSensitivity = ResolveSensitivity(flag);
                    break;

                case ScrollControlMode.ToggleInertia:
                    _scrollRect.inertia = flag.Enabled;
                    break;

                case ScrollControlMode.ToggleHorizontal:
                    _scrollRect.horizontal = flag.Enabled;
                    break;

                case ScrollControlMode.ToggleVertical:
                    _scrollRect.vertical = flag.Enabled;
                    break;
            }
        }

        private float ResolveSensitivity(FlagProxy flag)
        {
            if (!flag.Enabled) return _disabledSensitivity;
            var name = flag.Variant?.Name ?? "";
            foreach (var e in _sensitivityMap)
                if (e.VariantName == name) return e.Sensitivity;
            if (flag.Variant?.Value != null)
            {
                try { return Convert.ToSingle(flag.Variant.Value); } catch { }
            }
            return _enabledSensitivity;
        }
    }
}
