// GatrixFlagQualitySettings - Control Unity QualitySettings via feature flags
// Useful for A/B testing graphics quality levels, shadow distance, or anti-aliasing

using System;
using System.Collections.Generic;
using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Controls Unity QualitySettings properties based on a feature flag.
    /// Variant names map to specific quality presets or numeric values.
    /// Restores original values on destroy.
    /// </summary>
    [AddComponentMenu("Gatrix/Rendering/Flag Quality Settings")]
    public class GatrixFlagQualitySettings : GatrixFlagComponentBase
    {
        public enum QualityControlMode
        {
            QualityLevel,
            ShadowDistance,
            LodBias,
            AnisotropicFiltering,
            PixelLightCount,
            SoftParticles,
            RealtimeReflectionProbes
        }

        [Header("Quality Control")]
        [SerializeField] private QualityControlMode _mode = QualityControlMode.QualityLevel;
        [SerializeField] private bool _applyExpensiveChanges = true;

        [Header("Quality Level")]
        [Tooltip("Quality level index when flag is enabled (see Quality Settings in Project Settings)")]
        [SerializeField] private int _enabledQualityLevel = 3;
        [SerializeField] private int _disabledQualityLevel = 1;
        [SerializeField] private List<VariantQuality> _qualityLevelMap = new List<VariantQuality>();

        [Header("Float Value (ShadowDistance / LodBias)")]
        [SerializeField] private float _enabledFloat = 150f;
        [SerializeField] private float _disabledFloat = 50f;
        [SerializeField] private List<VariantFloat> _floatMap = new List<VariantFloat>();

        [Header("Integer Value (PixelLightCount)")]
        [SerializeField] private int _enabledInt = 4;
        [SerializeField] private int _disabledInt = 1;
        [SerializeField] private List<VariantInt> _intMap = new List<VariantInt>();

        [System.Serializable] public class VariantQuality { public string VariantName; public int QualityLevel; }
        [System.Serializable] public class VariantFloat   { public string VariantName; public float Value; }
        [System.Serializable] public class VariantInt     { public string VariantName; public int Value; }

        private int   _originalQualityLevel;
        private float _originalShadowDistance;
        private float _originalLodBias;
        private AnisotropicFiltering _originalAniso;
        private int   _originalPixelLights;
        private bool  _originalSoftParticles;
        private bool  _originalRtReflections;

        private void Awake()
        {
            _originalQualityLevel   = QualitySettings.GetQualityLevel();
            _originalShadowDistance = QualitySettings.shadowDistance;
            _originalLodBias        = QualitySettings.lodBias;
            _originalAniso          = QualitySettings.anisotropicFiltering;
            _originalPixelLights    = QualitySettings.pixelLightCount;
            _originalSoftParticles  = QualitySettings.softParticles;
            _originalRtReflections  = QualitySettings.realtimeReflectionProbes;
        }

        protected override void OnFlagChanged(FlagProxy flag)
        {
            if (flag == null) return;

            switch (_mode)
            {
                case QualityControlMode.QualityLevel:
                    int level = ResolveInt(flag, _qualityLevelMap, _enabledQualityLevel, _disabledQualityLevel);
                    QualitySettings.SetQualityLevel(level, _applyExpensiveChanges);
                    break;

                case QualityControlMode.ShadowDistance:
                    QualitySettings.shadowDistance = ResolveFloat(flag, _enabledFloat, _disabledFloat);
                    break;

                case QualityControlMode.LodBias:
                    QualitySettings.lodBias = ResolveFloat(flag, _enabledFloat, _disabledFloat);
                    break;

                case QualityControlMode.AnisotropicFiltering:
                    QualitySettings.anisotropicFiltering = flag.Enabled
                        ? AnisotropicFiltering.Enable
                        : AnisotropicFiltering.Disable;
                    break;

                case QualityControlMode.PixelLightCount:
                    QualitySettings.pixelLightCount = ResolveIntSimple(flag, _enabledInt, _disabledInt);
                    break;

                case QualityControlMode.SoftParticles:
                    QualitySettings.softParticles = flag.Enabled;
                    break;

                case QualityControlMode.RealtimeReflectionProbes:
                    QualitySettings.realtimeReflectionProbes = flag.Enabled;
                    break;
            }
        }

        private float ResolveFloat(FlagProxy flag, float whenEnabled, float whenDisabled)
        {
            if (!flag.Enabled) return whenDisabled;
            var name = flag.Variant?.Name ?? "";
            foreach (var e in _floatMap)
                if (e.VariantName == name) return e.Value;
            if (flag.Variant?.Value != null)
            {
                try { return Convert.ToSingle(flag.Variant.Value); } catch { }
            }
            return whenEnabled;
        }

        private int ResolveInt(FlagProxy flag, List<VariantQuality> map, int whenEnabled, int whenDisabled)
        {
            if (!flag.Enabled) return whenDisabled;
            var name = flag.Variant?.Name ?? "";
            foreach (var e in map)
                if (e.VariantName == name) return e.QualityLevel;
            if (flag.Variant?.Value != null)
            {
                try { return Convert.ToInt32(flag.Variant.Value); } catch { }
            }
            return whenEnabled;
        }

        private int ResolveIntSimple(FlagProxy flag, int whenEnabled, int whenDisabled)
        {
            if (!flag.Enabled) return whenDisabled;
            var name = flag.Variant?.Name ?? "";
            foreach (var e in _intMap)
                if (e.VariantName == name) return e.Value;
            if (flag.Variant?.Value != null)
            {
                try { return Convert.ToInt32(flag.Variant.Value); } catch { }
            }
            return whenEnabled;
        }

        private void OnDestroy()
        {
            switch (_mode)
            {
                case QualityControlMode.QualityLevel:
                    QualitySettings.SetQualityLevel(_originalQualityLevel, _applyExpensiveChanges); break;
                case QualityControlMode.ShadowDistance:
                    QualitySettings.shadowDistance = _originalShadowDistance; break;
                case QualityControlMode.LodBias:
                    QualitySettings.lodBias = _originalLodBias; break;
                case QualityControlMode.AnisotropicFiltering:
                    QualitySettings.anisotropicFiltering = _originalAniso; break;
                case QualityControlMode.PixelLightCount:
                    QualitySettings.pixelLightCount = _originalPixelLights; break;
                case QualityControlMode.SoftParticles:
                    QualitySettings.softParticles = _originalSoftParticles; break;
                case QualityControlMode.RealtimeReflectionProbes:
                    QualitySettings.realtimeReflectionProbes = _originalRtReflections; break;
            }
        }
    }
}
