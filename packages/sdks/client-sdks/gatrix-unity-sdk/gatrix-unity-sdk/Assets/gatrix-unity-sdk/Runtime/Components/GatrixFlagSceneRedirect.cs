// GatrixFlagSceneRedirect - Load a different scene based on feature flags
// Useful for A/B testing onboarding flows, gradual rollouts of new areas, or seasonal events

using System;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Redirects to a different scene on Start if a feature flag is enabled.
    /// Can be used as a "gate" at the end of a loading or splash scene.
    /// </summary>
    [AddComponentMenu("Gatrix/Flag Scene Redirect")]
    public class GatrixFlagSceneRedirect : MonoBehaviour
    {
        [Header("Flag Configuration")]
        [GatrixFlagName]
        [SerializeField] private string _flagName;

        [Header("Redirect Settings")]
        [Tooltip("Target scene name when the flag is enabled")]
        [SerializeField] private string _redirectScene;

        [Tooltip("If true, uses the variant name as the scene name to load")]
        [SerializeField] private bool _useVariantAsScene;

        [Tooltip("Add the scene additively instead of loading cleanly")]
        [SerializeField] private bool _loadAdditively;

        [Tooltip("When to check (default is Start)")]
        [SerializeField] private bool _checkOnStart = true;

        private void Start()
        {
            if (_checkOnStart)
            {
                CheckAndRedirect();
            }
        }

        /// <summary>
        /// Manually trigger the redirection logic.
        /// Useful when waiting for custom initialization or data loading.
        /// </summary>
        public void CheckAndRedirect()
        {
            if (string.IsNullOrEmpty(_flagName)) return;

            var client = GatrixBehaviour.Client;
            if (client == null || !client.IsReady)
            {
                Debug.LogWarning($"[Gatrix] Cannot redirect based on '{_flagName}' because SDK is not ready.");
                return;
            }

            var flag = client.Features.GetFlagProxy(_flagName);
            if (!flag.Enabled) return;

            string target = _redirectScene;
            if (_useVariantAsScene && flag.Variant != null)
            {
                target = flag.Variant.Name;
            }

            if (!string.IsNullOrEmpty(target))
            {
                Debug.Log($"[Gatrix] Flag '{_flagName}' redirecting to scene: {target}");
                SceneManager.LoadScene(target, _loadAdditively ? LoadSceneMode.Additive : LoadSceneMode.Single);
            }
        }
    }
}
