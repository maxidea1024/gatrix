// GatrixFlagWindZone - Control WindZone properties via feature flags
// Useful for toggling dynamic wind effects, storm events, or weather A/B testing

using System;
using System.Collections.Generic;
using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Controls a WindZone's enabled state, wind main, and turbulence
    /// based on a feature flag. Variant names map to specific wind presets.
    /// </summary>
    [AddComponentMenu("Gatrix/Environment/Flag Wind Zone")]
    [RequireComponent(typeof(WindZone))]
    public class GatrixFlagWindZone : GatrixFlagComponentBase
    {
        public enum WindControlMode
        {
            ToggleEnabled,
            WindMain,
            WindTurbulence,
            Preset
        }

        [Header("Wind Control")]
        [SerializeField] private WindControlMode _mode = WindControlMode.WindMain;

        [Header("Float Values")]
        [SerializeField] private float _enabledValue = 1f;
        [SerializeField] private float _disabledValue = 0f;
        [SerializeField] private List<VariantFloat> _floatMap = new List<VariantFloat>();

        [Header("Preset (sets both Main + Turbulence)")]
        [SerializeField] private List<VariantPreset> _presetMap = new List<VariantPreset>();

        [System.Serializable] public class VariantFloat  { public string VariantName; public float Value; }
        [System.Serializable]
        public class VariantPreset
        {
            public string VariantName;
            [Tooltip("Wind main strength")]    public float WindMain = 1f;
            [Tooltip("Wind turbulence amount")] public float Turbulence = 0.5f;
        }

        private WindZone _wind;
        private float _originalMain;
        private float _originalTurb;

        private void Awake()
        {
            _wind = GetComponent<WindZone>();
            _originalMain = _wind.windMain;
            _originalTurb = _wind.windTurbulence;
        }

        protected override void OnFlagChanged(FlagProxy flag)
        {
            if (flag == null || _wind == null) return;

            switch (_mode)
            {
                case WindControlMode.ToggleEnabled:
                    _wind.gameObject.SetActive(flag.Enabled);
                    break;

                case WindControlMode.WindMain:
                    _wind.windMain = ResolveFloat(flag, _originalMain);
                    break;

                case WindControlMode.WindTurbulence:
                    _wind.windTurbulence = ResolveFloat(flag, _originalTurb);
                    break;

                case WindControlMode.Preset:
                    if (!flag.Enabled)
                    {
                        _wind.windMain       = _disabledValue;
                        _wind.windTurbulence = _disabledValue;
                        break;
                    }
                    var variantName = flag.Variant?.Name ?? "";
                    foreach (var p in _presetMap)
                    {
                        if (p.VariantName == variantName)
                        {
                            _wind.windMain       = p.WindMain;
                            _wind.windTurbulence = p.Turbulence;
                            return;
                        }
                    }
                    _wind.windMain       = _enabledValue;
                    _wind.windTurbulence = _enabledValue * 0.5f;
                    break;
            }
        }

        private float ResolveFloat(FlagProxy flag, float original)
        {
            if (!flag.Enabled) return _disabledValue;
            var name = flag.Variant?.Name ?? "";
            foreach (var e in _floatMap)
                if (e.VariantName == name) return e.Value;
            if (flag.Variant?.Value != null)
            {
                try { return Convert.ToSingle(flag.Variant.Value); } catch { }
            }
            return _enabledValue;
        }

        private void OnDestroy()
        {
            if (_wind == null) return;
            _wind.windMain        = _originalMain;
            _wind.windTurbulence  = _originalTurb;
        }
    }
}
