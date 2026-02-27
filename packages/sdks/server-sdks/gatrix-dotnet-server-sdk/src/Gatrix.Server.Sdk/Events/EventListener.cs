using System.Collections.Concurrent;
using System.Text.Json;
using Gatrix.Server.Sdk.Cache;
using Gatrix.Server.Sdk.Options;
using Gatrix.Server.Sdk.Services;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using StackExchange.Redis;

namespace Gatrix.Server.Sdk.Events;

/// <summary>
/// Listens to Redis Pub/Sub for real-time cache invalidation events from Gatrix backend.
/// Exact port of Node.js server-sdk/cache/EventListener.ts.
///
/// When cache.refreshMethod is "event", this replaces polling and provides
/// immediate, granular cache updates:
///   - Single-item upsert/remove for gameworld, popup, survey, store_product
///   - Full refresh for whitelist, maintenance, feature_flag, segment, bulk operations
///   - isVisible/isActive-based removal (no API call needed when hiding)
///   - Automatic full-refresh fallback on single-item update failure
///
/// Channel: "gatrix-sdk-events"
/// </summary>
public class EventListener : IAsyncDisposable
{
    private readonly GatrixSdkOptions _options;
    private ICacheManager? _cacheManager;
    private readonly ILogger<EventListener> _logger;

    // Granular services for single-item cache operations
    private readonly IGameWorldService _gameWorld;
    private readonly IPopupNoticeService _popupNotice;
    private readonly ISurveyService _survey;
    private readonly IWhitelistService _whitelist;
    private readonly IServiceMaintenanceService _serviceMaintenance;
    private readonly IStoreProductService _storeProduct;
    private readonly IFeatureFlagService _featureFlag;
    private readonly IClientVersionService _clientVersion;
    private readonly IBannerService _banner;
    private readonly IServiceNoticeService _serviceNotice;

    private ConnectionMultiplexer? _redis;
    private ISubscriber? _subscriber;
    private bool _isConnected;
    private bool _isShuttingDown;
    private bool _isFirstConnection = true;

    private const string ChannelName = "gatrix-sdk-events";

    // User-registered event callbacks
    private readonly ConcurrentDictionary<string, List<SdkEventCallback>> _listeners = new();

    public EventListener(
        IOptions<GatrixSdkOptions> options,
        ILogger<EventListener> logger,
        IGameWorldService gameWorld,
        IPopupNoticeService popupNotice,
        ISurveyService survey,
        IWhitelistService whitelist,
        IServiceMaintenanceService serviceMaintenance,
        IStoreProductService storeProduct,
        IFeatureFlagService featureFlag,
        IClientVersionService clientVersion,
        IBannerService banner,
        IServiceNoticeService serviceNotice)
    {
        _options = options.Value;
        _logger = logger;
        _gameWorld = gameWorld;
        _popupNotice = popupNotice;
        _survey = survey;
        _whitelist = whitelist;
        _serviceMaintenance = serviceMaintenance;
        _storeProduct = storeProduct;
        _featureFlag = featureFlag;
        _clientVersion = clientVersion;
        _banner = banner;
        _serviceNotice = serviceNotice;
    }

    /// <summary>Set the cache manager reference (called by CacheManager to break circular dependency).</summary>
    public void SetCacheManager(ICacheManager cacheManager) => _cacheManager = cacheManager;

    public bool IsConnected => _isConnected;

