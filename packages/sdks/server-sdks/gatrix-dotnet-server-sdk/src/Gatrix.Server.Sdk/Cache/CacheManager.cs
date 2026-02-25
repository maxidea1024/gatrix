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
public partial class CacheManager : ICacheManager, IHostedService, IDisposable
{
    private readonly GatrixApiClient _apiClient;
    private readonly FlagDefinitionCache _flagCache;
    private readonly IFeatureFlagService _featureFlag;
    private readonly GatrixSdkOptions _options;
    private readonly ILogger<CacheManager> _logger;
    private readonly FlagMetricsService _flagMetrics;
    private readonly EventListener _eventListener;
    private readonly ICacheStorageProvider? _storage;

    // Domain services for cache refresh
    private readonly IGameWorldService _gameWorld;
    private readonly IPopupNoticeService _popupNotice;
    private readonly ISurveyService _survey;
    private readonly IWhitelistService _whitelist;
    private readonly IServiceMaintenanceService _serviceMaintenance;
    private readonly IStoreProductService _storeProduct;
    private readonly IClientVersionService _clientVersion;
    private readonly IServiceNoticeService _serviceNotice;
    private readonly IBannerService _banner;
    private readonly IVarsService _vars;

    private Timer? _pollingTimer;
    private bool _disposed;

    public CacheManager(
        GatrixApiClient apiClient,
        FlagDefinitionCache flagCache,
        IFeatureFlagService featureFlag,
        IOptions<GatrixSdkOptions> options,
        ILogger<CacheManager> logger,
        FlagMetricsService flagMetrics,
        EventListener eventListener,
        IGameWorldService gameWorld,
        IPopupNoticeService popupNotice,
        ISurveyService survey,
        IWhitelistService whitelist,
        IServiceMaintenanceService serviceMaintenance,
        IStoreProductService storeProduct,
        IClientVersionService clientVersion,
        IServiceNoticeService serviceNotice,
        IBannerService banner,
        IVarsService vars,
        ICacheStorageProvider? storage = null)
    {
        _apiClient = apiClient;
        _flagCache = flagCache;
        _featureFlag = featureFlag;
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
        _clientVersion = clientVersion;
        _serviceNotice = serviceNotice;
        _banner = banner;
        _vars = vars;
        _storage = storage;
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

        // Initial load from storage
        await InitializeAsync(cancellationToken);

        // Initial fetch from remote
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
