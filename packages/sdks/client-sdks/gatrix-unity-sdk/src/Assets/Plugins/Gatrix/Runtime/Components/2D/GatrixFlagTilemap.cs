// GatrixFlagTilemap - Control Tilemap color/opacity via feature flags
// Useful for revealing/hiding map sections or changing tilemap themes per variant

using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Tilemaps;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Controls a Tilemap's color (tint) and enabled state based on a feature flag.
    /// Variant names map to specific tint colors.
    /// </summary>
    [AddComponentMenu("Gatrix/2D/Flag Tilemap")]
    [RequireComponent(typeof(Tilemap))]
    public class GatrixFlagTilemap : GatrixFlagComponentBase
    {
        public enum TilemapControlMode
        {
            ToggleRenderer,
            Color,
            Opacity
        }

        [Header("Tilemap Control")]
        [SerializeField] private TilemapControlMode _mode = TilemapControlMode.ToggleRenderer;

        [Header("Color")]
        [SerializeField] private Color _enabledColor = Color.white;
        [SerializeField] private Color _disabledColor = Color.clear;
        [Tooltip("Map variant names to specific tilemap tint colors")]
        [SerializeField] private List<VariantColor> _colorMap = new List<VariantColor>();

        [Header("Opacity")]
        [Range(0f, 1f)] [SerializeField] private float _enabledOpacity = 1f;
        [Range(0f, 1f)] [SerializeField] private float _disabledOpacity = 0f;
        [SerializeField] private List<VariantOpacity> _opacityMap = new List<VariantOpacity>();

        [Header("Transition")]
        [SerializeField] private bool _animate = true;
        [SerializeField] private float _lerpSpeed = 5f;

        [System.Serializable] public class VariantColor { public string VariantName; public Color Color = Color.white; }
        [System.Serializable] public class VariantOpacity { public string VariantName; [Range(0f, 1f)] public float Opacity = 1f; }

        private Tilemap _tilemap;
        private TilemapRenderer _tilemapRenderer;
        private Color _targetColor;
        private Color _originalColor;

        private void Awake()
        {
            _tilemap = GetComponent<Tilemap>();
            _tilemapRenderer = GetComponent<TilemapRenderer>();
            _originalColor = _tilemap.color;
            _targetColor = _originalColor;
        }

        protected override void OnFlagChanged(FlagProxy flag)
        {
            if (flag == null || _tilemap == null) return;

            switch (_mode)
            {
                case TilemapControlMode.ToggleRenderer:
                    if (_tilemapRenderer != null) _tilemapRenderer.enabled = flag.Enabled;
                    break;

                case TilemapControlMode.Color:
                    _targetColor = ResolveColor(flag);
                    if (!_animate) _tilemap.color = _targetColor;
                    break;

                case TilemapControlMode.Opacity:
                    float opacity = ResolveOpacity(flag);
                    Color c = _tilemap.color;
                    _targetColor = new Color(c.r, c.g, c.b, opacity);
                    if (!_animate) _tilemap.color = _targetColor;
                    break;
            }
        }

        private Color ResolveColor(FlagProxy flag)
        {
            if (!flag.Enabled) return _disabledColor;
            var name = flag.Variant?.Name ?? "";
            foreach (var e in _colorMap)
                if (e.VariantName == name) return e.Color;
            if (flag.Variant?.Value is string hex && ColorUtility.TryParseHtmlString(hex, out Color parsed))
                return parsed;
            return _enabledColor;
        }

        private float ResolveOpacity(FlagProxy flag)
        {
            if (!flag.Enabled) return _disabledOpacity;
            var name = flag.Variant?.Name ?? "";
            foreach (var e in _opacityMap)
                if (e.VariantName == name) return e.Opacity;
            if (flag.Variant?.Value != null)
            {
                try { return System.Convert.ToSingle(flag.Variant.Value); } catch { }
            }
            return _enabledOpacity;
        }

        private void Update()
        {
            if (!_animate || _tilemap == null) return;
            if (_mode == TilemapControlMode.Color || _mode == TilemapControlMode.Opacity)
                _tilemap.color = Color.Lerp(_tilemap.color, _targetColor, Time.deltaTime * _lerpSpeed);
        }
    }
}