    /// <summary>Initialize Redis connection and subscribe to events channel.</summary>
    public async Task InitializeAsync(CancellationToken ct = default)
    {
        if (_options.Redis is null)
        {
            _logger.LogWarning("Redis config not provided — event listener will not start");
            return;
        }

        _logger.LogInformation("Initializing Redis event listener on {Host}:{Port}",
            _options.Redis.Host, _options.Redis.Port);

        var configOptions = new ConfigurationOptions
        {
            EndPoints = { { _options.Redis.Host, _options.Redis.Port } },
            Password = _options.Redis.Password,
            DefaultDatabase = _options.Redis.Db,
            AbortOnConnectFail = false,
            ConnectRetry = 5,
            ReconnectRetryPolicy = new ExponentialRetry(1000, 30000),
        };

        _redis = await ConnectionMultiplexer.ConnectAsync(configOptions);

        _redis.ConnectionFailed += (_, args) =>
        {
            if (_isShuttingDown) return;
            _isConnected = false;
            _logger.LogWarning("Redis connection failed: {FailureType}", args.FailureType);
        };

        _redis.ConnectionRestored += async (_, _) =>
        {
            if (_isShuttingDown) return;
            _isConnected = true;

            // Only reinitialize cache on reconnection, not on first connect
            // (CacheManager.StartAsync already loads initial data)
            if (!_isFirstConnection)
            {
                _logger.LogInformation("Redis connection restored — refreshing ALL caches to recover missed events");
                try
                {
                    if (_cacheManager != null)
                        await _cacheManager.RefreshAsync(ct);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to refresh caches after Redis reconnection");
                }
            }
        };

        _subscriber = _redis.GetSubscriber();

        await _subscriber.SubscribeAsync(RedisChannel.Literal(ChannelName), async (_, message) =>
        {
            if (message.IsNullOrEmpty) return;
            try
            {
                var sdkEvent = JsonSerializer.Deserialize<SdkEvent>(message!);
                if (sdkEvent is null) return;

                _logger.LogInformation("SDK event received: {Type} (id={Id}, env={Env})",
                    sdkEvent.Type, sdkEvent.Data.GetIdAsString(), sdkEvent.Data.Environment);

                await ProcessEventAsync(sdkEvent);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to process Redis event message");
            }
        });

        _isConnected = true;
        _isFirstConnection = false;
        _logger.LogInformation("Redis event listener initialized and subscribed to '{Channel}'", ChannelName);
    }

    // ══════════════════════════════════════════════════════════════
    //  Event Processing — granular, per Node.js EventListener.ts
    // ══════════════════════════════════════════════════════════════

    private async Task ProcessEventAsync(SdkEvent sdkEvent)
    {
        // Handle standard cache invalidation events
        try
        {
            await HandleStandardEventAsync(sdkEvent);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to handle standard event: {Type}", sdkEvent.Type);
        }

        // Emit to user-registered listeners
        await EmitToListenersAsync(sdkEvent);
    }

