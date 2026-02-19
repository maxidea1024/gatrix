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
            if (string.IsNullOrWhiteSpace(config.ApiUrl))
                throw new ArgumentException("apiUrl is required", nameof(config));
            if (string.IsNullOrWhiteSpace(config.ApiToken))
                throw new ArgumentException("apiToken is required", nameof(config));
            if (string.IsNullOrWhiteSpace(config.AppName))
                throw new ArgumentException("appName is required", nameof(config));
            if (string.IsNullOrWhiteSpace(config.Environment))
                throw new ArgumentException("environment is required", nameof(config));

            // URL format validation
            if (!Uri.TryCreate(config.ApiUrl, UriKind.Absolute, out var uri) ||
                (uri.Scheme != "http" && uri.Scheme != "https"))
                throw new ArgumentException(
                    $"Invalid apiUrl: \"{config.ApiUrl}\". Must be a valid HTTP/HTTPS URL.", nameof(config));

            // Whitespace validation
            if (config.ApiUrl.Trim() != config.ApiUrl)
                throw new ArgumentException("apiUrl must not have leading or trailing whitespace", nameof(config));
            if (config.ApiToken.Trim() != config.ApiToken)
                throw new ArgumentException("apiToken must not have leading or trailing whitespace", nameof(config));

            // CacheKeyPrefix
            if (config.CacheKeyPrefix != null && config.CacheKeyPrefix.Length > 100)
                throw new ArgumentException("cacheKeyPrefix must be <= 100 characters", nameof(config));

            // Features config
            var feat = config.Features;
            if (feat != null)
            {
                ValidateRange(feat.RefreshInterval, "RefreshInterval", 1, 86400);
                ValidateRange(feat.MetricsInterval, "MetricsInterval", 1, 86400);
                ValidateRange(feat.MetricsIntervalInitial, "MetricsIntervalInitial", 0, 3600);
                ValidateRange(feat.FetchRetryLimit, "FetchRetryLimit", 0, 10);
                ValidateRange(feat.FetchTimeout, "FetchTimeout", 1, 120);
                ValidateRange(feat.InitialBackoff, "InitialBackoff", 1, 60);
                ValidateRange(feat.MaxBackoff, "MaxBackoff", 1, 600);

                if (feat.InitialBackoff > feat.MaxBackoff)
                    throw new ArgumentException(
                        $"InitialBackoff ({feat.InitialBackoff}) must be <= MaxBackoff ({feat.MaxBackoff})",
                        nameof(config));

                if (feat.NonRetryableStatusCodes != null)
                {
                    foreach (var code in feat.NonRetryableStatusCodes)
                    {
                        if (code < 400 || code > 599)
                            throw new ArgumentException(
                                $"NonRetryableStatusCodes contains invalid status code: {code} (must be 400-599)",
                                nameof(config));
                    }
                }

                // Streaming config
                var streaming = feat.Streaming;
                if (streaming != null)
                {
                    // SSE config
                    var sse = streaming.Sse;
                    if (sse != null)
                    {
                        ValidateRange(sse.ReconnectBase, "Streaming.Sse.ReconnectBase", 1, 60);
                        ValidateRange(sse.ReconnectMax, "Streaming.Sse.ReconnectMax", 1, 300);
                        ValidateRange(sse.PollingJitter, "Streaming.Sse.PollingJitter", 0, 30);

                        if (sse.ReconnectBase > sse.ReconnectMax)
                            throw new ArgumentException(
                                $"Streaming.Sse.ReconnectBase ({sse.ReconnectBase}) must be <= Streaming.Sse.ReconnectMax ({sse.ReconnectMax})",
                                nameof(config));

                        if (!string.IsNullOrEmpty(sse.Url))
                        {
                            if (!Uri.TryCreate(sse.Url, UriKind.Absolute, out var streamUri) ||
                                (streamUri.Scheme != "http" && streamUri.Scheme != "https"))
                                throw new ArgumentException(
                                    $"Invalid Streaming.Sse.Url: \"{sse.Url}\". Must be a valid HTTP/HTTPS URL.",
                                    nameof(config));
                        }
                    }

                    // WebSocket config
                    var ws = streaming.WebSocket;
                    if (ws != null)
                    {
                        ValidateRange(ws.ReconnectBase, "Streaming.WebSocket.ReconnectBase", 1, 60);
                        ValidateRange(ws.ReconnectMax, "Streaming.WebSocket.ReconnectMax", 1, 300);
                        ValidateRange(ws.PingInterval, "Streaming.WebSocket.PingInterval", 5, 300);

                        if (ws.ReconnectBase > ws.ReconnectMax)
                            throw new ArgumentException(
                                $"Streaming.WebSocket.ReconnectBase ({ws.ReconnectBase}) must be <= Streaming.WebSocket.ReconnectMax ({ws.ReconnectMax})",
                                nameof(config));

                        if (!string.IsNullOrEmpty(ws.Url))
                        {
                            if (!Uri.TryCreate(ws.Url, UriKind.Absolute, out var wsUri) ||
                                (wsUri.Scheme != "ws" && wsUri.Scheme != "wss" &&
                                 wsUri.Scheme != "http" && wsUri.Scheme != "https"))
                                throw new ArgumentException(
                                    $"Invalid Streaming.WebSocket.Url: \"{ws.Url}\". Must be a valid WS/WSS or HTTP/HTTPS URL.",
                                    nameof(config));
                        }
                    }
                }
            }
        }

        private static void ValidateRange(int value, string name, int min, int max)
        {
            if (value < min || value > max)
                throw new ArgumentException(
                    $"{name} must be between {min} and {max}, got {value}");
        }
    }
}
