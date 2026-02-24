using Gatrix.Server.Sdk.Client;
using Gatrix.Server.Sdk.Events;
using Gatrix.Server.Sdk.Models;
using Gatrix.Server.Sdk.Options;
using Gatrix.Server.Sdk.Services;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Gatrix.Server.Sdk.Cache;

/// <summary>
/// Background service that manages all service caches.
/// Supports three refresh methods:
///   - "polling" (default): periodic Timer-based refresh
///   - "event": Redis Pub/Sub via EventListener (immediate invalidation)
///   - "manual": no background refresh, call RefreshAsync() explicitly
/// Also starts the FlagMetricsService flush timer.
/// </summary>
public class CacheManager : ICacheManager, IHostedService, IDisposable
{
    private readonly GatrixApiClient _apiClient;
    private readonly FlagDefinitionCache _flagCache;
    private readonly GatrixSdkOptions _options;
    private readonly ILogger<CacheManager> _logger;
    private readonly FlagMetricsService _flagMetrics;
    private readonly EventListener _eventListener;

    // Domain services for cache refresh
    private readonly IGameWorldService _gameWorld;
    private readonly IPopupNoticeService _popupNotice;
    private readonly ISurveyService _survey;
    private readonly IWhitelistService _whitelist;
    private readonly IServiceMaintenanceService _serviceMaintenance;
    private readonly IStoreProductService _storeProduct;

    private Timer? _pollingTimer;
    private bool _disposed;

    public CacheManager(
        GatrixApiClient apiClient,
        FlagDefinitionCache flagCache,
        IOptions<GatrixSdkOptions> options,
        ILogger<CacheManager> logger,
        FlagMetricsService flagMetrics,
        EventListener eventListener,
        IGameWorldService gameWorld,
        IPopupNoticeService popupNotice,
        ISurveyService survey,
        IWhitelistService whitelist,
        IServiceMaintenanceService serviceMaintenance,
        IStoreProductService storeProduct)
    {
        _apiClient = apiClient;
        _flagCache = flagCache;
        _options = options.Value;
        _logger = logger;
        _flagMetrics = flagMetrics;
        _eventListener = eventListener;
        _gameWorld = gameWorld;
        _popupNotice = popupNotice;
        _survey = survey;
        _whitelist = whitelist;
        _serviceMaintenance = serviceMaintenance;
        _storeProduct = storeProduct;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        if (!_options.Cache.Enabled)
        {
            _logger.LogInformation("Gatrix cache is disabled");
            return;
        }

        _logger.LogInformation("Gatrix CacheManager starting (method={Method}, ttl={Ttl}s)",
            _options.Cache.RefreshMethod, _options.Cache.Ttl);

        // Wire EventListener → CacheManager reference (breaks circular DI)
        _eventListener.SetCacheManager(this);

        // Initial fetch
        await RefreshAsync(cancellationToken);

        // Start refresh strategy
        switch (_options.Cache.RefreshMethod)
        {
            case "polling":
                var intervalMs = _options.Cache.Ttl * 1000;
                _pollingTimer = new Timer(
                    async _ => await RefreshSafe(),
                    state: null,
                    dueTime: intervalMs,
                    period: intervalMs);
                _logger.LogInformation("Polling started with {Interval}ms interval", intervalMs);
                break;

            case "event":
                try
                {
                    await _eventListener.InitializeAsync(cancellationToken);
                    _logger.LogInformation("Redis event listener started for real-time cache invalidation");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to start Redis event listener — falling back to polling");
                    var fallbackMs = _options.Cache.Ttl * 1000;
                    _pollingTimer = new Timer(
                        async _ => await RefreshSafe(),
                        state: null,
                        dueTime: fallbackMs,
                        period: fallbackMs);
                }
                break;

            case "manual":
                _logger.LogInformation("Manual refresh mode — no background refresh");
                break;

            default:
                _logger.LogWarning("Unknown refreshMethod '{Method}' — defaulting to polling",
                    _options.Cache.RefreshMethod);
                goto case "polling";
        }

        // Start flag metrics flush timer
        _flagMetrics.Start();
    }

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Gatrix CacheManager stopping");
        _pollingTimer?.Change(Timeout.Infinite, 0);

