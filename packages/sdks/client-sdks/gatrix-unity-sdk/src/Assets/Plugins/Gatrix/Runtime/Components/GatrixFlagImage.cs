// GatrixFlagImage - Swap Sprites based on feature flag variants or state
// Useful for A/B testing assets, seasonal themes, or UI state changes

using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Changes an Image or SpriteRenderer's sprite based on feature flag state.
    /// Supports mapping specific variants to specific sprites.
    /// </summary>
    [AddComponentMenu("Gatrix/Flag Image")]
    public class GatrixFlagImage : MonoBehaviour
    {
        [Header("Flag Configuration")]
        [GatrixFlagName]
        [SerializeField] private string _flagName;

        [Header("Sprite Mapping")]
        [Tooltip("Default sprite to used when flag is disabled or no variant matches")]
        [SerializeField] private Sprite _defaultSprite;

        [Tooltip("Mapping of variant names to sprites")]
        [SerializeField] private List<VariantSpriteMap> _variantMaps = new List<VariantSpriteMap>();

        [Header("Target (auto-detected)")]
        [SerializeField] private Image _uiImage;
        [SerializeField] private SpriteRenderer _spriteRenderer;

        private Action _unwatch;

        [Serializable]
        public class VariantSpriteMap
        {
            public string variantName;
            public Sprite sprite;
        }

        private void OnEnable()
        {
            DetectTarget();
            Subscribe();
        }

        private void OnDisable()
        {
            Unsubscribe();
        }

        private void DetectTarget()
        {
            if (_uiImage == null) _uiImage = GetComponent<Image>();
            if (_spriteRenderer == null) _spriteRenderer = GetComponent<SpriteRenderer>();
        }

        private void Subscribe()
        {
            if (string.IsNullOrEmpty(_flagName)) return;

            var client = GatrixBehaviour.Client;
            if (client == null) return;

            _unwatch = client.Features.WatchRealtimeFlagWithInitialState(_flagName, OnFlagChanged, 
                $"FlagImage:{gameObject.name}");
        }

        private void Unsubscribe()
        {
            _unwatch?.Invoke();
            _unwatch = null;
        }

        private void OnFlagChanged(FlagProxy flag)
        {
            if (!flag.Enabled)
            {
                SetSprite(_defaultSprite);
                return;
            }

            var variantName = flag.Variant?.Name;
            Sprite targetSprite = null;

            if (!string.IsNullOrEmpty(variantName))
            {
                foreach (var map in _variantMaps)
                {
                    if (map.variantName == variantName)
                    {
                        targetSprite = map.sprite;
                        break;
                    }
                }
            }

            SetSprite(targetSprite ?? _defaultSprite);
        }

        private void SetSprite(Sprite sprite)
        {
            if (_uiImage != null) _uiImage.sprite = sprite;
            if (_spriteRenderer != null) _spriteRenderer.sprite = sprite;
        }

        public string FlagName
        {
            get => _flagName;
            set { if (_flagName != value) { _flagName = value; Resubscribe(); } }
        }

        private void Resubscribe()
        {
            Unsubscribe();
            if (isActiveAndEnabled) Subscribe();
        }
    }
}
