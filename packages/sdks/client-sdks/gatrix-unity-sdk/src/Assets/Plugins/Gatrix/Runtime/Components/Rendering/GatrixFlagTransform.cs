// GatrixFlagTransform - Adjust Transform based on flag values
// Hot-fix positions, rotations, or scales without updating the game client

using System;
using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Modifies a Transform's local position, rotation, or scale based on feature flag values.
    /// Supports JSON objects with "x", "y", "z" fields or raw numeric values.
    /// </summary>
    [AddComponentMenu("Gatrix/Flag Transform")]
    public class GatrixFlagTransform : GatrixFlagComponentBase
    {
        public enum Mode { Position, Rotation, Scale }
        public enum VectorComponent { Full, X, Y, Z }

        [Header("Transform Settings")]
        [SerializeField] private Mode _mode = Mode.Position;
        [SerializeField] private VectorComponent _component = VectorComponent.Full;
        
        [Tooltip("If true, the flag value is added to the original transform values")]
        [SerializeField] private bool _isRelative = true;

        [Header("Fallbacks")]
        [SerializeField] private bool _resetOnDisable = true;

        private Vector3 _originalValue;
        private bool _hasOriginal;

        protected override void OnEnable()
        {
            CaptureOriginal();
            base.OnEnable();
        }

        protected override void OnDisable()
        {
            base.OnDisable();
            if (_resetOnDisable && _hasOriginal)
            {
                ApplyValue(_originalValue);
            }
        }

        private void CaptureOriginal()
        {
            if (_hasOriginal) return;
            switch (_mode)
            {
                case Mode.Position: _originalValue = transform.localPosition; break;
                case Mode.Rotation: _originalValue = transform.localEulerAngles; break;
                case Mode.Scale: _originalValue = transform.localScale; break;
            }
            _hasOriginal = true;
        }

        protected override void OnFlagChanged(FlagProxy flag)
        {
            if (flag == null) return;

            if (!flag.Enabled)
            {
                ApplyValue(_originalValue);
                return;
            }

            var value = flag.Variant?.Value;
            if (value == null) return;

            Vector3 modifier = Vector3.zero;

            try 
            {
                if (value is System.Collections.Generic.Dictionary<string, object> dict)
                {
                    if (dict.TryGetValue("x", out var xVal)) modifier.x = Convert.ToSingle(xVal);
                    if (dict.TryGetValue("y", out var yVal)) modifier.y = Convert.ToSingle(yVal);
                    if (dict.TryGetValue("z", out var zVal)) modifier.z = Convert.ToSingle(zVal);
                }
                else
                {
                    float num = Convert.ToSingle(value);
                    switch (_component)
                    {
                        case VectorComponent.Full: modifier = new Vector3(num, num, num); break;
                        case VectorComponent.X: modifier.x = num; break;
                        case VectorComponent.Y: modifier.y = num; break;
                        case VectorComponent.Z: modifier.z = num; break;
                    }
                }

                Vector3 targetValue = _isRelative ? _originalValue + modifier : modifier;
                ApplyValue(targetValue);
            }
            catch (Exception)
            {
                // Ignore parsing errors
            }
        }

        private void ApplyValue(Vector3 vec)
        {
            switch (_mode)
            {
                case Mode.Position: transform.localPosition = vec; break;
                case Mode.Rotation: transform.localEulerAngles = vec; break;
                case Mode.Scale: transform.localScale = vec; break;
            }
        }
    }
}
