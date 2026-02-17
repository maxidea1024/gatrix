// FeaturesClient - Feature Flags client for Gatrix Unity SDK
// Handles feature flag fetching, caching, and access
// async/await based, GC-optimized for Unity runtime

using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Feature flags client. Handles fetching, caching, polling, and flag access.
    /// All flag access methods (IsEnabled, *Variation, etc.) are synchronous and read from in-memory cache.
    /// </summary>
    public class FeaturesClient : IFeaturesClient, IVariationProvider
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
        private long _localGlobalRevision;

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

        // Feature-specific config shortcut
        private FeaturesConfig FeaturesConfig => _config.Features ?? new FeaturesConfig();

        /// <summary>
        /// Log detailed debug information only when devMode is enabled
        /// </summary>
        private void DevLog(string message)
        {
            if (_config.EnableDevMode)
            {
                _logger?.Debug($"[DEV] {message}");
            }
        }

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
        public async ValueTask InitAsync()
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
        public async ValueTask StartAsync()
        {
            if (_started) return;
            _started = true;
            _startTime = DateTime.UtcNow;
            _consecutiveFailures = 0;
            _pollingStopped = false;

            DevLog($"start() called. offlineMode={_config.OfflineMode}, refreshIntervalMs={_refreshIntervalMs}, explicitSyncMode={FeaturesConfig.ExplicitSyncMode}");

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
            if (FeaturesConfig.EnableStreaming)
            {
                ConnectStreaming();
            }

            // Start metrics
            StartMetrics();
        }

        /// <summary>Stop polling and streaming</summary>
        public void Stop()
        {
            DevLog("stop() called");
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

        // ==================== Context Management ====================

        /// <summary>Get a deep copy of the current context</summary>
        public GatrixContext GetContext() => _context.Clone();

        /// <summary>Update context and re-fetch flags</summary>
        public async ValueTask UpdateContextAsync(GatrixContext context)
        {
            // Filter out system fields; apply user context
            if (context.UserId != null) _context.UserId = context.UserId;
            if (context.SessionId != null) _context.SessionId = context.SessionId;
            if (context.CurrentTime != null) _context.CurrentTime = context.CurrentTime;
            if (context.Properties != null)
            {
                if (_context.Properties == null)
                    _context.Properties = new Dictionary<string, object>();
                foreach (var kvp in context.Properties)
                {
                    _context.Properties[kvp.Key] = kvp.Value;
                }
            }

            // Check if context actually changed
            var newHash = ComputeContextHash(_context);
            if (newHash == _lastContextHash) return;

            _lastContextHash = newHash;
            _contextChangeCount++;
            await FetchFlagsAsync();
        }

        /// <summary>Set a single context field and re-fetch flags</summary>
        public async ValueTask SetContextFieldAsync(string field, object value)
        {
            if (SystemContextFields.Contains(field))
            {
                _logger.Warn($"Cannot modify system context field: {field}");
                return;
            }

            if (DefinedFields.Contains(field))
            {
                switch (field)
                {
                    case "userId": _context.UserId = value?.ToString(); break;
                    case "sessionId": _context.SessionId = value?.ToString(); break;
                    case "currentTime": _context.CurrentTime = value?.ToString(); break;
                }
            }
            else
            {
                if (_context.Properties == null)
                    _context.Properties = new Dictionary<string, object>();
                _context.Properties[field] = value;
            }

            await ApplyContextChange();
        }

        /// <summary>Set a string context field and re-fetch flags (boxing-free for system fields)</summary>
        public async ValueTask SetContextFieldAsync(string field, string value)
        {
            if (SystemContextFields.Contains(field))
            {
                _logger.Warn($"Cannot modify system context field: {field}");
                return;
            }

            if (DefinedFields.Contains(field))
            {
                switch (field)
                {
                    case "userId": _context.UserId = value; break;
                    case "sessionId": _context.SessionId = value; break;
                    case "currentTime": _context.CurrentTime = value; break;
                }
            }
            else
            {
                if (_context.Properties == null)
                    _context.Properties = new Dictionary<string, object>();
                _context.Properties[field] = value;
            }

            await ApplyContextChange();
        }

        /// <summary>Set a boolean context field and re-fetch flags</summary>
        public async ValueTask SetContextFieldAsync(string field, bool value)
        {
            if (SystemContextFields.Contains(field))
            {
                _logger.Warn($"Cannot modify system context field: {field}");
                return;
            }

            if (DefinedFields.Contains(field))
            {
                switch (field)
                {
                    case "userId": _context.UserId = value.ToString(); break;
                    case "sessionId": _context.SessionId = value.ToString(); break;
                    case "currentTime": _context.CurrentTime = value.ToString(); break;
                }
            }
            else
            {
                if (_context.Properties == null)
                    _context.Properties = new Dictionary<string, object>();
                _context.Properties[field] = value;
            }

            await ApplyContextChange();
        }

        /// <summary>Set a numeric context field and re-fetch flags</summary>
        public async ValueTask SetContextFieldAsync(string field, double value)
        {
            if (SystemContextFields.Contains(field))
            {
                _logger.Warn($"Cannot modify system context field: {field}");
                return;
            }

            if (DefinedFields.Contains(field))
            {
                switch (field)
                {
                    case "userId": _context.UserId = value.ToString(CultureInfo.InvariantCulture); break;
                    case "sessionId": _context.SessionId = value.ToString(CultureInfo.InvariantCulture); break;
                    case "currentTime": _context.CurrentTime = value.ToString(CultureInfo.InvariantCulture); break;
                }
            }
            else
            {
                if (_context.Properties == null)
                    _context.Properties = new Dictionary<string, object>();
                _context.Properties[field] = value;
            }

            await ApplyContextChange();
        }

        /// <summary>Set an integer context field and re-fetch flags</summary>
        public async ValueTask SetContextFieldAsync(string field, int value)
        {
            await SetContextFieldAsync(field, (double)value);
        }

        /// <summary>Remove a context field and re-fetch flags</summary>
        public async ValueTask RemoveContextFieldAsync(string field)
        {
            if (SystemContextFields.Contains(field))
            {
                _logger.Warn($"Cannot remove system context field: {field}");
                return;
            }

            if (DefinedFields.Contains(field))
            {
                switch (field)
                {
                    case "userId": _context.UserId = null; break;
                    case "sessionId": _context.SessionId = null; break;
                    case "currentTime": _context.CurrentTime = null; break;
                }
            }
            else
            {
                _context.Properties?.Remove(field);
            }

            await ApplyContextChange();
        }

        private async ValueTask ApplyContextChange()
        {
            var newHash = ComputeContextHash(_context);
            if (newHash == _lastContextHash) return;
            _lastContextHash = newHash;
            _contextChangeCount++;
            await FetchFlagsAsync();
        }

        // ==================== Flag Access ====================

        /// <summary>Lookup a flag from the active cache.</summary>
        private EvaluatedFlag LookupFlag(string flagName, bool forceRealtime = false)
        {
            var flags = SelectFlags(forceRealtime);
            flags.TryGetValue(flagName, out var flag);
            return flag;
        }

        /// <summary>Check if a flag exists</summary>
        public bool HasFlag(string flagName) => LookupFlag(flagName) != null;

        /// <summary>Create a FlagProxy. Used internally by WatchFlag, not part of public API.
        /// Always reads from realtimeFlags — watch callbacks must reflect
        /// the latest server state regardless of explicitSyncMode.</summary>
        internal FlagProxy CreateProxy(string flagName)
        {
            var flag = LookupFlag(flagName, forceRealtime: true);
            return new FlagProxy(flag, this, flagName);
        }

        /// <summary>Get all flags</summary>
        public List<EvaluatedFlag> GetAllFlags()
        {
            var flags = SelectFlags();
            var result = new List<EvaluatedFlag>(flags.Count);
            foreach (var kvp in flags)
            {
                result.Add(kvp.Value);
            }
            return result;
        }

        // ==================== VariationProvider Internal Methods ====================
        // All flag lookup + value extraction + metrics tracking happen here.

        public bool IsEnabledInternal(string flagName, bool forceRealtime = false)
        {
            var flag = LookupFlag(flagName, forceRealtime);
            if (flag == null)
            {
                TrackFlagAccess(flagName, null, "isEnabled");
                return false;
            }
            TrackFlagAccess(flagName, flag, "isEnabled", flag.Variant?.Name);
            return flag.Enabled;
        }

        public Variant GetVariantInternal(string flagName, bool forceRealtime = false)
        {
            var flag = LookupFlag(flagName, forceRealtime);
            if (flag == null)
            {
                TrackFlagAccess(flagName, null, "getVariant");
                return new Variant { Name = VariantSource.Missing, Enabled = false };
            }
            TrackFlagAccess(flagName, flag, "getVariant", flag.Variant?.Name);
            return flag.Variant;
        }

        public string VariationInternal(string flagName, string fallbackValue, bool forceRealtime = false)
        {
            var flag = LookupFlag(flagName, forceRealtime);
            if (flag == null)
            {
                TrackFlagAccess(flagName, null, "getVariant");
                return fallbackValue;
            }
            TrackFlagAccess(flagName, flag, "getVariant", flag.Variant?.Name);
            return flag.Variant?.Name ?? fallbackValue;
        }

        public bool BoolVariationInternal(string flagName, bool fallbackValue, bool forceRealtime = false)
        {
            var flag = LookupFlag(flagName, forceRealtime);
            if (flag == null)
            {
                TrackFlagAccess(flagName, null, "getVariant");
                return fallbackValue;
            }
            TrackFlagAccess(flagName, flag, "getVariant", flag.Variant?.Name);
            if (flag.ValueType != ValueType.Boolean) return fallbackValue;
            var val = flag.Variant?.Value;
            if (val == null) return fallbackValue;
            if (val is bool b) return b;
            if (val is string s) return s.ToLowerInvariant() == "true";
            try { return Convert.ToBoolean(val, CultureInfo.InvariantCulture); }
            catch { return fallbackValue; }
        }

        public string StringVariationInternal(string flagName, string fallbackValue, bool forceRealtime = false)
        {
            var flag = LookupFlag(flagName, forceRealtime);
            if (flag == null)
            {
                TrackFlagAccess(flagName, null, "getVariant");
                return fallbackValue;
            }
            TrackFlagAccess(flagName, flag, "getVariant", flag.Variant?.Name);
            if (flag.ValueType != ValueType.String) return fallbackValue;
            var val = flag.Variant?.Value;
            return val?.ToString() ?? fallbackValue;
        }

        public int IntVariationInternal(string flagName, int fallbackValue, bool forceRealtime = false)
        {
            var flag = LookupFlag(flagName, forceRealtime);
            if (flag == null)
            {
                TrackFlagAccess(flagName, null, "getVariant");
                return fallbackValue;
            }
            TrackFlagAccess(flagName, flag, "getVariant", flag.Variant?.Name);
            if (flag.ValueType != ValueType.Number) return fallbackValue;
            var val = flag.Variant?.Value;
            if (val == null) return fallbackValue;
            try { return Convert.ToInt32(val, CultureInfo.InvariantCulture); }
            catch { return fallbackValue; }
        }

        public float FloatVariationInternal(string flagName, float fallbackValue, bool forceRealtime = false)
        {
            var flag = LookupFlag(flagName, forceRealtime);
            if (flag == null)
            {
                TrackFlagAccess(flagName, null, "getVariant");
                return fallbackValue;
            }
            TrackFlagAccess(flagName, flag, "getVariant", flag.Variant?.Name);
            if (flag.ValueType != ValueType.Number) return fallbackValue;
            var val = flag.Variant?.Value;
            if (val == null) return fallbackValue;
            try { return Convert.ToSingle(val, CultureInfo.InvariantCulture); }
            catch { return fallbackValue; }
        }

        public double DoubleVariationInternal(string flagName, double fallbackValue, bool forceRealtime = false)
        {
            var flag = LookupFlag(flagName, forceRealtime);
            if (flag == null)
            {
                TrackFlagAccess(flagName, null, "getVariant");
                return fallbackValue;
            }
            TrackFlagAccess(flagName, flag, "getVariant", flag.Variant?.Name);
            if (flag.ValueType != ValueType.Number) return fallbackValue;
            var val = flag.Variant?.Value;
            if (val == null) return fallbackValue;
            try { return Convert.ToDouble(val, CultureInfo.InvariantCulture); }
            catch { return fallbackValue; }
        }

        public Dictionary<string, object> JsonVariationInternal(
            string flagName, Dictionary<string, object> fallbackValue, bool forceRealtime = false)
        {
            var flag = LookupFlag(flagName, forceRealtime);
            if (flag == null)
            {
                TrackFlagAccess(flagName, null, "getVariant");
                return fallbackValue;
            }
            TrackFlagAccess(flagName, flag, "getVariant", flag.Variant?.Name);
            if (flag.ValueType != ValueType.Json) return fallbackValue;
            var val = flag.Variant?.Value;
            if (val == null) return fallbackValue;
            if (val is Dictionary<string, object> dict) return dict;
            if (val is string jsonStr)
            {
                var parsed = GatrixJson.DeserializeDictionary(jsonStr);
                return parsed ?? fallbackValue;
            }
            return fallbackValue;
        }

        // -------------------- Variation Details Internal --------------------

        private VariationResult<T> MakeDetails<T>(string flagName, T value, string expectedType)
        {
            var flag = LookupFlag(flagName);
            var exists = flag != null;
            string reason;
            if (!exists)
            {
                reason = "flag_not_found";
            }
            else if (ValueTypeHelper.ToApiString(flag.ValueType) != expectedType)
            {
                reason = $"type_mismatch:expected_{expectedType}_got_{ValueTypeHelper.ToApiString(flag.ValueType)}";
            }
            else
            {
                reason = string.IsNullOrEmpty(flag.Reason) ? "evaluated" : flag.Reason;
            }
            return new VariationResult<T>
            {
                Value = value,
                Reason = reason,
                FlagExists = exists,
                Enabled = exists && flag.Enabled
            };
        }

        public VariationResult<bool> BoolVariationDetailsInternal(string flagName, bool fallbackValue, bool forceRealtime = false)
            => MakeDetails(flagName, BoolVariationInternal(flagName, fallbackValue, forceRealtime), "boolean");

        public VariationResult<string> StringVariationDetailsInternal(string flagName, string fallbackValue, bool forceRealtime = false)
            => MakeDetails(flagName, StringVariationInternal(flagName, fallbackValue, forceRealtime), "string");

        public VariationResult<int> IntVariationDetailsInternal(string flagName, int fallbackValue, bool forceRealtime = false)
            => MakeDetails(flagName, IntVariationInternal(flagName, fallbackValue, forceRealtime), "number");

        public VariationResult<float> FloatVariationDetailsInternal(string flagName, float fallbackValue, bool forceRealtime = false)
            => MakeDetails(flagName, FloatVariationInternal(flagName, fallbackValue, forceRealtime), "number");

        public VariationResult<double> DoubleVariationDetailsInternal(string flagName, double fallbackValue, bool forceRealtime = false)
            => MakeDetails(flagName, DoubleVariationInternal(flagName, fallbackValue, forceRealtime), "number");

        public VariationResult<Dictionary<string, object>> JsonVariationDetailsInternal(
            string flagName, Dictionary<string, object> fallbackValue, bool forceRealtime = false)
            => MakeDetails(flagName, JsonVariationInternal(flagName, fallbackValue, forceRealtime), "json");

        // -------------------- OrThrow Internal --------------------

        private EvaluatedFlag LookupFlagOrThrow(string flagName)
        {
            var flag = LookupFlag(flagName);
            if (flag == null)
            {
                TrackFlagAccess(flagName, null, "getVariant");
                throw new GatrixFeatureException($"Flag '{flagName}' not found");
            }
            TrackFlagAccess(flagName, flag, "getVariant", flag.Variant?.Name);
            return flag;
        }

        private void ThrowTypeMismatch(string flagName, string expected, ValueType actual)
        {
            throw new GatrixFeatureException(
                $"Flag '{flagName}' type mismatch: expected {expected}, got {ValueTypeHelper.ToApiString(actual)}");
        }

        public bool BoolVariationOrThrowInternal(string flagName, bool forceRealtime = false)
        {
            var flag = LookupFlagOrThrow(flagName);
            if (flag.ValueType != ValueType.Boolean) ThrowTypeMismatch(flagName, "boolean", flag.ValueType);
            var val = flag.Variant?.Value;
            if (val == null) throw new GatrixFeatureException($"Flag '{flagName}' has no boolean value");
            if (val is bool b) return b;
            if (val is string s) return s.ToLowerInvariant() == "true";
            return Convert.ToBoolean(val, CultureInfo.InvariantCulture);
        }

        public string StringVariationOrThrowInternal(string flagName, bool forceRealtime = false)
        {
            var flag = LookupFlagOrThrow(flagName);
            if (flag.ValueType != ValueType.String) ThrowTypeMismatch(flagName, "string", flag.ValueType);
            var val = flag.Variant?.Value;
            if (val == null) throw new GatrixFeatureException($"Flag '{flagName}' has no string value");
            return val.ToString();
        }

        public int IntVariationOrThrowInternal(string flagName, bool forceRealtime = false)
        {
            var flag = LookupFlagOrThrow(flagName);
            if (flag.ValueType != ValueType.Number) ThrowTypeMismatch(flagName, "number", flag.ValueType);
            var val = flag.Variant?.Value;
            if (val == null) throw new GatrixFeatureException($"Flag '{flagName}' has no number value");
            return Convert.ToInt32(val, CultureInfo.InvariantCulture);
        }

        public float FloatVariationOrThrowInternal(string flagName, bool forceRealtime = false)
        {
            var flag = LookupFlagOrThrow(flagName);
            if (flag.ValueType != ValueType.Number) ThrowTypeMismatch(flagName, "number", flag.ValueType);
            var val = flag.Variant?.Value;
            if (val == null) throw new GatrixFeatureException($"Flag '{flagName}' has no number value");
            return Convert.ToSingle(val, CultureInfo.InvariantCulture);
        }

        public double DoubleVariationOrThrowInternal(string flagName, bool forceRealtime = false)
        {
            var flag = LookupFlagOrThrow(flagName);
            if (flag.ValueType != ValueType.Number) ThrowTypeMismatch(flagName, "number", flag.ValueType);
            var val = flag.Variant?.Value;
            if (val == null) throw new GatrixFeatureException($"Flag '{flagName}' has no number value");
            return Convert.ToDouble(val, CultureInfo.InvariantCulture);
        }

        public Dictionary<string, object> JsonVariationOrThrowInternal(string flagName, bool forceRealtime = false)
        {
            var flag = LookupFlagOrThrow(flagName);
            if (flag.ValueType != ValueType.Json) ThrowTypeMismatch(flagName, "json", flag.ValueType);
            var val = flag.Variant?.Value;
            if (val == null) throw new GatrixFeatureException($"Flag '{flagName}' has no JSON value");
            if (val is Dictionary<string, object> dict) return dict;
            if (val is string jsonStr)
            {
                var parsed = GatrixJson.DeserializeDictionary(jsonStr);
                if (parsed != null) return parsed;
            }
            throw new GatrixFeatureException($"Flag '{flagName}' value is not valid JSON");
        }

        // ==================== Public Methods (delegate to internal) ====================

        /// <summary>Check if a flag is enabled</summary>
        public bool IsEnabled(string flagName, bool forceRealtime = false) => IsEnabledInternal(flagName, forceRealtime);

        /// <summary>Get variant (never returns null)</summary>
        public Variant GetVariant(string flagName, bool forceRealtime = false) => GetVariantInternal(flagName, forceRealtime);

        public string Variation(string flagName, string fallbackValue, bool forceRealtime = false)
            => VariationInternal(flagName, fallbackValue, forceRealtime);

        public bool BoolVariation(string flagName, bool fallbackValue, bool forceRealtime = false)
            => BoolVariationInternal(flagName, fallbackValue, forceRealtime);

        public string StringVariation(string flagName, string fallbackValue, bool forceRealtime = false)
            => StringVariationInternal(flagName, fallbackValue, forceRealtime);

        public int IntVariation(string flagName, int fallbackValue, bool forceRealtime = false)
            => IntVariationInternal(flagName, fallbackValue, forceRealtime);

        public float FloatVariation(string flagName, float fallbackValue, bool forceRealtime = false)
            => FloatVariationInternal(flagName, fallbackValue, forceRealtime);

        public double DoubleVariation(string flagName, double fallbackValue, bool forceRealtime = false)
            => DoubleVariationInternal(flagName, fallbackValue, forceRealtime);

        public double NumberVariation(string flagName, double fallbackValue, bool forceRealtime = false)
            => DoubleVariationInternal(flagName, fallbackValue, forceRealtime);

        public Dictionary<string, object> JsonVariation(
            string flagName, Dictionary<string, object> fallbackValue, bool forceRealtime = false)
            => JsonVariationInternal(flagName, fallbackValue, forceRealtime);

        // Strict variations - delegate
        public bool BoolVariationOrThrow(string flagName, bool forceRealtime = false)
            => BoolVariationOrThrowInternal(flagName, forceRealtime);

        public string StringVariationOrThrow(string flagName, bool forceRealtime = false)
            => StringVariationOrThrowInternal(flagName, forceRealtime);

        public double NumberVariationOrThrow(string flagName, bool forceRealtime = false)
            => DoubleVariationOrThrowInternal(flagName, forceRealtime);

        public Dictionary<string, object> JsonVariationOrThrow(string flagName, bool forceRealtime = false)
            => JsonVariationOrThrowInternal(flagName, forceRealtime);

        // Variation details - delegate
        public VariationResult<bool> BoolVariationDetails(string flagName, bool fallbackValue, bool forceRealtime = false)
            => BoolVariationDetailsInternal(flagName, fallbackValue, forceRealtime);

        public VariationResult<string> StringVariationDetails(string flagName, string fallbackValue, bool forceRealtime = false)
            => StringVariationDetailsInternal(flagName, fallbackValue, forceRealtime);

        public VariationResult<double> NumberVariationDetails(string flagName, double fallbackValue, bool forceRealtime = false)
            => DoubleVariationDetailsInternal(flagName, fallbackValue, forceRealtime);

        public VariationResult<Dictionary<string, object>> JsonVariationDetails(
            string flagName, Dictionary<string, object> fallbackValue, bool forceRealtime = false)
            => JsonVariationDetailsInternal(flagName, fallbackValue, forceRealtime);

        // ==================== Explicit Sync Mode ====================

        /// <summary>Sync flags (explicit sync mode only)</summary>
        public async ValueTask SyncFlagsAsync(bool fetchNow = true)
        {
            if (!FeaturesConfig.ExplicitSyncMode) return;

            if (fetchNow) await FetchFlagsAsync();

            var oldSynchronizedFlags = new Dictionary<string, EvaluatedFlag>(_synchronizedFlags);
            _synchronizedFlags = new Dictionary<string, EvaluatedFlag>(_realtimeFlags);
            InvokeWatchCallbacks(oldSynchronizedFlags, _synchronizedFlags);
            _pendingSync = false;
            _syncFlagsCount++;
            _emitter.Emit(GatrixEvents.FlagsSync);
        }

        /// <summary>Check if explicit sync mode is enabled</summary>
        public bool IsExplicitSync() => FeaturesConfig.ExplicitSyncMode;

        /// <summary>Check if there are pending flag changes to sync</summary>
        public bool HasPendingSyncFlags() => _pendingSync;

        /// <summary>Check if there are pending flag changes to sync (alias)</summary>
        public bool CanSyncFlags() => _pendingSync;

        /// <summary>Dynamically enable/disable explicit sync mode at runtime</summary>
        public void SetExplicitSyncMode(bool enabled)
        {
            if (FeaturesConfig.ExplicitSyncMode == enabled) return;
            FeaturesConfig.ExplicitSyncMode = enabled;
            _synchronizedFlags = new Dictionary<string, EvaluatedFlag>(_realtimeFlags);
            _pendingSync = false;
            DevLog($"SetExplicitSyncMode: {enabled}");
        }

        /// <summary>Check if offline mode is enabled</summary>
        public bool IsOfflineMode() => _config.OfflineMode;

        /// <summary>Check if currently fetching flags</summary>
        public bool IsFetching() => _isFetchingFlags;

        // ==================== Watch ====================

        /// <summary>Watch a flag for changes. Returns unsubscribe action.
        /// Callbacks are stored directly and invoked when flags change.
        /// In explicitSyncMode, callbacks are only invoked when SyncFlagsAsync() is called.</summary>
        public Action WatchFlag(string flagName, GatrixFlagWatchHandler callback, string name = null)
        {
            if (!_watchCallbacks.TryGetValue(flagName, out var callbacks))
            {
                callbacks = new List<GatrixFlagWatchHandler>();
                _watchCallbacks[flagName] = callbacks;
            }
            callbacks.Add(callback);

            return () =>
            {
                if (_watchCallbacks.TryGetValue(flagName, out var cbs))
                {
                    cbs.Remove(callback);
                }
            };
        }

        /// <summary>Watch a flag with initial state callback. Returns unsubscribe action.
        /// Uses synchronized flags in explicitSyncMode for initial state.</summary>
        public Action WatchFlagWithInitialState(string flagName, GatrixFlagWatchHandler callback, string name = null)
        {
            var unsubscribe = WatchFlag(flagName, callback, name);

            // Emit initial state — respect explicitSyncMode
            if (_readyEventEmitted)
            {
                var flags = SelectFlags(false); // respect explicitSyncMode
                flags.TryGetValue(flagName, out var flag);
                callback(new FlagProxy(flag, this, flagName));
            }
            else
            {
                _emitter.Once(GatrixEvents.FlagsReady, _ =>
                {
                    var flags = SelectFlags(false); // respect explicitSyncMode
                    flags.TryGetValue(flagName, out var flag);
                    callback(new FlagProxy(flag, this, flagName));
                }, name != null ? $"{name}_initial" : null);
            }

            return unsubscribe;
        }

        /// <summary>Create a watch group for batch management</summary>
        public WatchFlagGroup CreateWatchGroup(string name)
        {
            var group = new WatchFlagGroup(this, name);
            _watchGroups[name] = group;
            return group;
        }

        // ==================== Fetch ====================

        /// <summary>Fetch flags from server</summary>
        public async ValueTask FetchFlagsAsync()
        {
            if (_config.OfflineMode)
            {
                _logger.Warn("fetchFlags called but client is in offline mode, ignoring");
                return;
            }

            if (_isFetchingFlags) return;
            _isFetchingFlags = true;
            _emitter.Emit(GatrixEvents.FlagsFetchStart);

            // Cancel previous fetch
            _fetchCts?.Cancel();
            _fetchCts?.Dispose();
            _fetchCts = new CancellationTokenSource();
            var ct = _fetchCts.Token;

            try
            {
                _fetchFlagsCount++;
                _lastFetchTime = DateTime.UtcNow;

                // Build URL: {apiUrl}/client/features/{environment}/eval
                var urlBuilder = new StringBuilder(_config.ApiUrl);
                urlBuilder.Append("/client/features/");
                urlBuilder.Append(Uri.EscapeDataString(_config.Environment));
                urlBuilder.Append("/eval?");

                // Add context as query params
                AppendContextQueryParams(urlBuilder, _context);

                var url = urlBuilder.ToString();
                var request = new HttpRequestMessage(HttpMethod.Get, url);

                // Headers
                request.Headers.TryAddWithoutValidation("X-API-Token", _config.ApiToken);
                request.Headers.TryAddWithoutValidation("X-Application-Name", _config.AppName);
                request.Headers.TryAddWithoutValidation("X-Environment", _config.Environment);
                request.Headers.TryAddWithoutValidation("X-Connection-Id", _connectionId);
                request.Headers.TryAddWithoutValidation("X-SDK-Version", $"{GatrixClient.SdkName}/{GatrixClient.SdkVersion}");
                if (_config.CustomHeaders != null)
                {
                    foreach (var kvp in _config.CustomHeaders)
                    {
                        request.Headers.TryAddWithoutValidation(kvp.Key, kvp.Value);
                    }
                }
                if (!string.IsNullOrEmpty(_etag))
                {
                    request.Headers.TryAddWithoutValidation("If-None-Match", _etag);
                }

                _emitter.Emit(GatrixEvents.FlagsFetch, _etag);

                // Send request with retry
                HttpResponseMessage response = null;
                var retryLimit = FeaturesConfig.FetchRetryLimit;
                var timeout = FeaturesConfig.FetchTimeout * 1000;

                for (int attempt = 0; attempt <= retryLimit; attempt++)
                {
                    try
                    {
                        using (var timeoutCts = new CancellationTokenSource(timeout))
                        using (var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(ct, timeoutCts.Token))
                        {
                            response = await _httpClient.SendAsync(
                                CloneRequest(request), linkedCts.Token);
                        }

                        // Success or client error - don't retry
                        if (response.IsSuccessStatusCode ||
                            response.StatusCode == HttpStatusCode.NotModified ||
                            (int)response.StatusCode < 500)
                        {
                            break;
                        }
                    }
                    catch (OperationCanceledException) when (ct.IsCancellationRequested)
                    {
                        return; // Cancelled
                    }
                    catch (Exception) when (attempt < retryLimit)
                    {
                        // Retry with exponential backoff
                        var delay = Math.Min(1000 * (1 << attempt), 8000);
                        await Task.Delay(delay, ct);
                    }
                }

                if (response == null) return;

                // Check for recovery
                if (_sdkState == SdkState.Error && (int)response.StatusCode < 400)
                {
                    _sdkState = SdkState.Healthy;
                    _recoveryCount++;
                    _lastRecoveryTime = DateTime.UtcNow;
                    _emitter.Emit(GatrixEvents.FlagsRecovered);
                }

                if (response.IsSuccessStatusCode)
                {
                    // Read ETag
                    IEnumerable<string> etagValues;
                    if (response.Headers.TryGetValues("ETag", out etagValues))
                    {
                        var newEtag = "";
                        foreach (var v in etagValues) { newEtag = v; break; }
                        if (newEtag != _etag)
                        {
                            _etag = newEtag;
                            await _storage.SaveAsync(StorageKeyEtag, _etag);
                        }
                    }

                    var json = await response.Content.ReadAsStringAsync();
                    var data = GatrixJson.DeserializeFlagsResponse(json);

                    if (data != null && data.Success && data.Data?.Flags != null)
                    {
                        var isInitialFetch = !_fetchedFromServer;
                        await StoreFlagsAsync(data.Data.Flags, isInitialFetch);
                        _updateCount++;
                        _lastUpdateTime = DateTime.UtcNow;

                        if (!_fetchedFromServer)
                        {
                            _fetchedFromServer = true;
                            SetReady();
                        }
                    }

                    // Success: reset failure counter and schedule at normal interval
                    _consecutiveFailures = 0;
                    ScheduleNextRefresh();
                    _emitter.Emit(GatrixEvents.FlagsFetchSuccess);
                }
                else if (response.StatusCode == HttpStatusCode.NotModified)
                {
                    _notModifiedCount++;
                    if (!_fetchedFromServer)
                    {
                        _fetchedFromServer = true;
                        SetReady();
                    }
                    // 304: reset failure counter and schedule at normal interval
                    _consecutiveFailures = 0;
                    ScheduleNextRefresh();
                    _emitter.Emit(GatrixEvents.FlagsFetchSuccess);
                }
                else
                {
                    var statusCode = (int)response.StatusCode;
                    var nonRetryable = FeaturesConfig.NonRetryableStatusCodes ?? new int[] { 401, 403 };
                    var isNonRetryable = Array.IndexOf(nonRetryable, statusCode) >= 0;

                    HandleFetchError(statusCode);
                    _emitter.Emit(GatrixEvents.FlagsFetchError,
                        new ErrorEvent { Code = statusCode });

                    if (isNonRetryable)
                    {
                        // Non-retryable error: stop polling entirely
                        _pollingStopped = true;
                        _logger.Error($"Polling stopped due to non-retryable status code {statusCode}.");
                    }
                    else
                    {
                        // Retryable error: schedule with backoff
                        _consecutiveFailures++;
                        ScheduleNextRefresh();
                    }
                }
            }
            catch (OperationCanceledException)
            {
                // Cancelled - ignore
            }
            catch (Exception e)
            {
                _logger.Error($"Failed to fetch flags: {e.Message}");
                _sdkState = SdkState.Error;
                _lastError = e;
                _errorCount++;
                _lastErrorTime = DateTime.UtcNow;
                _emitter.Emit(GatrixEvents.FlagsError,
                    new ErrorEvent { Type = "fetch-flags", Error = e });
                _emitter.Emit(GatrixEvents.FlagsFetchError,
                    new ErrorEvent { Error = e });
                // Network error: schedule with backoff
                _consecutiveFailures++;
                ScheduleNextRefresh();
            }
            finally
            {
                _isFetchingFlags = false;
                _emitter.Emit(GatrixEvents.FlagsFetchEnd);
            }
        }

        // ==================== Statistics ====================

        /// <summary>Get feature flag specific statistics</summary>
        public FeaturesStats GetStats()
        {
            var flags = SelectFlags();

            // Active watch groups
            var activeWatchGroups = new List<string>();
            foreach (var kvp in _watchGroups)
            {
                if (kvp.Value.Size > 0) activeWatchGroups.Add(kvp.Key);
            }

            return new FeaturesStats
            {
                TotalFlagCount = flags.Count,
                MissingFlags = _metrics.GetMissingFlags(),
                FetchFlagsCount = _fetchFlagsCount,
                UpdateCount = _updateCount,
                NotModifiedCount = _notModifiedCount,
                RecoveryCount = _recoveryCount,
                ErrorCount = _errorCount,
                SdkState = _sdkState,
                LastError = _lastError,
                StartTime = _startTime,
                LastFetchTime = _lastFetchTime,
                LastUpdateTime = _lastUpdateTime,
                LastRecoveryTime = _lastRecoveryTime,
                LastErrorTime = _lastErrorTime,
                FlagEnabledCounts = new Dictionary<string, EnabledCount>(_flagEnabledCounts),
                FlagVariantCounts = CloneFlagVariantCounts(),
                SyncFlagsCount = _syncFlagsCount,
                ImpressionCount = _impressionCount,
                ContextChangeCount = _contextChangeCount,
                FlagLastChangedTimes = new Dictionary<string, DateTime>(_flagLastChangedTimes),
                ActiveWatchGroups = activeWatchGroups,
                Etag = string.IsNullOrEmpty(_etag) ? null : _etag,
                MetricsSentCount = _metricsSentCount,
                MetricsErrorCount = _metricsErrorCount,
                StreamingState = _streamingState,
                StreamingReconnectCount = _streamingReconnectCount,
                LastStreamingEventTime = _lastStreamingEventTime
            };
        }

        // ==================== Streaming ====================

        /// <summary>
        /// Connect to the streaming endpoint for real-time invalidation signals.
        /// Implements SSE (Server-Sent Events) parsing using HttpClient with streaming response.
        /// </summary>
        private void ConnectStreaming()
        {
            if (_streamingState == StreamingConnectionState.Connected ||
                _streamingState == StreamingConnectionState.Connecting)
            {
                return;
            }

            _streamingState = StreamingConnectionState.Connecting;
            DevLog("Connecting to streaming endpoint...");

            // Cancel previous streaming connection
            _streamingCts?.Cancel();
            _streamingCts?.Dispose();
            _streamingCts = new CancellationTokenSource();
            var ct = _streamingCts.Token;

            var streamUrl = FeaturesConfig.StreamingUrl
                ?? $"{_config.ApiUrl}/client/features/{Uri.EscapeDataString(_config.Environment)}/stream";

            _ = RunStreamingLoopAsync(streamUrl, ct);
        }

        /// <summary>
        /// SSE streaming loop - runs on background thread, dispatches events to main thread.
        /// </summary>
        private async Task RunStreamingLoopAsync(string streamUrl, CancellationToken ct)
        {
            try
            {
                var request = new HttpRequestMessage(HttpMethod.Get, streamUrl);
                request.Headers.TryAddWithoutValidation("Accept", "text/event-stream");
                request.Headers.TryAddWithoutValidation("Cache-Control", "no-cache");
                request.Headers.TryAddWithoutValidation("X-API-Token", _config.ApiToken);
                request.Headers.TryAddWithoutValidation("X-Application-Name", _config.AppName);
                request.Headers.TryAddWithoutValidation("X-Environment", _config.Environment);
                request.Headers.TryAddWithoutValidation("X-Connection-Id", _connectionId);
                request.Headers.TryAddWithoutValidation("X-SDK-Version", $"{GatrixClient.SdkName}/{GatrixClient.SdkVersion}");
                if (_config.CustomHeaders != null)
                {
                    foreach (var kvp in _config.CustomHeaders)
                    {
                        request.Headers.TryAddWithoutValidation(kvp.Key, kvp.Value);
                    }
                }

                using (var response = await _httpClient.SendAsync(
                    request, HttpCompletionOption.ResponseHeadersRead, ct))
                {
                    if (!response.IsSuccessStatusCode)
                    {
                        var errorMessage = $"Streaming connection failed: {(int)response.StatusCode} {response.ReasonPhrase}";
                        _logger.Error(errorMessage);
                        PostToMainThread(() =>
                        {
                            _streamingState = StreamingConnectionState.Reconnecting;
                            _emitter.Emit(GatrixEvents.FlagsStreamingError,
                                new ErrorEvent { Type = "streaming_connect", Error = new GatrixException(errorMessage) });
                            _emitter.Emit(GatrixEvents.FlagsStreamingDisconnected);
                            ScheduleStreamingReconnect();
                        });
                        return;
                    }

                    // Connected successfully
                    PostToMainThread(() =>
                    {
                        _streamingState = StreamingConnectionState.Connected;
                        _streamingReconnectAttempt = 0;
                        DevLog($"Streaming connected. URL: {streamUrl}");
                        _emitter.Emit(GatrixEvents.FlagsStreamingConnected);
                    });

                    // Read SSE stream line by line
                    using (var stream = await response.Content.ReadAsStreamAsync())
                    {
                        var buffer = new byte[4096];
                        var lineBuffer = new StringBuilder();
                        string currentEventType = null;
                        var dataBuilder = new StringBuilder();

                        while (!ct.IsCancellationRequested)
                        {
                            var bytesRead = await stream.ReadAsync(buffer, 0, buffer.Length, ct);
                            if (bytesRead == 0)
                            {
                                // Stream closed by server
                                break;
                            }

                            var chunk = System.Text.Encoding.UTF8.GetString(buffer, 0, bytesRead);
                            lineBuffer.Append(chunk);

                            // Process complete lines
                            var text = lineBuffer.ToString();
                            var lastNewline = text.LastIndexOf('\n');
                            if (lastNewline < 0) continue;

                            var completeText = text.Substring(0, lastNewline + 1);
                            lineBuffer.Clear();
                            if (lastNewline + 1 < text.Length)
                            {
                                lineBuffer.Append(text.Substring(lastNewline + 1));
                            }

                            var lines = completeText.Split('\n');
                            foreach (var rawLine in lines)
                            {
                                var line = rawLine.TrimEnd('\r');

                                if (string.IsNullOrEmpty(line))
                                {
                                    // Empty line = event dispatch
                                    if (currentEventType != null || dataBuilder.Length > 0)
                                    {
                                        var eventType = currentEventType ?? "message";
                                        var eventData = dataBuilder.ToString();
                                        PostToMainThread(() => ProcessStreamingEvent(eventType, eventData));
                                        currentEventType = null;
                                        dataBuilder.Clear();
                                    }
                                    continue;
                                }

                                if (line.StartsWith("event:"))
                                {
                                    currentEventType = line.Substring(6).Trim();
                                }
                                else if (line.StartsWith("data:"))
                                {
                                    if (dataBuilder.Length > 0) dataBuilder.Append('\n');
                                    dataBuilder.Append(line.Substring(5).Trim());
                                }
                                // Ignore 'id:', 'retry:', and comment lines starting with ':'
                            }
                        }
                    }
                }

                // Stream ended normally
                if (!ct.IsCancellationRequested && _streamingState != StreamingConnectionState.Disconnected)
                {
                    PostToMainThread(() =>
                    {
                        DevLog("Streaming connection closed by server");
                        _streamingState = StreamingConnectionState.Reconnecting;
                        _emitter.Emit(GatrixEvents.FlagsStreamingDisconnected);
                        ScheduleStreamingReconnect();
                    });
                }
            }
            catch (OperationCanceledException)
            {
                // Intentional disconnect - ignore
            }
            catch (Exception ex)
            {
                if (_streamingState == StreamingConnectionState.Disconnected) return;

                PostToMainThread(() =>
                {
                    _logger.Warn($"Streaming error: {ex.Message}");
                    _emitter.Emit(GatrixEvents.FlagsStreamingError,
                        new ErrorEvent { Type = "streaming", Error = ex });

                    if (_streamingState != StreamingConnectionState.Reconnecting)
                    {
                        _streamingState = StreamingConnectionState.Reconnecting;
                        _emitter.Emit(GatrixEvents.FlagsStreamingDisconnected);
                    }
                    ScheduleStreamingReconnect();
                });
            }
        }

        /// <summary>
        /// Process a single SSE event on the main thread.
        /// </summary>
        private void ProcessStreamingEvent(string eventType, string eventData)
        {
            _lastStreamingEventTime = DateTime.UtcNow;

            switch (eventType)
            {
                case "connected":
                    try
                    {
                        var index = 0;
                        var parsed = GatrixJson.ParseJsonValue(eventData, ref index)
                            as Dictionary<string, object>;
                        if (parsed != null && parsed.TryGetValue("globalRevision", out var revObj))
                        {
                            long serverRevision = 0;
                            if (revObj is int ri) serverRevision = ri;
                            else if (revObj is long rl) serverRevision = rl;
                            else if (revObj is double rd) serverRevision = (long)rd;

                            DevLog($"Streaming 'connected' event: globalRevision={serverRevision}");
                            _emitter.Emit(GatrixEvents.FlagsStreamingConnected,
                                new StreamingConnectedEvent { GlobalRevision = serverRevision });

                            // Gap recovery: check if we missed any changes
                            if (serverRevision > _localGlobalRevision && _localGlobalRevision > 0)
                            {
                                DevLog($"Gap detected: server={serverRevision}, local={_localGlobalRevision}. Triggering recovery.");
                                _ = FetchFlagsAsync();
                            }
                            else if (_localGlobalRevision == 0)
                            {
                                // First connection, record initial revision
                                _localGlobalRevision = serverRevision;
                            }
                        }
                    }
                    catch (Exception e)
                    {
                        _logger.Warn($"Failed to parse streaming connected event: {e.Message}");
                    }
                    break;

                case "flags_changed":
                    try
                    {
                        var index = 0;
                        var parsed = GatrixJson.ParseJsonValue(eventData, ref index)
                            as Dictionary<string, object>;
                        if (parsed != null)
                        {
                            long serverRevision = 0;
                            if (parsed.TryGetValue("globalRevision", out var revObj))
                            {
                                if (revObj is int ri) serverRevision = ri;
                                else if (revObj is long rl) serverRevision = rl;
                                else if (revObj is double rd) serverRevision = (long)rd;
                            }

                            var changedKeys = new List<string>();
                            if (parsed.TryGetValue("changedKeys", out var keysObj) && keysObj is List<object> keysList)
                            {
                                foreach (var k in keysList)
                                {
                                    if (k != null) changedKeys.Add(k.ToString());
                                }
                            }

                            DevLog($"Streaming 'flags_changed': globalRevision={serverRevision}, changedKeys=[{string.Join(",", changedKeys)}]");

                            // Only process if server revision is ahead
                            if (serverRevision > _localGlobalRevision)
                            {
                                _localGlobalRevision = serverRevision;
                                _emitter.Emit(GatrixEvents.FlagsInvalidated,
                                    new FlagsChangedEvent
                                    {
                                        GlobalRevision = serverRevision,
                                        ChangedKeys = changedKeys
                                    });
                                HandleStreamingInvalidation(changedKeys);
                            }
                            else
                            {
                                DevLog($"Ignoring stale event: server={serverRevision} <= local={_localGlobalRevision}");
                            }
                        }
                    }
                    catch (Exception e)
                    {
                        _logger.Warn($"Failed to parse flags_changed event: {e.Message}");
                    }
                    break;

                case "heartbeat":
                    DevLog("Streaming heartbeat received");
                    break;

                default:
                    DevLog($"Unknown streaming event: {eventType}");
                    break;
            }
        }

        /// <summary>
        /// Disconnect from the streaming endpoint.
        /// </summary>
        private void DisconnectStreaming()
        {
            DevLog("Disconnecting streaming");
            _streamingState = StreamingConnectionState.Disconnected;

            _streamingReconnectCts?.Cancel();
            _streamingReconnectCts?.Dispose();
            _streamingReconnectCts = null;

            _streamingCts?.Cancel();
            _streamingCts?.Dispose();
            _streamingCts = null;
        }

        /// <summary>
        /// Schedule streaming reconnection with exponential backoff + jitter.
        /// </summary>
        private void ScheduleStreamingReconnect()
        {
            if (_streamingState == StreamingConnectionState.Disconnected || !_started)
            {
                return;
            }

            // Cancel any existing reconnect timer
            _streamingReconnectCts?.Cancel();
            _streamingReconnectCts?.Dispose();
            _streamingReconnectCts = new CancellationTokenSource();

            _streamingReconnectAttempt++;
            _streamingReconnectCount++;

            var baseMs = FeaturesConfig.StreamingReconnectBaseMs;
            var maxMs = FeaturesConfig.StreamingReconnectMaxMs;

            // Exponential backoff: base * 2^(attempt-1), capped at max
            var exponentialDelay = (int)Math.Min(
                baseMs * Math.Pow(2, _streamingReconnectAttempt - 1),
                maxMs);
            // Add jitter (0 - 1000ms)
            var jitter = UnityEngine.Random.Range(0, 1000);
            var delayMs = exponentialDelay + jitter;

            DevLog($"Scheduling streaming reconnect: attempt={_streamingReconnectAttempt}, delay={delayMs}ms");

            _emitter.Emit(GatrixEvents.FlagsStreamingReconnecting,
                _streamingReconnectAttempt, delayMs);

            // Transition to degraded after several failed attempts
            if (_streamingReconnectAttempt >= 5 && _streamingState != StreamingConnectionState.Degraded)
            {
                _streamingState = StreamingConnectionState.Degraded;
                _logger.Warn("Streaming degraded: falling back to polling-only mode");
            }

            var reconnectCt = _streamingReconnectCts.Token;
            _ = ScheduleStreamingReconnectAsync(delayMs, reconnectCt);
        }

        private async Task ScheduleStreamingReconnectAsync(int delayMs, CancellationToken ct)
        {
            try
            {
                await Task.Delay(delayMs, ct);
                if (ct.IsCancellationRequested) return;

                PostToMainThread(() =>
                {
                    // Abort previous connection before creating new one
                    _streamingCts?.Cancel();
                    _streamingCts?.Dispose();
                    _streamingCts = null;
                    ConnectStreaming();
                });
            }
            catch (OperationCanceledException)
            {
                // Expected on disconnect
            }
        }

        /// <summary>
        /// Handle streaming invalidation signal by triggering a full re-fetch.
        /// The ETag mechanism ensures only changed data is transferred.
        /// </summary>
        private void HandleStreamingInvalidation(List<string> changedKeys)
        {
            if (!_isFetchingFlags)
            {
                _ = FetchFlagsAsync();
            }
            else
            {
                DevLog("Fetch already in progress, invalidation will be picked up on next poll");
            }
        }

        /// <summary>
        /// Post an action to the main thread via captured SynchronizationContext.
        /// Falls back to direct invocation if no SynchronizationContext was captured.
        /// </summary>
        private void PostToMainThread(Action action)
        {
            if (_syncContext != null && SynchronizationContext.Current != _syncContext)
            {
                _syncContext.Post(_ => action(), null);
            }
            else
            {
                action();
            }
        }

        // ==================== Private Methods ====================

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

        private void ScheduleNextRefresh()
        {
            if (_refreshIntervalMs <= 0 || !_started || _pollingStopped) return;

            _pollCts?.Cancel();
            _pollCts?.Dispose();
            _pollCts = new CancellationTokenSource();
            var ct = _pollCts.Token;

            int delayMs = _refreshIntervalMs;

            // Apply exponential backoff on consecutive failures
            if (_consecutiveFailures > 0)
            {
                var featCfg = FeaturesConfig;
                var initialBackoff = featCfg.InitialBackoffMs;
                var maxBackoff = featCfg.MaxBackoffMs;
                var backoff = (int)Math.Min(
                    initialBackoff * Math.Pow(2, _consecutiveFailures - 1),
                    maxBackoff);
                delayMs = backoff;
                _logger.Warn($"Scheduling retry after {delayMs}ms (consecutive failures: {_consecutiveFailures})");
            }

            DevLog($"ScheduleNextRefresh: delay={delayMs}ms, consecutiveFailures={_consecutiveFailures}, pollingStopped={_pollingStopped}");

            // Use async continuation that returns to the captured SynchronizationContext
            // so that FetchFlagsAsync and all event callbacks run on the main thread.
            _ = ScheduleRefreshAsync(delayMs, ct);
        }

        private async ValueTask ScheduleRefreshAsync(int delayMs, CancellationToken ct)
        {
            try
            {
                await Task.Delay(delayMs, ct);
                if (ct.IsCancellationRequested) return;

                // Ensure we're back on the main thread for the fetch
                if (_syncContext != null && SynchronizationContext.Current != _syncContext)
                {
                    var tcs = new TaskCompletionSource<bool>();
                    _syncContext.Post(_ =>
                    {
                        try
                        {
                            FetchFlagsAsync().AsTask().ContinueWith(t =>
                            {
                                if (t.IsFaulted) tcs.TrySetException(t.Exception);
                                else if (t.IsCanceled) tcs.TrySetCanceled();
                                else tcs.TrySetResult(true);
                            }, TaskScheduler.FromCurrentSynchronizationContext());
                        }
                        catch (Exception e)
                        {
                            tcs.TrySetException(e);
                        }
                    }, null);
                    await tcs.Task;
                }
                else
                {
                    await FetchFlagsAsync();
                }
            }
            catch (OperationCanceledException)
            {
                // Expected on stop
            }
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

        private async ValueTask StoreFlagsAsync(List<EvaluatedFlag> flags, bool forceSync = false)
        {
            var oldFlags = new Dictionary<string, EvaluatedFlag>(_realtimeFlags);
            SetFlags(flags, forceSync);

            var flagsJson = GatrixJson.SerializeFlags(flags);
            await _storage.SaveAsync(StorageKeyFlags, flagsJson);

            EmitRealtimeFlagChanges(oldFlags, _realtimeFlags);
            _sdkState = SdkState.Healthy;

            if (!FeaturesConfig.ExplicitSyncMode || forceSync)
            {
                InvokeWatchCallbacks(oldFlags, _realtimeFlags);
                _emitter.Emit(GatrixEvents.FlagsChange, flags);
            }
        }

        private void EmitRealtimeFlagChanges(
            Dictionary<string, EvaluatedFlag> oldFlags,
            Dictionary<string, EvaluatedFlag> newFlags)
        {
            var isInitialLoad = oldFlags.Count == 0;
            var now = DateTime.UtcNow;

            // Check for changed/new flags
            foreach (var kvp in newFlags)
            {
                oldFlags.TryGetValue(kvp.Key, out var oldFlag);
                if (oldFlag == null || oldFlag.Version != kvp.Value.Version)
                {
                    var changeType = oldFlag == null ? "created" : "updated";
                    if (!isInitialLoad)
                    {
                        _flagLastChangedTimes[kvp.Key] = now;
                    }
                    _emitter.Emit(GatrixEvents.FlagChange(kvp.Key), kvp.Value, oldFlag, changeType);
                }
            }

            // Check for removed flags - emit bulk event, not per-flag change
            var removedNames = new List<string>();
            foreach (var kvp in oldFlags)
            {
                if (!newFlags.ContainsKey(kvp.Key))
                {
                    removedNames.Add(kvp.Key);
                    _flagLastChangedTimes[kvp.Key] = now;
                }
            }
            if (removedNames.Count > 0)
            {
                _emitter.Emit(GatrixEvents.FlagsRemoved, removedNames.ToArray());
            }
        }

        /// <summary>Invoke watch callbacks for changed flags.</summary>
        private void InvokeWatchCallbacks(
            Dictionary<string, EvaluatedFlag> oldFlags,
            Dictionary<string, EvaluatedFlag> newFlags)
        {
            var now = DateTime.UtcNow;

            // Check for changed/new flags
            foreach (var kvp in newFlags)
            {
                oldFlags.TryGetValue(kvp.Key, out var oldFlag);
                if (oldFlag == null || oldFlag.Version != kvp.Value.Version)
                {
                    _flagLastChangedTimes[kvp.Key] = now;

                    if (_watchCallbacks.TryGetValue(kvp.Key, out var callbacks) && callbacks.Count > 0)
                    {
                        var proxy = new FlagProxy(kvp.Value, this, kvp.Key);
                        foreach (var cb in callbacks.ToArray()) // copy to avoid mutation during iteration
                        {
                            try
                            {
                                cb(proxy);
                            }
                            catch (Exception ex)
                            {
                                _logger?.Error($"Error in WatchFlag callback for {kvp.Key}: {ex.Message}");
                            }
                        }
                    }
                }
            }

            // Check for removed flags
            foreach (var kvp in oldFlags)
            {
                if (!newFlags.ContainsKey(kvp.Key))
                {
                    if (_watchCallbacks.TryGetValue(kvp.Key, out var callbacks) && callbacks.Count > 0)
                    {
                        var proxy = new FlagProxy(null, this, kvp.Key);
                        foreach (var cb in callbacks.ToArray())
                        {
                            try
                            {
                                cb(proxy);
                            }
                            catch (Exception ex)
                            {
                                _logger?.Error($"Error in WatchFlag callback for removed flag {kvp.Key}: {ex.Message}");
                            }
                        }
                    }
                }
            }
        }

        private void HandleFetchError(int statusCode)
        {
            _sdkState = SdkState.Error;
            _lastError = new GatrixException($"HTTP error: {statusCode}");
            _errorCount++;
            _lastErrorTime = DateTime.UtcNow;
            _emitter.Emit(GatrixEvents.FlagsError,
                new ErrorEvent { Type = "HttpError", Code = statusCode });
        }

        private async ValueTask<string> ResolveSessionIdAsync()
        {
            if (!string.IsNullOrEmpty(_context.SessionId))
                return _context.SessionId;

            var sessionId = await _storage.GetAsync(StorageKeySession);
            if (string.IsNullOrEmpty(sessionId))
            {
                sessionId = UnityEngine.Random.Range(0, 1000000000).ToString();
                await _storage.SaveAsync(StorageKeySession, sessionId);
            }
            return sessionId;
        }

        /// <summary>Unified flag access tracking - metrics, stats, and impressions.</summary>
        private void TrackFlagAccess(string flagName, EvaluatedFlag flag, string eventType, string variantName = null)
        {
            if (flag == null)
            {
                _metrics.CountMissing(flagName);
                return;
            }

            // Metrics
            _metrics.Count(flagName, flag.Enabled);
            if (variantName != null)
            {
                _metrics.CountVariant(flagName, variantName);
            }

            // Stats
            TrackFlagEnabledCount(flagName, flag.Enabled);
            if (variantName != null)
            {
                TrackVariantCount(flagName, variantName);
            }

            // Impression
            TrackImpression(flagName, flag.Enabled, flag, eventType, variantName);
        }

        private void TrackImpression(
            string flagName, bool enabled, EvaluatedFlag flag,
            string eventType, string variantName = null)
        {
            var shouldTrack = FeaturesConfig.ImpressionDataAll || (flag?.ImpressionData ?? false);
            if (!shouldTrack) return;

            var evt = new ImpressionEvent
            {
                EventType = eventType,
                EventId = Guid.NewGuid().ToString(),
                Context = _context,
                Enabled = enabled,
                FeatureName = flagName,
                ImpressionData = flag?.ImpressionData ?? false,
                VariantName = variantName,
                Reason = flag?.Reason
            };

            _impressionCount++;
            _emitter.Emit(GatrixEvents.FlagsImpression, evt);
        }

        private void TrackFlagEnabledCount(string flagName, bool enabled)
        {
            if (FeaturesConfig.DisableStats) return;

            if (!_flagEnabledCounts.TryGetValue(flagName, out var counts))
            {
                counts = new EnabledCount();
                _flagEnabledCounts[flagName] = counts;
            }
            if (enabled) counts.Yes++;
            else counts.No++;
        }

        private void TrackVariantCount(string flagName, string variantName)
        {
            if (FeaturesConfig.DisableStats) return;

            if (!_flagVariantCounts.TryGetValue(flagName, out var variantCounts))
            {
                variantCounts = new Dictionary<string, int>();
                _flagVariantCounts[flagName] = variantCounts;
            }
            if (variantCounts.TryGetValue(variantName, out var count))
            {
                variantCounts[variantName] = count + 1;
            }
            else
            {
                variantCounts[variantName] = 1;
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

        private Dictionary<string, Dictionary<string, int>> CloneFlagVariantCounts()
        {
            var result = new Dictionary<string, Dictionary<string, int>>();
            foreach (var kvp in _flagVariantCounts)
            {
                result[kvp.Key] = new Dictionary<string, int>(kvp.Value);
            }
            return result;
        }
    }
}
