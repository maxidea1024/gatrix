// GatrixFlagCamera - Control Camera properties per variant via feature flags
// Supports variant-to-FOV/color/clip mapping for A/B camera experiments

using System;
using System.Collections.Generic;
using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Controls a Camera component's properties (FOV, background color, clip planes, depth)
    /// based on a feature flag variant. Variant names map to specific values.
    /// </summary>
    [AddComponentMenu("Gatrix/Camera/Flag Camera")]
    [RequireComponent(typeof(Camera))]
    public class GatrixFlagCamera : GatrixFlagComponentBase
    {
        public enum CameraControlMode
        {
            ToggleEnabled,
            FieldOfView,
            BackgroundColor,
            NearClipPlane,
            FarClipPlane,
            Depth
        }

        [Header("Camera Control")]
        [SerializeField] private CameraControlMode _mode = CameraControlMode.FieldOfView;

        [Header("Field of View")]
        [SerializeField] private float _enabledFov = 60f;
        [SerializeField] private float _disabledFov = 60f;
        [Tooltip("Per-variant FOV mapping")]
        [SerializeField] private List<VariantFloat> _fovMap = new List<VariantFloat>();

        [Header("Background Color")]
        [SerializeField] private Color _enabledColor = Color.black;
        [SerializeField] private Color _disabledColor = Color.black;
        [Tooltip("Per-variant background color mapping")]
        [SerializeField] private List<VariantColor> _colorMap = new List<VariantColor>();

        [Header("Clip Planes")]
        [SerializeField] private float _enabledNear = 0.3f;
        [SerializeField] private float _enabledFar = 1000f;
        [SerializeField] private List<VariantFloat> _nearMap = new List<VariantFloat>();
        [SerializeField] private List<VariantFloat> _farMap = new List<VariantFloat>();

        [Header("Depth")]
        [SerializeField] private float _enabledDepth = 0f;
        [SerializeField] private List<VariantFloat> _depthMap = new List<VariantFloat>();

        [Header("Transition")]
        [SerializeField] private bool _animate = true;
        [SerializeField] private float _lerpSpeed = 5f;

        [Serializable] public class VariantFloat { public string VariantName; public float Value; }
        [Serializable] public class VariantColor { public string VariantName; public Color Value = Color.black; }

        private Camera _camera;
        private float _targetFloat;
        private Color _targetColor;
        private float _originalNear;
        private float _originalFar;

        private void Awake()
        {
            _camera = GetComponent<Camera>();
            _targetFloat = _camera.fieldOfView;
            _targetColor = _camera.backgroundColor;
            _originalNear = _camera.nearClipPlane;
            _originalFar = _camera.farClipPlane;
        }

        protected override void OnFlagChanged(FlagProxy flag)
        {
            if (flag == null || _camera == null) return;

            switch (_mode)
            {
                case CameraControlMode.ToggleEnabled:
                    _camera.enabled = flag.Enabled;
                    break;

                case CameraControlMode.FieldOfView:
                    _targetFloat = ResolveFloat(flag, _fovMap, _enabledFov, _disabledFov);
                    if (!_animate) _camera.fieldOfView = _targetFloat;
                    break;

                case CameraControlMode.BackgroundColor:
                    _targetColor = ResolveColor(flag, _colorMap, _enabledColor, _disabledColor);
                    if (!_animate) _camera.backgroundColor = _targetColor;
                    break;

                case CameraControlMode.NearClipPlane:
                    _targetFloat = ResolveFloat(flag, _nearMap, _enabledNear, _originalNear);
                    if (!_animate) _camera.nearClipPlane = _targetFloat;
                    break;

                case CameraControlMode.FarClipPlane:
                    _targetFloat = ResolveFloat(flag, _farMap, _enabledFar, _originalFar);
                    if (!_animate) _camera.farClipPlane = _targetFloat;
                    break;

                case CameraControlMode.Depth:
                    _camera.depth = ResolveFloat(flag, _depthMap, _enabledDepth, _camera.depth);
                    break;
            }
        }

        private void Update()
        {
            if (!_animate || _camera == null) return;
            switch (_mode)
            {
                case CameraControlMode.FieldOfView:
                    _camera.fieldOfView = Mathf.Lerp(_camera.fieldOfView, _targetFloat, Time.deltaTime * _lerpSpeed);
                    break;
                case CameraControlMode.BackgroundColor:
                    _camera.backgroundColor = Color.Lerp(_camera.backgroundColor, _targetColor, Time.deltaTime * _lerpSpeed);
                    break;
                case CameraControlMode.NearClipPlane:
                    _camera.nearClipPlane = Mathf.Lerp(_camera.nearClipPlane, _targetFloat, Time.deltaTime * _lerpSpeed);
                    break;
                case CameraControlMode.FarClipPlane:
                    _camera.farClipPlane = Mathf.Lerp(_camera.farClipPlane, _targetFloat, Time.deltaTime * _lerpSpeed);
                    break;
            }
        }

        private static float ResolveFloat(FlagProxy flag, List<VariantFloat> map, float enabled, float disabled)
        {
            if (!flag.Enabled) return disabled;
            var name = flag.Variant?.Name ?? "";
            foreach (var e in map)
                if (e.VariantName == name) return e.Value;
            if (flag.Variant?.Value != null)
            {
                try { return Convert.ToSingle(flag.Variant.Value); } catch { }
            }
            return enabled;
        }

        private static Color ResolveColor(FlagProxy flag, List<VariantColor> map, Color enabled, Color disabled)
        {
            if (!flag.Enabled) return disabled;
            var name = flag.Variant?.Name ?? "";
            foreach (var e in map)
                if (e.VariantName == name) return e.Value;
            if (flag.Variant?.Value is string hex && ColorUtility.TryParseHtmlString(hex, out Color parsed))
                return parsed;
            return enabled;
        }
    }
}
