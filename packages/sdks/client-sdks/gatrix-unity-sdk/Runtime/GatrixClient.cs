// GatrixClient - Main entry point for Gatrix Unity SDK
// Top-level class wrapping FeaturesClient and other services

using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Threading.Tasks;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Main entry point for the Gatrix Unity SDK.
    /// Wraps FeaturesClient and provides high-level API.
    /// </summary>
    public class GatrixClient : IDisposable
    {
        public static string SdkName => SdkInfo.Name;
        public static string SdkVersion => SdkInfo.Version;

        private readonly GatrixEventEmitter _emitter;
        private readonly GatrixClientConfig _config;
        private readonly HttpClient _httpClient;
        private FeaturesClient _featuresClient;
        private bool _started;
        private bool _disposed;

        public GatrixClient(GatrixClientConfig config)
        {
            ValidateConfig(config);

            _config = config;
            _emitter = new GatrixEventEmitter();
            _httpClient = new HttpClient();

            // Add SDK identification header
            _httpClient.DefaultRequestHeaders.TryAddWithoutValidation(
                "X-SDK-Name", SdkName);
            _httpClient.DefaultRequestHeaders.TryAddWithoutValidation(
                "X-SDK-Version", SdkVersion);

            _featuresClient = new FeaturesClient(_emitter, _config, _httpClient);
        }

        /// <summary>Get the FeaturesClient for direct access</summary>
        public FeaturesClient Features => _featuresClient;

        /// <summary>Get the event emitter for subscribing to events</summary>
        public GatrixEventEmitter Events => _emitter;

        /// <summary>Check if SDK is ready</summary>
        public bool IsReady => _featuresClient?.IsReady() ?? false;

        /// <summary>Check if SDK has started</summary>
        public bool IsStarted => _started;

        /// <summary>Get the connection ID</summary>
        public string ConnectionId => _featuresClient?.GetConnectionId();

        // ==================== Lifecycle ====================

        /// <summary>
        /// Initialize and start the SDK.
        /// Call this once during application startup.
        /// </summary>
        public async ValueTask StartAsync()
        {
            if (_started) return;

            await _featuresClient.InitAsync();
            await _featuresClient.StartAsync();
            _started = true;
        }

        /// <summary>Stop the SDK (cancels polling, stops metrics)</summary>
        public void Stop()
        {
            _featuresClient?.Stop();
            _started = false;
        }

        // ==================== Event Subscription ====================

        /// <summary>Subscribe to an SDK event</summary>
        public GatrixClient On(string eventName, GatrixEventHandler callback, string name = null)
        {
            _emitter.On(eventName, callback, name);
            return this;
        }

        /// <summary>Subscribe to an SDK event once</summary>
        public GatrixClient Once(string eventName, GatrixEventHandler callback, string name = null)
        {
            _emitter.Once(eventName, callback, name);
            return this;
        }

        /// <summary>Unsubscribe from an SDK event</summary>
        public GatrixClient Off(string eventName, GatrixEventHandler callback = null)
        {
            _emitter.Off(eventName, callback);
            return this;
        }

        /// <summary>Subscribe to ALL SDK events</summary>
        public GatrixClient OnAny(GatrixAnyEventHandler callback, string name = null)
        {
            _emitter.OnAny(callback, name);
            return this;
        }

        /// <summary>Unsubscribe from ALL SDK events listener</summary>
        public GatrixClient OffAny(GatrixAnyEventHandler callback = null)
        {
            _emitter.OffAny(callback);
            return this;
        }

        // ==================== Statistics ====================

        /// <summary>Get SDK statistics (combined from all services)</summary>
        public GatrixSdkStats GetStats()
        {
            var featStats = _featuresClient.GetStats();
            return new GatrixSdkStats
            {
                SdkState = featStats.SdkState,
                StartTime = featStats.StartTime,
                ConnectionId = _featuresClient.GetConnectionId(),
                ErrorCount = featStats.ErrorCount,
                LastError = featStats.LastError,
                LastErrorTime = featStats.LastErrorTime,
                OfflineMode = _config.OfflineMode,
                Features = featStats,
                EventHandlerStats = _emitter.GetHandlerStats()
            };
        }

        // ==================== Dispose ====================

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;
            Stop();
            _emitter.RemoveAllListeners();
            _httpClient?.Dispose();
        }

        // ==================== Validation ====================

        private static void ValidateConfig(GatrixClientConfig config)
        {
            if (config == null)
                throw new ArgumentNullException(nameof(config));
            if (string.IsNullOrEmpty(config.ApiUrl))
                throw new ArgumentException("apiUrl is required", nameof(config));
            if (string.IsNullOrEmpty(config.ApiToken))
                throw new ArgumentException("apiToken is required", nameof(config));
            if (string.IsNullOrEmpty(config.AppName))
                throw new ArgumentException("appName is required", nameof(config));
            if (string.IsNullOrEmpty(config.Environment))
                throw new ArgumentException("environment is required", nameof(config));
        }
    }
}
