// GatrixFlagLogger - Log flag changes to the console for debugging
// Quickly see what's happening with flags without writing code

using System;
using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Logs feature flag changes to the Unity console.
    /// Useful during development to verify triggering logic.
    /// </summary>
    [AddComponentMenu("Gatrix/Flag Logger")]
    public class GatrixFlagLogger : MonoBehaviour
    {
        public enum LogLevel { Info, Warning, Error }

        [Header("Flag Configuration")]
        [GatrixFlagName]
        [SerializeField] private string _flagName;

        [Header("Logging Settings")]
        [SerializeField] private LogLevel _logLevel = LogLevel.Info;
        [SerializeField] private string _prefix = "[Gatrix]";
        [SerializeField] private bool _logValue = true;
        [SerializeField] private bool _logReason = true;

        private Action _unwatch;
        private bool _isFirst = true;

        private void OnEnable()
        {
            _isFirst = true;
            Subscribe();
        }

        private void OnDisable()
        {
            Unsubscribe();
        }

        private void Subscribe()
        {
            if (string.IsNullOrEmpty(_flagName)) return;

            var client = GatrixBehaviour.Client;
            if (client == null) return;

            _unwatch = client.Features.WatchRealtimeFlagWithInitialState(_flagName, OnFlagChanged,
                $"FlagLogger:{gameObject.name}");
        }

        private void Unsubscribe()
        {
            _unwatch?.Invoke();
            _unwatch = null;
        }

        private void OnFlagChanged(FlagProxy flag)
        {
            string type = _isFirst ? "Initial" : "Changed";
            _isFirst = false;

            var sb = new System.Text.StringBuilder(128);
            sb.Append(_prefix).Append(" Flag '").Append(_flagName).Append("' ")
              .Append(type).Append(": Enabled=").Append(flag.Enabled)
              .Append(", Variant=").Append(flag.Variant?.Name ?? "none");

            if (_logValue)
            {
                sb.Append(", Value=").Append(flag.Variant?.Value ?? "null");
            }

            if (_logReason)
            {
                sb.Append(", Reason=").Append(flag.Reason ?? "unknown");
            }

            string msg = sb.ToString();

            switch (_logLevel)
            {
                case LogLevel.Info: Debug.Log(msg, gameObject); break;
                case LogLevel.Warning: Debug.LogWarning(msg, gameObject); break;
                case LogLevel.Error: Debug.LogError(msg, gameObject); break;
            }
        }
    }
}
