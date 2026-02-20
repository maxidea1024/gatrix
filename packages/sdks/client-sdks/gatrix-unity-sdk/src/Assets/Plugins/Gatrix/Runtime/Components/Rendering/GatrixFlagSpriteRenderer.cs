// GatrixFlagSpriteRenderer - Control SpriteRenderer properties via feature flags
// Useful for swapping sprites, changing sprite color, or toggling sprite visibility

using System;
using System.Collections.Generic;
using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Controls a SpriteRenderer's sprite, color, and enabled state based on a feature flag.
    /// Supports variant-to-sprite mapping for A/B testing visual assets.
    /// </summary>
    [AddComponentMenu("Gatrix/Rendering/Flag Sprite Renderer")]
    [RequireComponent(typeof(SpriteRenderer))]
    public class GatrixFlagSpriteRenderer : GatrixFlagComponentBase
    {
        public enum SpriteControlMode
        {
            ToggleEnabled,
            SwapSprite,
            Color
        }

        [Header("Sprite Control")]
        [Tooltip("Which SpriteRenderer property to control")]
        [SerializeField] private SpriteControlMode _mode = SpriteControlMode.ToggleEnabled;

        [Header("Sprite Mapping (for SwapSprite mode)")]
        [Tooltip("Default sprite when no variant matches")]
        [SerializeField] private Sprite _defaultSprite;

        [Tooltip("Map variant names to sprites")]
        [SerializeField] private List<VariantSpriteEntry> _variantSprites = new List<VariantSpriteEntry>();

        [Header("Color (for Color mode)")]
        [SerializeField] private Color _enabledColor = Color.white;
        [SerializeField] private Color _disabledColor = Color.grey;

        [Header("Transition")]
        [SerializeField] private bool _animate = true;
        [SerializeField] private float _lerpSpeed = 5f;

        [Serializable]
        public class VariantSpriteEntry
        {
            public string VariantName;
            public Sprite Sprite;
        }

        private SpriteRenderer _renderer;
        private Color _targetColor;
        private Sprite _originalSprite;

        private void Awake()
        {
            _renderer = GetComponent<SpriteRenderer>();
            _originalSprite = _renderer.sprite;
            _targetColor = _renderer.color;
        }

        protected override void OnFlagChanged(FlagProxy flag)
        {
            if (flag == null || _renderer == null) return;

            switch (_mode)
            {
                case SpriteControlMode.ToggleEnabled:
                    _renderer.enabled = flag.Enabled;
                    break;

                case SpriteControlMode.SwapSprite:
                    if (!flag.Enabled)
                    {
                        _renderer.sprite = _defaultSprite ?? _originalSprite;
                        return;
                    }
                    var variantName = flag.Variant?.Name ?? "";
                    Sprite found = _defaultSprite;
                    foreach (var entry in _variantSprites)
                    {
                        if (entry.VariantName == variantName)
                        {
                            found = entry.Sprite;
                            break;
                        }
                    }
                    _renderer.sprite = found;
                    break;

                case SpriteControlMode.Color:
                    Color color = flag.Enabled ? _enabledColor : _disabledColor;
                    if (flag.Variant?.Value is string hex && ColorUtility.TryParseHtmlString(hex, out Color parsed))
                        color = parsed;
                    _targetColor = color;
                    if (!_animate) _renderer.color = _targetColor;
                    break;
            }
        }

        private void Update()
        {
            if (!_animate || _renderer == null || _mode != SpriteControlMode.Color) return;
            _renderer.color = Color.Lerp(_renderer.color, _targetColor, Time.deltaTime * _lerpSpeed);
        }
    }
}