        if (_eventListener.IsConnected)
        {
            await _eventListener.DisposeAsync();
        }
    }

    /// <summary>Manually trigger a full cache refresh for all target environments.</summary>
    public async Task RefreshAsync(CancellationToken ct = default)
    {
        try
        {
            var environments = await GetTargetEnvironmentsAsync(ct);

            if (environments.Count == 0)
            {
                _logger.LogWarning("No target environments resolved — skipping cache refresh");
                return;
            }

            var tasks = new List<Task>();
            foreach (var env in environments)
            {
                tasks.Add(RefreshForEnvironmentAsync(env, ct));
            }
            await Task.WhenAll(tasks);

            _logger.LogDebug("Cache refresh completed for {Count} environment(s)", environments.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Cache refresh failed — serving stale data");
        }
    }

    /// <summary>Refresh all enabled services for a single environment.</summary>
    private async Task RefreshForEnvironmentAsync(string env, CancellationToken ct)
    {
        var features = _options.Features;
        var tasks = new List<Task>();

        if (features.FeatureFlag) tasks.Add(RefreshFeatureFlagsAsync(env, ct));
        if (features.GameWorld) tasks.Add(_gameWorld.FetchAsync(env, ct));
        if (features.PopupNotice) tasks.Add(_popupNotice.FetchAsync(env, ct));
        if (features.Survey) tasks.Add(_survey.FetchAsync(env, ct));
        if (features.Whitelist) tasks.Add(_whitelist.FetchAsync(env, ct));
        if (features.ServiceMaintenance) tasks.Add(_serviceMaintenance.FetchAsync(env, ct));
        if (features.StoreProduct) tasks.Add(_storeProduct.FetchAsync(env, ct));

        await Task.WhenAll(tasks);
    }

    /// <summary>
    /// Resolve target environments based on configuration.
    /// Single-env mode: returns [Environment].
    /// Explicit list: returns the configured list.
    /// Wildcard ("*"): fetches all active environments from backend.
    /// </summary>
    private async Task<List<string>> GetTargetEnvironmentsAsync(CancellationToken ct)
    {
        if (!_options.IsMultiEnvironmentMode)
        {
            return [_options.Environment];
        }

        if (_options.IsWildcardMode)
        {
            // Fetch all active environments from backend
            try
            {
                var response = await _apiClient.GetAsync<EnvironmentListResponse>(
                    "/api/v1/server/internal/environments", ct);

                if (response.Success && response.Data?.Environments is { Count: > 0 })
                {
                    var envNames = response.Data.Environments
                        .Select(e => e.Environment)
                        .ToList();
                    _logger.LogInformation("Wildcard mode: resolved {Count} environments from backend",
                        envNames.Count);
                    return envNames;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to fetch environment list from backend");
            }

            return [];
        }

        // Explicit list — filter out the "*" marker
        return _options.Environments!
            .Where(e => e != "*")
            .ToList();
    }

    /// <summary>Refresh ONLY feature flags (flags + segments) for a specific environment.</summary>
    public async Task RefreshFeatureFlagsAsync(string? environment = null, CancellationToken ct = default)
    {
        var env = environment ?? _options.Environment;
        try
        {
            var response = await _apiClient.GetAsync<FeatureFlagsApiResponse>(
                $"/api/v1/server/{Uri.EscapeDataString(env)}/features", ct);

            if (!response.Success || response.Data is null)
            {
                _logger.LogWarning("Failed to fetch feature flags for {Environment}", env);
                return;
            }

            _flagCache.Update(response.Data.Flags, response.Data.Segments, env);
            _logger.LogInformation("Feature flags cached: {FlagCount} flags, {SegmentCount} segments",
                response.Data.Flags.Count, response.Data.Segments.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to refresh feature flags for {Environment}", env);
        }
    }

    private async Task RefreshSafe()
    {
        try { await RefreshAsync(); }
        catch (Exception ex) { _logger.LogError(ex, "Background cache refresh failed"); }
    }

    public void Dispose()
    {
        if (_disposed) return;
        _pollingTimer?.Dispose();
        _disposed = true;
        GC.SuppressFinalize(this);
    }
}
