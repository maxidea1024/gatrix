// Unity-based logger implementation for Gatrix Unity Client SDK

using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Default logger implementation using Unity's Debug class.
    /// Supports verbose logging if GATRIX_VERBOSE symbol is defined.
    /// </summary>
    public class UnityGatrixLogger : IGatrixLogger, IGatrixLoggerVerbose
    {
        private readonly string _prefix;

        public UnityGatrixLogger(string prefix = "GatrixSDK")
        {
            _prefix = prefix;
        }

        public void Debug(string message)
        {
            UnityEngine.Debug.Log($"[{_prefix}] {message}");
        }

        public void Info(string message)
        {
            UnityEngine.Debug.Log($"[{_prefix}] {message}");
        }

        public void Warn(string message)
        {
            UnityEngine.Debug.LogWarning($"[{_prefix}] {message}");
        }

        public void Error(string message)
        {
            UnityEngine.Debug.LogError($"[{_prefix}] {message}");
        }

        public void Verbose(string message)
        {
#if GATRIX_VERBOSE
            UnityEngine.Debug.Log($"[{_prefix}] [VERBOSE] {message}");
#endif
        }
    }

    /// <summary>
    /// No-op logger that discards all messages
    /// </summary>
    public class NoOpLogger : IGatrixLogger, IGatrixLoggerVerbose
    {
        public void Debug(string message) { }
        public void Info(string message) { }
        public void Warn(string message) { }
        public void Error(string message) { }
        public void Verbose(string message) { }
    }
}
