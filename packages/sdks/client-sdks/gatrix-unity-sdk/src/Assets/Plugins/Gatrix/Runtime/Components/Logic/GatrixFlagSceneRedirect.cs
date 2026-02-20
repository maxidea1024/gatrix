// GatrixFlagSceneRedirect - Load a different scene based on feature flags
// Useful for A/B testing onboarding flows, gradual rollouts of new areas, or seasonal events

using UnityEngine;
using UnityEngine.SceneManagement;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Redirects to a different scene when a feature flag is enabled.
    /// Can be used as a "gate" in a loading or splash scene.
    /// </summary>
    [AddComponentMenu("Gatrix/Flag Scene Redirect")]
    public class GatrixFlagSceneRedirect : GatrixFlagComponentBase
    {
        [Header("Redirect Settings")]
        [Tooltip("Target scene name when the flag is enabled")]
        [SerializeField] private string _redirectScene;

        [Tooltip("If true, uses the variant name as the scene name to load")]
        [SerializeField] private bool _useVariantAsScene;

        [Tooltip("Add the scene additively instead of loading cleanly")]
        [SerializeField] private bool _loadAdditively;

        [Tooltip("Only redirect once then disable this component")]
        [SerializeField] private bool _redirectOnce = true;

        private bool _hasRedirected;

        protected override void OnFlagChanged(FlagProxy flag)
        {
            if (flag == null || _hasRedirected) return;

            if (flag.Enabled)
            {
                string target = _redirectScene;
                if (_useVariantAsScene)
                {
                    target = flag.Variant?.Name;
                }

                if (!string.IsNullOrEmpty(target))
                {
                    _hasRedirected = true;
                    Debug.Log($"[Gatrix] Flag '{_flagName}' redirecting to scene: {target}");
                    SceneManager.LoadScene(target, _loadAdditively ? LoadSceneMode.Additive : LoadSceneMode.Single);
                    
                    if (_redirectOnce)
                    {
                        enabled = false;
                    }
                }
            }
        }
    }
}
