// GatrixSettings - ScriptableObject for editor-based SDK configuration
// Enables zero-code initialization by configuring settings in the Unity Inspector

using System;
using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// ScriptableObject that stores Gatrix SDK configuration.
    /// Create via Assets > Create > Gatrix > Settings.
    /// Assign to GatrixBehaviour in the scene for zero-code initialization.
    /// </summary>
    [CreateAssetMenu(fileName = "GatrixSettings", menuName = "Gatrix/Settings", order = 1)]
    public class GatrixSettings : ScriptableObject
    {
        // ==================== Required ====================

        [Header("Required")]

        [Tooltip("Base API URL (e.g., https://your-server.com/api/v1)")]
        [SerializeField] private string _apiUrl;

        [Tooltip("Client API token")]
        [SerializeField] private string _apiToken;

        [Tooltip("Application name")]
        [SerializeField] private string _appName;

        [Tooltip("Environment name (e.g., development, staging, production)")]
        [SerializeField] private string _environment;

        // ==================== Context ====================

        [Header("Initial Context")]

        [Tooltip("Initial user ID (optional)")]
        [SerializeField] private string _userId;

        [Tooltip("Initial session ID (optional)")]
        [SerializeField] private string _sessionId;

        // ==================== General Settings ====================

        [Header("General")]

        [Tooltip("Start in offline mode (no network requests)")]
        [SerializeField] private bool _offlineMode;

        [Tooltip("Enable detailed debug logging")]
        [SerializeField] private bool _enableDevMode;

        [Tooltip("Cache key prefix for storage")]
        [SerializeField] private string _cacheKeyPrefix = "gatrix_cache";

        [Tooltip("Track impressions for all flags")]
        [SerializeField] private bool _impressionDataAll;

        // ==================== Polling Settings ====================

        [Header("Polling")]

        [Tooltip("Seconds between flag refresh polls (1-86400)")]
        [Range(1, 86400)]
        [SerializeField] private int _refreshInterval = 30;

        [Tooltip("Disable automatic polling")]
        [SerializeField] private bool _disableRefresh;

        [Tooltip("Enable explicit sync mode")]
        [SerializeField] private bool _explicitSyncMode;

        // ==================== Metrics Settings ====================

        [Header("Metrics")]

        [Tooltip("Disable metrics collection")]
        [SerializeField] private bool _disableMetrics;

        [Tooltip("Initial delay before first metrics send in seconds")]
        [Range(0, 3600)]
        [SerializeField] private int _metricsIntervalInitial = 2;

        [Tooltip("Metrics send interval in seconds")]
        [Range(1, 86400)]
        [SerializeField] private int _metricsInterval = 60;

        // ==================== Network Settings ====================

        [Header("Network")]

        [Tooltip("Retry limit for fetch requests (0-10)")]
        [Range(0, 10)]
        [SerializeField] private int _fetchRetryLimit = 3;

        [Tooltip("Request timeout in seconds (1-120)")]
        [Range(1, 120)]
        [SerializeField] private int _fetchTimeout = 30;

        [Tooltip("Initial backoff delay in seconds for retries")]
        [Range(1, 60)]
        [SerializeField] private int _initialBackoff = 1;

        [Tooltip("Maximum backoff delay in seconds for retries")]
        [Range(1, 600)]
        [SerializeField] private int _maxBackoff = 60;

        // ==================== Streaming Settings ====================

        [Header("Streaming (SSE)")]

        [Tooltip("Enable real-time streaming via SSE")]
        [SerializeField] private bool _streamingEnabled = true;

        [Tooltip("Streaming endpoint URL override (leave empty for auto-derive)")]
        [SerializeField] private string _streamingUrl;

        [Tooltip("Reconnect initial delay in seconds")]
        [Range(1, 60)]
        [SerializeField] private int _reconnectBase = 1;

        [Tooltip("Reconnect max delay in seconds")]
        [Range(1, 300)]
        [SerializeField] private int _reconnectMax = 30;

        // ==================== Public API ====================

        /// <summary>Build a GatrixClientConfig from these settings</summary>
        public GatrixClientConfig ToConfig()
        {
            var config = new GatrixClientConfig
            {
                ApiUrl = _apiUrl,
                ApiToken = _apiToken,
                AppName = _appName,
                Environment = _environment,
                OfflineMode = _offlineMode,
                EnableDevMode = _enableDevMode,
                CacheKeyPrefix = _cacheKeyPrefix,
                Features = new FeaturesConfig
                {
                    RefreshInterval = _refreshInterval,
                    DisableRefresh = _disableRefresh,
                    ExplicitSyncMode = _explicitSyncMode,
                    DisableMetrics = _disableMetrics,
                    ImpressionDataAll = _impressionDataAll,
                    MetricsIntervalInitial = _metricsIntervalInitial,
                    MetricsInterval = _metricsInterval,
                    FetchRetryLimit = _fetchRetryLimit,
                    FetchTimeout = _fetchTimeout,
                    InitialBackoff = _initialBackoff,
                    MaxBackoff = _maxBackoff,
                    Streaming = new StreamingConfig
                    {
                        Enabled = _streamingEnabled,
                        Url = string.IsNullOrEmpty(_streamingUrl) ? null : _streamingUrl,
                        ReconnectBase = _reconnectBase,
                        ReconnectMax = _reconnectMax
                    }
                }
            };

            // Set initial context if userId or sessionId provided
            if (!string.IsNullOrEmpty(_userId) || !string.IsNullOrEmpty(_sessionId))
            {
                config.Context = new GatrixContext
                {
                    UserId = string.IsNullOrEmpty(_userId) ? null : _userId,
                    SessionId = string.IsNullOrEmpty(_sessionId) ? null : _sessionId
                };
            }

            return config;
        }

        /// <summary>Validate that required fields are set</summary>
        public bool IsValid(out string error)
        {
            if (string.IsNullOrWhiteSpace(_apiUrl))
            {
                error = "API URL is required";
                return false;
            }
            if (string.IsNullOrWhiteSpace(_apiToken))
            {
                error = "API Token is required";
                return false;
            }
            if (string.IsNullOrWhiteSpace(_appName))
            {
                error = "App Name is required";
                return false;
            }
            if (string.IsNullOrWhiteSpace(_environment))
            {
                error = "Environment is required";
                return false;
            }
            error = null;
            return true;
        }
    }
}
