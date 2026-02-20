// Type definitions for Gatrix Unity Client SDK

using System;
using System.Collections.Generic;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Evaluation context (global for client-side).
    /// appName and environment are system fields - always present and cannot be removed.
    /// </summary>
    [Serializable]
    public class GatrixContext
    {
        /// <summary>Application name (system field - cannot be removed)</summary>
        public string AppName { get; set; }

        /// <summary>Environment name (system field - cannot be removed)</summary>
        public string Environment { get; set; }

        public string UserId { get; set; }
        public string SessionId { get; set; }
        public string CurrentTime { get; set; }
        public Dictionary<string, object> Properties { get; set; }

        public GatrixContext Clone()
        {
            var clone = new GatrixContext
            {
                AppName = AppName,
                Environment = Environment,
                UserId = UserId,
                SessionId = SessionId,
                CurrentTime = CurrentTime
            };
            if (Properties != null)
            {
                clone.Properties = new Dictionary<string, object>(Properties);
            }
            return clone;
        }
    }

    /// <summary>
    /// Variant information from server evaluation
    /// </summary>
    [Serializable]
    public class Variant
    {
        public string Name { get; set; }
        public bool Enabled { get; set; }

        /// <summary>Value - can be bool, string, number, or JSON object</summary>
        public object Value { get; set; }
    }

    /// <summary>
    /// Variant type enum
    /// </summary>
    public enum ValueType
    {
        None,
        String,
        Number,
        Boolean,
        Json
    }

    /// <summary>
    /// Evaluated flag from Edge API
    /// </summary>
    [Serializable]
    public class EvaluatedFlag
    {
        public string Name { get; set; }
        public bool Enabled { get; set; }
        public Variant Variant { get; set; }
        public ValueType ValueType { get; set; }
        public int Version { get; set; }
        public string Reason { get; set; }
        public bool ImpressionData { get; set; }
    }

    /// <summary>
    /// API response containing evaluated flags (from Edge or backend)
    /// </summary>
    [Serializable]
    public class FlagsApiResponse
    {
        public bool Success { get; set; }
        public FlagsApiResponseData Data { get; set; }
        public FlagsApiResponseMeta Meta { get; set; }
    }

    [Serializable]
    public class FlagsApiResponseData
    {
        public List<EvaluatedFlag> Flags { get; set; }
    }

    [Serializable]
    public class FlagsApiResponseMeta
    {
        public string Environment { get; set; }
        public string EvaluatedAt { get; set; }
    }

    /// <summary>
    /// Impression event data
    /// </summary>
    public class ImpressionEvent
    {
        public string EventType { get; set; } // "isEnabled" or "getVariant"
        public string EventId { get; set; }
        public GatrixContext Context { get; set; }
        public bool Enabled { get; set; }
        public string FeatureName { get; set; }
        public bool ImpressionData { get; set; }
        public string VariantName { get; set; }
        public string Reason { get; set; }
    }

    /// <summary>
    /// Features configuration (feature flag specific settings)
    /// </summary>
    public class FeaturesConfig
    {
        /// <summary>Seconds between polls (default: 30)</summary>
        public int RefreshInterval { get; set; } = 30;

        /// <summary>Disable automatic polling</summary>
        public bool DisableRefresh { get; set; }

        /// <summary>Enable explicit sync mode</summary>
        public bool ExplicitSyncMode { get; set; }

        /// <summary>Initial flags for instant availability</summary>
        public List<EvaluatedFlag> Bootstrap { get; set; }

        /// <summary>Override stored flags with bootstrap (default: true)</summary>
        public bool BootstrapOverride { get; set; } = true;

        /// <summary>Disable metrics collection</summary>
        public bool DisableMetrics { get; set; }

        /// <summary>Track impressions for all flags</summary>
        public bool ImpressionDataAll { get; set; }

        /// <summary>Disable local statistics tracking (default: false)</summary>
        public bool DisableStats { get; set; }

        /// <summary>Initial delay before first metrics send in seconds (default: 2)</summary>
        public int MetricsIntervalInitial { get; set; } = 2;

        /// <summary>Metrics send interval in seconds (default: 60)</summary>
        public int MetricsInterval { get; set; } = 60;

        /// <summary>Retry limit for fetch requests (default: 3)</summary>
        public int FetchRetryLimit { get; set; } = 3;

        /// <summary>Request timeout in seconds (default: 30)</summary>
        public int FetchTimeout { get; set; } = 30;

        /// <summary>HTTP status codes that should stop polling entirely (default: 401, 403)</summary>
        public int[] NonRetryableStatusCodes { get; set; } = new int[] { 401, 403 };

        /// <summary>Initial backoff delay in seconds for retries (default: 1)</summary>
        public int InitialBackoff { get; set; } = 1;

        /// <summary>Maximum backoff delay in seconds for retries (default: 60)</summary>
        public int MaxBackoff { get; set; } = 60;

        /// <summary>Use POST requests instead of GET for flag fetching (prevents sensitive context fields from appearing in URL)</summary>
        public bool UsePOSTRequests { get; set; }

        /// <summary>Streaming configuration for real-time flag invalidation</summary>
        public StreamingConfig Streaming { get; set; } = new StreamingConfig();
    }

    /// <summary>
    /// Streaming transport type selection
    /// </summary>
    public enum StreamingTransport
    {
        Sse,
        WebSocket
    }

    /// <summary>
    /// Streaming configuration for real-time flag invalidation
    /// </summary>
    public class StreamingConfig
    {
        /// <summary>Enable streaming (default: true)</summary>
        public bool Enabled { get; set; } = true;

        /// <summary>Transport type: SSE or WebSocket (default: SSE)</summary>
        public StreamingTransport Transport { get; set; } = StreamingTransport.Sse;

        /// <summary>SSE-specific configuration</summary>
        public SseStreamingConfig Sse { get; set; } = new SseStreamingConfig();

        /// <summary>WebSocket-specific configuration</summary>
        public WebSocketStreamingConfig WebSocket { get; set; } = new WebSocketStreamingConfig();
    }

    /// <summary>
    /// SSE (Server-Sent Events) streaming configuration
    /// </summary>
    public class SseStreamingConfig
    {
        /// <summary>SSE endpoint URL override (default: derived from apiUrl)</summary>
        public string Url { get; set; }

        /// <summary>Reconnect initial delay in seconds (default: 1)</summary>
        public int ReconnectBase { get; set; } = 1;

        /// <summary>Reconnect max delay in seconds (default: 30)</summary>
        public int ReconnectMax { get; set; } = 30;

        /// <summary>Polling jitter range in seconds to prevent thundering herd (default: 5)</summary>
        public int PollingJitter { get; set; } = 5;
    }

    /// <summary>
    /// WebSocket streaming configuration
    /// </summary>
    public class WebSocketStreamingConfig
    {
        /// <summary>WebSocket endpoint URL override (default: derived from apiUrl)</summary>
        public string Url { get; set; }

        /// <summary>Reconnect initial delay in seconds (default: 1)</summary>
        public int ReconnectBase { get; set; } = 1;

        /// <summary>Reconnect max delay in seconds (default: 30)</summary>
        public int ReconnectMax { get; set; } = 30;

        /// <summary>Client-side ping interval in seconds (default: 30)</summary>
        public int PingInterval { get; set; } = 30;
    }

    /// <summary>
    /// SDK Configuration
    /// </summary>
    public class GatrixClientConfig
    {
        // ==================== Required ====================

        /// <summary>Base API URL (e.g., http://localhost:3400/api/v1)</summary>
        public string ApiUrl { get; set; }

        /// <summary>Client API token</summary>
        public string ApiToken { get; set; }

        /// <summary>Application name</summary>
        public string AppName { get; set; }

        /// <summary>Environment name (required, e.g., 'development', 'production')</summary>
        public string Environment { get; set; }

        // ==================== Common Settings ====================

        /// <summary>Initial context</summary>
        public GatrixContext Context { get; set; }

        /// <summary>Custom storage provider</summary>
        public IStorageProvider StorageProvider { get; set; }

        /// <summary>Custom HTTP headers</summary>
        public Dictionary<string, string> CustomHeaders { get; set; }

        /// <summary>Custom logger implementation</summary>
        public IGatrixLogger Logger { get; set; }

        // ==================== Feature-specific Settings ====================

        /// <summary>Start in offline mode (no network requests, use cached/bootstrap flags)</summary>
        public bool OfflineMode { get; set; }

        /// <summary>Enable dev mode for detailed debug logging (default: false)</summary>
        public bool EnableDevMode { get; set; }

        /// <summary>Cache key prefix for storage keys (default: "gatrix_cache")</summary>
        public string CacheKeyPrefix { get; set; } = "gatrix_cache";

        /// <summary>Feature flags configuration</summary>
        public FeaturesConfig Features { get; set; }
    }

    /// <summary>
    /// Variation result with details (value + reason)
    /// </summary>
    public struct VariationResult<T>
    {
        public T Value { get; set; }
        public string Reason { get; set; }
        public bool FlagExists { get; set; }
        public bool Enabled { get; set; }
    }

    /// <summary>
    /// Error event payload
    /// </summary>
    public class ErrorEvent
    {
        public string Type { get; set; }
        public Exception Error { get; set; }
        public int? Code { get; set; }
    }

    /// <summary>
    /// SDK internal state
    /// </summary>
    public enum SdkState
    {
        Initializing,
        Ready,
        Healthy,
        Error
    }

    /// <summary>
    /// Streaming connection state machine
    /// </summary>
    public enum StreamingConnectionState
    {
        Disconnected,
        Connecting,
        Connected,
        Reconnecting,
        Degraded
    }

    /// <summary>
    /// Common SDK statistics
    /// </summary>
    public class GatrixSdkStats
    {
        public SdkState SdkState { get; set; }
        public DateTime? StartTime { get; set; }
        public string ConnectionId { get; set; }
        public int ErrorCount { get; set; }
        public Exception LastError { get; set; }
        public DateTime? LastErrorTime { get; set; }
        public bool OfflineMode { get; set; }

        /// <summary>Feature flag specific statistics</summary>
        public FeaturesStats Features { get; set; }

        /// <summary>Event handler monitoring statistics (eventName -> list of handlers)</summary>
        public Dictionary<string, List<EventHandlerStats>> EventHandlerStats { get; set; }
    }

    /// <summary>
    /// Event handler statistics
    /// </summary>
    public class EventHandlerStats
    {
        public string Name { get; set; }
        public int CallCount { get; set; }
        public bool IsOnce { get; set; }
        public DateTime RegisteredAt { get; set; }
    }

    /// <summary>
    /// Feature flag specific statistics
    /// </summary>
    public class FeaturesStats
    {
        public int TotalFlagCount { get; set; }
        public Dictionary<string, int> MissingFlags { get; set; }
        public int FetchFlagsCount { get; set; }
        public int UpdateCount { get; set; }
        public int NotModifiedCount { get; set; }
        public int RecoveryCount { get; set; }
        public int ErrorCount { get; set; }
        public SdkState SdkState { get; set; }
        public Exception LastError { get; set; }
        public DateTime? StartTime { get; set; }
        public DateTime? LastFetchTime { get; set; }
        public DateTime? LastUpdateTime { get; set; }
        public DateTime? LastRecoveryTime { get; set; }
        public DateTime? LastErrorTime { get; set; }
        public Dictionary<string, EnabledCount> FlagEnabledCounts { get; set; }
        public Dictionary<string, Dictionary<string, int>> FlagVariantCounts { get; set; }
        public int SyncFlagsCount { get; set; }
        public int ImpressionCount { get; set; }
        public int ContextChangeCount { get; set; }
        public Dictionary<string, DateTime> FlagLastChangedTimes { get; set; }
        public List<string> ActiveWatchGroups { get; set; }
        public string Etag { get; set; }
        public int MetricsSentCount { get; set; }
        public int MetricsErrorCount { get; set; }

        /// <summary>Whether streaming is enabled in configuration</summary>
        public bool StreamingEnabled { get; set; }

        /// <summary>Current streaming connection state</summary>
        public StreamingConnectionState StreamingState { get; set; }

        /// <summary>Current streaming transport type</summary>
        public StreamingTransport StreamingTransport { get; set; }

        /// <summary>Number of streaming reconnection attempts</summary>
        public int StreamingReconnectCount { get; set; }

        /// <summary>Timestamp of last streaming event received</summary>
        public DateTime? LastStreamingEventTime { get; set; }

        /// <summary>Total number of streaming events received</summary>
        public int StreamingEventCount { get; set; }

        /// <summary>Total streaming error count</summary>
        public int StreamingErrorCount { get; set; }

        /// <summary>Total streaming recovery count (successful reconnections)</summary>
        public int StreamingRecoveryCount { get; set; }

        /// <summary>Timestamp of last streaming error</summary>
        public DateTime? LastStreamingErrorTime { get; set; }

        /// <summary>Timestamp of last streaming recovery</summary>
        public DateTime? LastStreamingRecoveryTime { get; set; }

        /// <summary>Last streaming error message</summary>
        public string LastStreamingError { get; set; }
    }

    /// <summary>
    /// Enabled/disabled count pair
    /// </summary>
    public class EnabledCount
    {
        public int Yes { get; set; }
        public int No { get; set; }
    }

    /// <summary>
    /// Helper to parse VariantType from string
    /// </summary>
    public static class ValueTypeHelper
    {
        public static ValueType Parse(string value)
        {
            if (string.IsNullOrEmpty(value)) return ValueType.None;
            switch (value.ToLowerInvariant())
            {
                case "string": return ValueType.String;
                case "number": return ValueType.Number;
                case "boolean": return ValueType.Boolean;
                case "json": return ValueType.Json;
                default: return ValueType.None;
            }
        }

        /// <summary>Alias for Parse - converts an API string to ValueType.</summary>
        public static ValueType FromApiString(string value) => Parse(value);

        public static string ToApiString(ValueType type)
        {
            switch (type)
            {
                case ValueType.String: return "string";
                case ValueType.Number: return "number";
                case ValueType.Boolean: return "boolean";
                case ValueType.Json: return "json";
                default: return "none";
            }
        }
    }


    /// <summary>
    /// SSE flags_changed event data from streaming endpoint
    /// </summary>
    [Serializable]
    public class FlagsChangedEvent
    {
        public long GlobalRevision { get; set; }
        public List<string> ChangedKeys { get; set; }
    }

    /// <summary>
    /// SSE connected event data from streaming endpoint
    /// </summary>
    [Serializable]
    public class StreamingConnectedEvent
    {
        public long GlobalRevision { get; set; }
    }
}
