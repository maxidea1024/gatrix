// GatrixFlagAIAnimator - Drive Animator parameters via feature flags for AI state control
// Useful for switching AI behavior states (patrol/chase/idle) via feature flags

using System;
using System.Collections.Generic;
using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Sets Animator parameters (bool, int, float, trigger) based on a feature flag's
    /// state and variant. Useful for toggling AI behavior states via flags.
    /// Variant names map to specific parameter values.
    /// </summary>
    [AddComponentMenu("Gatrix/AI/Flag AI Animator")]
    [RequireComponent(typeof(Animator))]
    public class GatrixFlagAIAnimator : GatrixFlagComponentBase
    {
        public enum AnimatorParamType
        {
            Bool,
            Int,
            Float,
            Trigger
        }

        [Header("Parameter Settings")]
        [Tooltip("Name of the Animator parameter to control")]
        [SerializeField] private string _parameterName;
        [SerializeField] private AnimatorParamType _paramType = AnimatorParamType.Bool;

        [Header("Bool / Trigger Values")]
        [Tooltip("Bool value when flag is enabled")]
        [SerializeField] private bool _enabledBool = true;
        [Tooltip("Bool value when flag is disabled")]
        [SerializeField] private bool _disabledBool = false;

        [Header("Int / Float Default Values")]
        [SerializeField] private float _enabledFloat = 1f;
        [SerializeField] private float _disabledFloat = 0f;

        [Header("Variant Mapping")]
        [Tooltip("Map variant names to specific Animator parameter values")]
        [SerializeField] private List<VariantParam> _variantMap = new List<VariantParam>();

        [System.Serializable]
        public class VariantParam
        {
            public string VariantName;
            [Tooltip("String value: 'true'/'false' for Bool, numeric for Int/Float, any string fires Trigger")]
            public string Value;
        }

        private Animator _animator;

        private void Awake()
        {
            _animator = GetComponent<Animator>();
        }

        protected override void OnFlagChanged(FlagProxy flag)
        {
            if (flag == null || _animator == null || string.IsNullOrEmpty(_parameterName)) return;

            switch (_paramType)
            {
                case AnimatorParamType.Bool:
                    _animator.SetBool(_parameterName, ResolveBoool(flag));
                    break;

                case AnimatorParamType.Int:
                    _animator.SetInteger(_parameterName, (int)ResolveFloat(flag));
                    break;

                case AnimatorParamType.Float:
                    _animator.SetFloat(_parameterName, ResolveFloat(flag));
                    break;

                case AnimatorParamType.Trigger:
                    if (flag.Enabled) _animator.SetTrigger(_parameterName);
                    else _animator.ResetTrigger(_parameterName);
                    break;
            }
        }

        private bool ResolveBoool(FlagProxy flag)
        {
            if (!flag.Enabled) return _disabledBool;
            var name = flag.Variant?.Name ?? "";
            foreach (var e in _variantMap)
                if (e.VariantName == name && !string.IsNullOrEmpty(e.Value))
                    return string.Equals(e.Value, "true", StringComparison.OrdinalIgnoreCase) || e.Value == "1";
            if (flag.Variant?.Value is bool b) return b;
            return _enabledBool;
        }

        private float ResolveFloat(FlagProxy flag)
        {
            if (!flag.Enabled) return _disabledFloat;
            var name = flag.Variant?.Name ?? "";
            foreach (var e in _variantMap)
                if (e.VariantName == name && !string.IsNullOrEmpty(e.Value))
                {
                    try { return Convert.ToSingle(e.Value); } catch { }
                }
            if (flag.Variant?.Value != null)
            {
                try { return Convert.ToSingle(flag.Variant.Value); } catch { }
            }
            return _enabledFloat;
        }
    }
}
