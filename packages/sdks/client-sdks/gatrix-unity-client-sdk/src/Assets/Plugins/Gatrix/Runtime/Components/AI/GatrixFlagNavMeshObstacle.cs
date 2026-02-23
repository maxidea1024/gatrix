// GatrixFlagNavMeshObstacle - Control NavMeshObstacle via feature flags
// Useful for toggling dynamic obstacles, walls, or barriers via flags

using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.AI;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Controls a NavMeshObstacle's enabled state, radius, and height
    /// based on a feature flag. Variant names map to specific size values.
    /// </summary>
    [AddComponentMenu("Gatrix/AI/Flag NavMesh Obstacle")]
    [RequireComponent(typeof(NavMeshObstacle))]
    public class GatrixFlagNavMeshObstacle : GatrixFlagComponentBase
    {
        public enum ObstacleControlMode
        {
            ToggleEnabled,
            Radius,
            Height
        }

        [Header("Obstacle Control")]
        [SerializeField] private ObstacleControlMode _mode = ObstacleControlMode.ToggleEnabled;

        [Header("Values")]
        [Tooltip("Value when flag is enabled and no variant matches")]
        [SerializeField] private float _enabledValue = 0.5f;
        [Tooltip("Value when flag is disabled")]
        [SerializeField] private float _disabledValue = 0f;

        [Header("Carve")]
        [Tooltip("Toggle carving with the obstacle enabled state")]
        [SerializeField] private bool _carveWhenEnabled = true;

        [Header("Variant Mapping")]
        [SerializeField] private List<VariantFloat> _variantMap = new List<VariantFloat>();

        [System.Serializable]
        public class VariantFloat { public string VariantName; public float Value; }

        private NavMeshObstacle _obstacle;
        private float _originalRadius;
        private float _originalHeight;

        private void Awake()
        {
            _obstacle = GetComponent<NavMeshObstacle>();
            _originalRadius = _obstacle.radius;
            _originalHeight = _obstacle.height;
        }

        protected override void OnFlagChanged(FlagProxy flag)
        {
            if (flag == null || _obstacle == null) return;

            switch (_mode)
            {
                case ObstacleControlMode.ToggleEnabled:
                    _obstacle.enabled = flag.Enabled;
                    if (_carveWhenEnabled) _obstacle.carving = flag.Enabled;
                    break;

                case ObstacleControlMode.Radius:
                    _obstacle.radius = ResolveFloat(flag, _originalRadius);
                    break;

                case ObstacleControlMode.Height:
                    _obstacle.height = ResolveFloat(flag, _originalHeight);
                    break;
            }
        }

        private float ResolveFloat(FlagProxy flag, float original)
        {
            if (!flag.Enabled) return _disabledValue;
            var name = flag.Variant?.Name ?? "";
            foreach (var e in _variantMap)
                if (e.VariantName == name) return e.Value;
            if (flag.Variant?.Value != null)
            {
                try { return Convert.ToSingle(flag.Variant.Value); } catch { }
            }
            return _enabledValue;
        }
    }
}
