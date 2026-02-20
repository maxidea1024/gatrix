// GatrixFlagLogger - Log flag changes to the console for debugging
// Quickly see what's happening with flags without writing code

using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Logs feature flag changes to the Unity console.
    /// Useful during development to verify triggering logic.
    /// </summary>
    [AddComponentMenu("Gatrix/Flag Logger")]
    public class GatrixFlagLogger : GatrixFlagComponentBase
    {
        public enum LogLevel { Info, Warning, Error }

        [Header("Logging Settings")]
        [SerializeField] private LogLevel _logLevel = LogLevel.Info;
        [SerializeField] private string _prefix = "[Gatrix]";
        [SerializeField] private bool _logValue = true;
        [SerializeField] private bool _logReason = true;

        private bool _isFirst = true;

        protected override void OnEnable()
        {
            _isFirst = true;
            base.OnEnable();
        }

        protected override void OnFlagChanged(FlagProxy flag)
        {
            if (flag == null) return;

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
