// FeaturesClient - Core: fields, constructor, lifecycle, and shared helpers
// Feature Flags client for Gatrix Unity SDK
// async/await based, GC-optimized for Unity runtime

using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Threading;
using Cysharp.Threading.Tasks;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Feature flags client. Handles fetching, caching, polling, and flag access.
    /// All flag access methods (IsEnabled, *Variation, etc.) are synchronous and read from in-memory cache.
    /// </summary>
    public partial class FeaturesClient : IFeaturesClient, IVariationProvider
    {
        // Storage keys (built with CacheKeyPrefix at construction time)
        private string StorageKeyFlags;
        private string StorageKeySession;
        private string StorageKeyEtag;

        // System context fields that cannot be removed
        private static readonly HashSet<string> SystemContextFields
            = new HashSet<string> { "appName", "environment" };
        private static readonly HashSet<string> DefinedFields
            = new HashSet<string> { "userId", "sessionId", "currentTime" };

        private readonly GatrixEventEmitter _emitter;
        private readonly GatrixClientConfig _config;
        private readonly IStorageProvider _storage;
        private readonly IGatrixLogger _logger;
        private readonly HttpClient _httpClient;
        private readonly Metrics _metrics;

        // Flag storage
        private readonly Dictionary<string, EvaluatedFlag> _realtimeFlags
            = new Dictionary<string, EvaluatedFlag>();
        private Dictionary<string, EvaluatedFlag> _synchronizedFlags
            = new Dictionary<string, EvaluatedFlag>();

        // Context
        private GatrixContext _context = new GatrixContext();

        // State
        private SdkState _sdkState = SdkState.Initializing;
        private Exception _lastError;
        private bool _started;
        private bool _readyEventEmitted;
        private bool _fetchedFromServer;
        private bool _isFetchingFlags;
        private bool _pendingInvalidation;
        private CancellationTokenSource _pollCts;
        private CancellationTokenSource _fetchCts;
        private string _etag = "";
        private readonly int _refreshIntervalMs;
        private readonly string _connectionId;
        private string _lastContextHash = "";
        private int _consecutiveFailures;
        private bool _pollingStopped;

        // Streaming state
        private StreamingConnectionState _streamingState = StreamingConnectionState.Disconnected;
        private CancellationTokenSource _streamingCts;
        private int _streamingReconnectAttempt;
        private CancellationTokenSource _streamingReconnectCts;
        private int _streamingReconnectCount;
        private DateTime? _lastStreamingEventTime;
        private int _streamingEventCount;
        private int _streamingErrorCount;
        private int _streamingRecoveryCount;
        private DateTime? _lastStreamingErrorTime;
        private DateTime? _lastStreamingRecoveryTime;
        private string _lastStreamingError;
        private long _localGlobalRevision;

        // WebSocket state
        private IGatrixWebSocket _gatrixWs;
        private CancellationTokenSource _wsPingCts;

        // Captured Unity SynchronizationContext for thread-safe callbacks
        private readonly SynchronizationContext _syncContext;

        // Statistics tracking
        private int _fetchFlagsCount;
        private int _updateCount;
        private int _notModifiedCount;
        private int _errorCount;
        private int _recoveryCount;
        private int _impressionCount;
        private int _contextChangeCount;
        private DateTime? _lastFetchTime;
        private DateTime? _lastUpdateTime;
        private DateTime? _lastErrorTime;
        private DateTime? _lastRecoveryTime;
        private DateTime? _startTime;
        private int _syncFlagsCount;
        private int _metricsSentCount;
        private int _metricsErrorCount;
        private bool _pendingSync;
        private readonly Dictionary<string, WatchFlagGroup> _watchGroups
            = new Dictionary<string, WatchFlagGroup>();
        private readonly Dictionary<string, EnabledCount> _flagEnabledCounts
            = new Dictionary<string, EnabledCount>();
        private readonly Dictionary<string, Dictionary<string, int>> _flagVariantCounts
            = new Dictionary<string, Dictionary<string, int>>();
        private readonly Dictionary<string, DateTime> _flagLastChangedTimes
            = new Dictionary<string, DateTime>();
        private readonly Dictionary<string, List<GatrixFlagWatchHandler>> _watchCallbacks
            = new Dictionary<string, List<GatrixFlagWatchHandler>>();
        private readonly Dictionary<string, List<GatrixFlagWatchHandler>> _syncedWatchCallbacks
            = new Dictionary<string, List<GatrixFlagWatchHandler>>();

        // Feature-specific config shortcut
        private FeaturesConfig FeaturesConfig => _config.Features ?? new FeaturesConfig();

        private readonly GatrixDevLogger _devLog;

        public FeaturesClient(GatrixEventEmitter emitter, GatrixClientConfig config, HttpClient httpClient)
        {
            _emitter = emitter;
            _config = new GatrixClientConfig
            {
                ApiUrl = config.ApiUrl?.TrimEnd('/'),
                ApiToken = config.ApiToken,
                AppName = config.AppName,
                Environment = config.Environment,
                Context = config.Context,
                StorageProvider = config.StorageProvider,
                CustomHeaders = config.CustomHeaders,
                Logger = config.Logger,
                OfflineMode = config.OfflineMode,
                EnableDevMode = config.EnableDevMode,
                CacheKeyPrefix = config.CacheKeyPrefix,
                Features = config.Features
            };
            _httpClient = httpClient;
            _connectionId = Guid.NewGuid().ToString();

            // Capture the SynchronizationContext (Unity main thread)
            // This ensures polling callbacks always run on the main thread
            _syncContext = SynchronizationContext.Current;

            // Initialize storage keys with prefix
            var prefix = _config.CacheKeyPrefix ?? "gatrix_cache";
            StorageKeyFlags = $"{prefix}_flags";
            StorageKeySession = $"{prefix}_sessionId";
            StorageKeyEtag = $"{prefix}_etag";

            // Initialize storage
            _storage = config.StorageProvider ?? new InMemoryStorageProvider();

            // Initialize logger
            _logger = config.Logger ?? new UnityGatrixLogger("GatrixFeatureClient");
            _devLog = new GatrixDevLogger(_logger, config.EnableDevMode);

            // Refresh interval
            var featCfg = FeaturesConfig;
            _refreshIntervalMs = featCfg.DisableRefresh ? 0 : featCfg.RefreshInterval * 1000;

            // Initial context with system fields
            _context = new GatrixContext
            {
                AppName = config.AppName,
                Environment = config.Environment
            };
            if (config.Context != null)
            {
                _context.UserId = config.Context.UserId;
                _context.SessionId = config.Context.SessionId;
                _context.CurrentTime = config.Context.CurrentTime;
                if (config.Context.Properties != null)
                {
                    _context.Properties = new Dictionary<string, object>(config.Context.Properties);
                }
            }

            // Initialize metrics
            _metrics = new Metrics(
                config.AppName,
                _config.ApiUrl,
                config.ApiToken,
                config.Environment,
                config.CustomHeaders,
                featCfg.DisableMetrics,
                config.EnableDevMode,
                _logger,
                _connectionId,
                _emitter,
                _httpClient
            );

            // Handle metrics events for statistics
            _emitter.On(GatrixEvents.FlagsMetricsSent, _ => { _metricsSentCount++; });
            _emitter.On(GatrixEvents.FlagsMetricsError, _ => { _metricsErrorCount++; });

            // Bootstrap data
            var bootstrap = featCfg.Bootstrap;
            if (bootstrap != null && bootstrap.Count > 0)
            {
                SetFlags(bootstrap);
            }
        }

        /// <summary>Get client connection ID</summary>
        public string GetConnectionId() => _connectionId;

        /// <summary>Initialize the features client</summary>
        public async UniTask InitAsync()
        {
            // Resolve session ID
            var sessionId = await ResolveSessionIdAsync();
            _context.SessionId = sessionId;

            // Load cached etag
            var cachedEtag = await _storage.GetAsync(StorageKeyEtag);
            if (!string.IsNullOrEmpty(cachedEtag))
            {
                _etag = cachedEtag;
            }

            // Load cached flags
            var cachedFlagsJson = await _storage.GetAsync(StorageKeyFlags);
            if (!string.IsNullOrEmpty(cachedFlagsJson))
            {
                var cachedFlags = GatrixJson.DeserializeFlags(cachedFlagsJson);
                if (cachedFlags != null && cachedFlags.Count > 0)
                {
                    SetFlags(cachedFlags, forceSync: true);
                    // Mark as ready if we have cached flags (provides offline-first experience)
                    if (!_readyEventEmitted)
                    {
                        SetReady();
                    }
                }
            }

            // Handle bootstrap
            var featCfg = FeaturesConfig;
            var bootstrap = featCfg.Bootstrap;
            var hasBootstrap = bootstrap != null && bootstrap.Count > 0;
            var bootstrapOverride = featCfg.BootstrapOverride;

            _sdkState = SdkState.Healthy;
            _emitter.Emit(GatrixEvents.FlagsInit);

            if (hasBootstrap && (bootstrapOverride || _realtimeFlags.Count == 0))
            {
                var flagsJson = GatrixJson.SerializeFlags(bootstrap);
                await _storage.SaveAsync(StorageKeyFlags, flagsJson);
                SetFlags(bootstrap, forceSync: true);
                SetReady();
            }
        }

        /// <summary>Start polling for flag updates</summary>
        public async UniTask StartAsync()
        {
            if (_started) return;
            _started = true;
            _startTime = DateTime.UtcNow;
            _consecutiveFailures = 0;
            _pollingStopped = false;

            _devLog.Log($"start() called. offlineMode={_config.OfflineMode}, refreshIntervalMs={_refreshIntervalMs}, explicitSyncMode={FeaturesConfig.ExplicitSyncMode}");

            // Offline mode: use cached/bootstrap flags only
            if (_config.OfflineMode)
            {
                if (_realtimeFlags.Count == 0)
                {
                    var error = new GatrixException(
                        "offlineMode requires bootstrap data or cached flags, but none are available");
                    _sdkState = SdkState.Error;
                    _lastError = error;
                    _emitter.Emit(GatrixEvents.FlagsError, new ErrorEvent
                    {
                        Type = "offline_no_data", Error = error
                    });
                    throw error;
                }
                SetReady();
                StartMetrics();
                return;
            }

            // Initial fetch (ScheduleNextRefresh is called inside FetchFlagsAsync on completion)
            await FetchFlagsAsync();

            // Start streaming if enabled
            if (FeaturesConfig.Streaming.Enabled)
            {
                ConnectStreaming();
            }

            // Start metrics
            StartMetrics();
        }

        /// <summary>Stop polling and streaming</summary>
        public void Stop()
        {
            _devLog.Log("stop() called");
            _pollCts?.Cancel();
            _pollCts?.Dispose();
            _pollCts = null;

            _fetchCts?.Cancel();
            _fetchCts?.Dispose();
            _fetchCts = null;

            DisconnectStreaming();

            _metrics.Stop();
            _started = false;
            _pollingStopped = true;
            _consecutiveFailures = 0;
        }

        /// <summary>Check if SDK is ready</summary>
        public bool IsReady() => _readyEventEmitted;

        /// <summary>Get last error</summary>
        public Exception GetError() => _sdkState == SdkState.Error ? _lastError : null;

        // ==================== Private Helpers ====================

        /// <summary>
        /// Post an action to the main thread via MainThreadDispatcher.
        /// Falls back to direct invocation if already on main thread.
        /// </summary>
        private void PostToMainThread(Action action)
        {
            MainThreadDispatcher.Enqueue(action);
        }

        private void SetReady()
        {
            _readyEventEmitted = true;
            _emitter.Emit(GatrixEvents.FlagsReady);
        }

        private void StartMetrics()
        {
            var featCfg = FeaturesConfig;
            _metrics.Start(featCfg.MetricsInterval * 1000, featCfg.MetricsIntervalInitial * 1000);
        }

        private Dictionary<string, EvaluatedFlag> SelectFlags(bool forceRealtime = false)
        {
            if (forceRealtime) return _realtimeFlags;
            return FeaturesConfig.ExplicitSyncMode ? _synchronizedFlags : _realtimeFlags;
        }

        private void SetFlags(List<EvaluatedFlag> flags, bool forceSync = false)
        {
            _realtimeFlags.Clear();
            for (int i = 0; i < flags.Count; i++)
            {
                _realtimeFlags[flags[i].Name] = flags[i];
            }

            if (!FeaturesConfig.ExplicitSyncMode || forceSync)
            {
                _synchronizedFlags = new Dictionary<string, EvaluatedFlag>(_realtimeFlags);
                _pendingSync = false;
            }
            else
            {
                if (!_pendingSync)
                {
                    _pendingSync = true;
                    _emitter.Emit(GatrixEvents.FlagsPendingSync);
                }
            }
        }

        private static void AppendContextQueryParams(StringBuilder sb, GatrixContext context)
        {
            var first = true;

            void AppendParam(string key, string value)
            {
                if (string.IsNullOrEmpty(value)) return;
                if (!first) sb.Append('&');
                first = false;
                sb.Append(Uri.EscapeDataString(key));
                sb.Append('=');
                sb.Append(Uri.EscapeDataString(value));
            }

            AppendParam("appName", context.AppName);
            AppendParam("environment", context.Environment);
            AppendParam("userId", context.UserId);
            AppendParam("sessionId", context.SessionId);
            AppendParam("currentTime", context.CurrentTime);

            if (context.Properties != null)
            {
                foreach (var kvp in context.Properties)
                {
                    if (kvp.Value != null)
                    {
                        AppendParam($"properties[{kvp.Key}]", kvp.Value.ToString());
                    }
                }
            }
        }

        private static string ComputeContextHash(GatrixContext context)
        {
            // Simple hash: concatenate sorted fields
            var sb = new StringBuilder(128);
            sb.Append(context.AppName ?? "");
            sb.Append('|');
            sb.Append(context.Environment ?? "");
            sb.Append('|');
            sb.Append(context.UserId ?? "");
            sb.Append('|');
            sb.Append(context.SessionId ?? "");
            sb.Append('|');
            sb.Append(context.CurrentTime ?? "");

            if (context.Properties != null)
            {
                // Sort for deterministic hash
                var keys = new List<string>(context.Properties.Keys);
                keys.Sort(StringComparer.Ordinal);
                foreach (var key in keys)
                {
                    sb.Append('|');
                    sb.Append(key);
                    sb.Append('=');
                    sb.Append(context.Properties[key]?.ToString() ?? "");
                }
            }

            return sb.ToString();
        }

        private static HttpRequestMessage CloneRequest(HttpRequestMessage original)
        {
            var clone = new HttpRequestMessage(original.Method, original.RequestUri);
            foreach (var header in original.Headers)
            {
                clone.Headers.TryAddWithoutValidation(header.Key, header.Value);
            }
            if (original.Content != null)
            {
                clone.Content = original.Content;
            }
            return clone;
        }
    }
}