    private async Task HandleStandardEventAsync(SdkEvent evt)
    {
        var features = _options.Features;
        var env = evt.Data.Environment;

        switch (evt.Type)
        {
            // ── Game World ──────────────────────────────────────
            case "gameworld.created":
            case "gameworld.updated":
            {
                if (!features.GameWorld) break;
                if (env is null) { LogMissingEnv(evt.Type); break; }

                var isVisible = evt.Data.GetIsVisible();
                var id = evt.Data.GetIdAsInt();
                if (id is null) { _logger.LogWarning("GameWorld event missing id"); break; }

                await _gameWorld.UpdateSingleWorldAsync(id.Value, env, isVisible);
                break;
            }

            case "gameworld.deleted":
            {
                if (!features.GameWorld) break;
                if (env is null) { LogMissingEnv(evt.Type); break; }

                var id = evt.Data.GetIdAsInt();
                if (id is null) break;
                _gameWorld.RemoveWorld(id.Value, env);
                break;
            }

            case "gameworld.order_changed":
            {
                if (!features.GameWorld) break;
                if (env is null) { LogMissingEnv(evt.Type); break; }

                _logger.LogInformation("Game world order changed, full refresh for {Env}", env);
                await _gameWorld.FetchAsync(env);
                break;
            }

            // ── Popup Notice ────────────────────────────────────
            case "popup.created":
            case "popup.updated":
            {
                if (!features.PopupNotice) break;
                if (env is null) { LogMissingEnv(evt.Type); break; }

                var isVisible = evt.Data.GetIsVisible();
                var id = evt.Data.GetIdAsInt();
                if (id is null) { _logger.LogWarning("PopupNotice event missing id"); break; }

                await _popupNotice.UpdateSingleNoticeAsync(id.Value, env, isVisible);
                break;
            }

            case "popup.deleted":
            {
                if (!features.PopupNotice) break;
                if (env is null) { LogMissingEnv(evt.Type); break; }

                var id = evt.Data.GetIdAsInt();
                if (id is null) break;
                _popupNotice.RemoveNotice(id.Value, env);
                break;
            }

            // ── Survey ──────────────────────────────────────────
            case "survey.created":
            case "survey.updated":
            {
                if (!features.Survey) break;
                if (env is null) { LogMissingEnv(evt.Type); break; }

                var isActive = evt.Data.GetIsActive();
                var id = evt.Data.GetIdAsString();
                if (id is null) { _logger.LogWarning("Survey event missing id"); break; }

                await _survey.UpdateSingleSurveyAsync(id, env, isActive);
                break;
            }

            case "survey.deleted":
            {
                if (!features.Survey) break;
                if (env is null) { LogMissingEnv(evt.Type); break; }

                var id = evt.Data.GetIdAsString();
                if (id is null) break;
                _survey.RemoveSurvey(id, env);
                break;
            }

            case "survey.settings.updated":
            {
                if (!features.Survey) break;
                if (env is null) { LogMissingEnv(evt.Type); break; }

                _logger.LogInformation("Survey settings updated, refreshing surveys for {Env}", env);
                await _survey.FetchAsync(env);
                break;
            }

            // ── Whitelist (singleton — always full refresh) ─────
            case "whitelist.updated":
            {
                if (!features.Whitelist) break;
                if (env is null) { LogMissingEnv(evt.Type); break; }

                _logger.LogInformation("Whitelist updated, refreshing for {Env}", env);
                await _whitelist.FetchAsync(env);
                break;
            }

            // ── Service Maintenance (singleton — always full refresh) ──
            case "maintenance.settings.updated":
            {
                if (!features.ServiceMaintenance) break;
                if (env is null) { LogMissingEnv(evt.Type); break; }

                _logger.LogInformation("Maintenance settings updated, refreshing for {Env}", env);
                await _serviceMaintenance.FetchAsync(env);
                break;
            }

            // ── Store Product ───────────────────────────────────
            case "store_product.created":
            case "store_product.updated":
            {
                if (!features.StoreProduct) break;
                if (env is null) { LogMissingEnv(evt.Type); break; }

                var isActive = evt.Data.GetIsActive();
                var id = evt.Data.GetIdAsString();
                if (id is null) { _logger.LogWarning("StoreProduct event missing id"); break; }

                await _storeProduct.UpdateSingleProductAsync(id, env, isActive);
                break;
            }

            case "store_product.deleted":
            {
                if (!features.StoreProduct) break;
                if (env is null) { LogMissingEnv(evt.Type); break; }

                var id = evt.Data.GetIdAsString();
                if (id is null) break;
                _storeProduct.RemoveProduct(id, env);
                break;
            }

            case "store_product.bulk_updated":
            {
                if (!features.StoreProduct) break;
                if (env is null) { LogMissingEnv(evt.Type); break; }

                _logger.LogInformation("StoreProduct bulk update, full refresh for {Env}", env);
                await _storeProduct.FetchAsync(env);
                break;
            }

            // ── Feature Flag (Granular) ────────────────────────
            // Backend sends 'feature_flag.changed' with changedKeys[] and changeType
            case "feature_flag.changed":
            {
                if (!features.FeatureFlag) break;
                if (env is null) { LogMissingEnv(evt.Type); break; }

                var changedKeys = evt.Data.ChangedKeys ?? [];
                var changeType = evt.Data.ChangeType ?? "definition_changed";
                var flagService = _featureFlag as FeatureFlagService;

                _logger.LogInformation("Feature flag event: changeType={ChangeType}, keys={Keys}, env={Env}",
                    changeType, string.Join(",", changedKeys), env);

                if (changedKeys.Count == 0)
                {
                    // No specific keys — full environment refresh
                    if (_cacheManager != null)
                        await _cacheManager.RefreshFeatureFlagsAsync(env);
                }
                else if (changeType == "deleted")
                {
                    // Remove from cache directly (no API call needed)
                    var cache = flagService?.GetCache();
                    if (cache != null)
                    {
                        foreach (var key in changedKeys)
                            cache.RemoveFlag(key, env);
                    }
                    _logger.LogInformation("Flags removed from cache: {Keys} in {Env}",
                        string.Join(",", changedKeys), env);
                }
                else
                {
                    // enabled_changed or definition_changed — re-fetch flags
                    // For now, uses full env refresh as the API lacks single-flag endpoint
                    if (flagService != null)
                        await flagService.FetchSingleFlagAsync(changedKeys[0], env);
                    else if (_cacheManager != null)
                        await _cacheManager.RefreshFeatureFlagsAsync(env);
                }
                break;
            }

            // ── Vars (Granular) ──────────────────────────────────
            case "vars.updated":
            {
                if (!features.Vars) break;
                if (env is null) { LogMissingEnv(evt.Type); break; }

                var varKey = evt.Data.Key;
                var varValue = evt.Data.Value;

                _logger.LogInformation("Vars update event: key={Key}, hasValue={HasValue}, env={Env}",
                    varKey, varValue != null, env);

                // Always do full refresh since we need the complete VarItem structure
                if (_cacheManager != null)
                    await _cacheManager.RefreshVarsAsync(env);
                break;
            }

            // ── Segment (Granular) ───────────────────────────────
            // Segments are global — only update the segment cache, NOT all flags
            case "segment.created":
            case "segment.updated":
            {
                if (!features.FeatureFlag) break;

                var segmentData = evt.Data.Segment;
                var segmentName = evt.Data.SegmentName;
                var flagServiceSeg = _featureFlag as FeatureFlagService;
                var cache = flagServiceSeg?.GetCache();

                _logger.LogInformation("Segment event ({Type}): name={Name}, hasData={HasData}",
                    evt.Type, segmentName, segmentData.HasValue);

                if (segmentData.HasValue && cache != null)
                {
                    try
                    {
                        var segment = segmentData.Value.Deserialize<Models.FeatureSegment>();
                        if (segment != null)
                        {
                            cache.UpsertSegment(segment);
                            _logger.LogInformation("Segment updated in cache directly: {Name}", segmentName);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to deserialize segment data, falling back to full refresh");
                        if (_cacheManager != null)
                            await _cacheManager.RefreshFeatureFlagsAsync();
                    }
                }
                else
                {
                    // No full data — refresh flags (which includes segments)
                    if (_cacheManager != null)
                        await _cacheManager.RefreshFeatureFlagsAsync();
                }
                break;
            }

            case "segment.deleted":
            {
                if (!features.FeatureFlag) break;

                var deletedSegmentName = evt.Data.SegmentName;
                var flagServiceSegDel = _featureFlag as FeatureFlagService;
                var cacheDel = flagServiceSegDel?.GetCache();

                if (deletedSegmentName != null && cacheDel != null)
                {
                    cacheDel.RemoveSegment(deletedSegmentName);
                    _logger.LogInformation("Segment removed from cache: {Name}", deletedSegmentName);
                }
                else
                {
                    // Fallback: full refresh
                    if (_cacheManager != null)
                        await _cacheManager.RefreshFeatureFlagsAsync();
                }
                break;
            }

            // ── Client Version (Granular) ────────────────────────
            case "client_version.created":
            case "client_version.updated":
            {
                if (!features.ClientVersion) break;
                if (env is null) { LogMissingEnv(evt.Type); break; }

                var cvData = evt.Data.ClientVersion;
                if (cvData.HasValue)
                {
                    try
                    {
                        var cv = cvData.Value.Deserialize<Models.ClientVersion>();
                        if (cv != null)
                        {
                            _clientVersion.UpsertSingle(cv, env);
                            _logger.LogInformation("Client version updated in cache directly: {Id} in {Env}", evt.Data.GetIdAsInt(), env);
                            break;
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to deserialize client version data, falling back to refresh");
                    }
                }

                // Fallback: full refresh
                _logger.LogInformation("Client version event ({Type}), refreshing for {Env}", evt.Type, env);
                await _clientVersion.FetchAsync(env);
                break;
            }

            case "client_version.deleted":
            {
                if (!features.ClientVersion) break;
                if (env is null) { LogMissingEnv(evt.Type); break; }

                var cvId = evt.Data.GetIdAsInt();
                if (cvId != null)
                {
                    _clientVersion.Remove(cvId.Value, env);
                    _logger.LogInformation("Client version removed from cache: {Id} in {Env}", cvId, env);
                }
                else
                {
                    await _clientVersion.FetchAsync(env);
                }
                break;
            }

            // ── Banner (Granular) ────────────────────────────────
            case "banner.created":
            case "banner.updated":
            {
                if (!features.Banner) break;
                if (env is null) { LogMissingEnv(evt.Type); break; }

                // If status is "draft" or "archived", remove from cache (not visible)
                var bannerStatus = evt.Data.Status;
                if (bannerStatus is "draft" or "archived")
                {
                    var removeId = evt.Data.GetIdAsInt();
                    if (removeId != null)
                    {
                        _banner.Remove(removeId.Value, env);
                        _logger.LogInformation("Banner removed from cache (status={Status}): {Id} in {Env}", bannerStatus, removeId, env);
                        break;
                    }
                }

                // Fallback: full refresh (banner data not included in event payload)
                _logger.LogInformation("Banner event ({Type}), refreshing for {Env}", evt.Type, env);
                await _banner.FetchAsync(env);
                break;
            }

            case "banner.deleted":
            {
                if (!features.Banner) break;
                if (env is null) { LogMissingEnv(evt.Type); break; }

                var bannerId = evt.Data.GetIdAsInt();
                if (bannerId != null)
                {
                    _banner.Remove(bannerId.Value, env);
                    _logger.LogInformation("Banner removed from cache: {Id} in {Env}", bannerId, env);
                }
                else
                {
                    await _banner.FetchAsync(env);
                }
                break;
            }

            // ── Service Notice (Granular) ────────────────────────
            case "service_notice.created":
            case "service_notice.updated":
            {
                if (!features.ServiceNotice) break;
                if (env is null) { LogMissingEnv(evt.Type); break; }

                var noticeData = evt.Data.ServiceNotice;
                if (noticeData.HasValue)
                {
                    try
                    {
                        var notice = noticeData.Value.Deserialize<Models.ServiceNotice>();
                        if (notice != null)
                        {
                            _serviceNotice.UpsertSingle(notice, env);
                            _logger.LogInformation("Service notice updated in cache directly: {Id} in {Env}", evt.Data.GetIdAsInt(), env);
                            break;
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to deserialize service notice data, falling back to refresh");
                    }
                }

                // Fallback: full refresh
                _logger.LogInformation("Service notice event ({Type}), refreshing for {Env}", evt.Type, env);
                await _serviceNotice.FetchAsync(env);
                break;
            }

            case "service_notice.deleted":
            {
                if (!features.ServiceNotice) break;
                if (env is null) { LogMissingEnv(evt.Type); break; }

                var noticeId = evt.Data.GetIdAsInt();
                if (noticeId != null)
                {
                    _serviceNotice.Remove(noticeId.Value, env);
                    _logger.LogInformation("Service notice removed from cache: {Id} in {Env}", noticeId, env);
                }
                else
                {
                    await _serviceNotice.FetchAsync(env);
                }
                break;
            }

            // ── Environment (wildcard mode) ───────────────────
            case "environment.created":
            case "environment.deleted":
            {
                _logger.LogInformation("Environment change event ({Type}), triggering full refresh", evt.Type);
                if (_cacheManager != null)
                    await _cacheManager.RefreshAsync();
                break;
            }

            default:
                _logger.LogDebug("Unknown event type: {Type}", evt.Type);
                break;
        }
    }

    private void LogMissingEnv(string eventType) =>
        _logger.LogWarning("{EventType} event missing environment, skipping", eventType);

    // ══════════════════════════════════════════════════════════════
    //  User Event Subscription API
    // ══════════════════════════════════════════════════════════════

    /// <summary>
    /// Register a callback for a specific event type.
    /// Use "*" for wildcard (all events).
    /// Returns an Action that unsubscribes this specific callback.
    /// </summary>
    public Action On(string eventType, SdkEventCallback callback)
    {
        var list = _listeners.GetOrAdd(eventType, _ => []);
        lock (list) { list.Add(callback); }
        _logger.LogDebug("Event listener registered for {EventType}", eventType);
        return () => Off(eventType, callback);
    }

    /// <summary>Unregister a specific callback.</summary>
    public void Off(string eventType, SdkEventCallback callback)
    {
        if (_listeners.TryGetValue(eventType, out var list))
            lock (list) { list.Remove(callback); }
    }

    /// <summary>Remove all listeners (optionally for a specific event type).</summary>
    public void RemoveAllListeners(string? eventType = null)
    {
        if (eventType is not null)
            _listeners.TryRemove(eventType, out _);
        else
            _listeners.Clear();
    }

    private async Task EmitToListenersAsync(SdkEvent sdkEvent)
    {
        var callbacks = new List<SdkEventCallback>();

        if (_listeners.TryGetValue(sdkEvent.Type, out var typed))
            lock (typed) { callbacks.AddRange(typed); }

        if (_listeners.TryGetValue("*", out var wildcard))
            lock (wildcard) { callbacks.AddRange(wildcard); }

        if (callbacks.Count == 0) return;

        // Ensure timestamp is set
        sdkEvent.Timestamp ??= DateTime.UtcNow.ToString("o");

        foreach (var cb in callbacks)
        {
            try { await cb(sdkEvent); }
            catch (Exception ex)
            {
                _logger.LogError(ex, "User event listener error for {Type}", sdkEvent.Type);
            }
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  Dispose
    // ══════════════════════════════════════════════════════════════

    public async ValueTask DisposeAsync()
    {
        _isShuttingDown = true;
        _isConnected = false;

        if (_subscriber is not null)
        {
            try { await _subscriber.UnsubscribeAsync(RedisChannel.Literal(ChannelName)); }
            catch { /* suppress during shutdown */ }
        }

        if (_redis is not null)
        {
            try
            {
                await _redis.CloseAsync();
                await _redis.DisposeAsync();
            }
            catch { /* suppress during shutdown */ }
        }

        RemoveAllListeners();
        _logger.LogInformation("Redis event listener closed");
        GC.SuppressFinalize(this);
    }
}
