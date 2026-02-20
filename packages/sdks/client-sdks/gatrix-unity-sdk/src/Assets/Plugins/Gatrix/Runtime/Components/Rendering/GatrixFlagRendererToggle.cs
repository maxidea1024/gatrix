// GatrixFlagRendererToggle - Toggle Renderer visibility via feature flags
// Useful for showing/hiding meshes, effect renderers, or LOD groups

using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Enables or disables a Renderer component based on a feature flag.
    /// Works with any Renderer type (MeshRenderer, SkinnedMeshRenderer, etc.).
    /// </summary>
    [AddComponentMenu("Gatrix/Rendering/Flag Renderer Toggle")]
    public class GatrixFlagRendererToggle : GatrixFlagComponentBase
    {
        [Header("Renderer")]
        [Tooltip("Renderer to control (auto-detected if null)")]
        [SerializeField] private Renderer _renderer;

        [Tooltip("Invert the enabled state from the flag")]
        [SerializeField] private bool _invert;

        private void Awake()
        {
            if (_renderer == null) _renderer = GetComponent<Renderer>();
        }

        protected override void OnFlagChanged(FlagProxy flag)
        {
            if (flag == null || _renderer == null) return;

            bool visible = flag.Enabled;
            if (_invert) visible = !visible;

            _renderer.enabled = visible;
        }
    }
}
