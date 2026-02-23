// Shared dev-mode logging utility for Gatrix Unity Client SDK

using System.Threading;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Dev-mode logger wrapper. Logs are only emitted when devMode is enabled,
    /// with a [DEV] prefix for easy filtering in the Unity console.
    /// Thread-safe: optionally captures SynchronizationContext for main-thread dispatch.
    /// </summary>
    internal class GatrixDevLogger
    {
        private readonly IGatrixLogger _logger;
        private readonly bool _enabled;
        private readonly SynchronizationContext _syncContext;

        /// <summary>Create a dev logger (main-thread only usage)</summary>
        public GatrixDevLogger(IGatrixLogger logger, bool enableDevMode)
            : this(logger, enableDevMode, null)
        {
        }

        /// <summary>Create a dev logger with optional sync context for background thread usage</summary>
        public GatrixDevLogger(IGatrixLogger logger, bool enableDevMode, SynchronizationContext syncContext)
        {
            _logger = logger;
            _enabled = enableDevMode;
            _syncContext = syncContext;
        }

        /// <summary>Log a dev-mode debug message with [DEV] prefix</summary>
        public void Log(string message)
        {
            if (!_enabled) return;

            var formatted = $"[DEV] {message}";

            // If sync context is provided and we're on a different thread, dispatch to main thread
            if (_syncContext != null && SynchronizationContext.Current != _syncContext)
            {
                _syncContext.Post(_ => _logger?.Debug(formatted), null);
            }
            else
            {
                _logger?.Debug(formatted);
            }
        }
    }
}
