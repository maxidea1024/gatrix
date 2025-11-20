using Gatrix.ServerSDK.Cache;
using Gatrix.ServerSDK.Client;
using Gatrix.ServerSDK.Types;
using Gatrix.ServerSDK.Utils;

namespace Gatrix.ServerSDK;

/// <summary>
/// Gatrix Server-side SDK for .NET
/// Provides easy access to Gatrix backend APIs with caching, event handling, and service discovery
/// </summary>
public class GatrixServerSDK : IAsyncDisposable
{
    private readonly GatrixSDKConfig _config;
    private readonly GatrixLogger _logger;
    private readonly ApiClient _apiClient;
    private readonly CacheManager _cacheManager;
    private EventListener? _eventListener;

    public GatrixServerSDK(GatrixSDKConfig config, GatrixLogger logger, ApiClient apiClient)
    {
        _config = config;
        _logger = logger;
        _apiClient = apiClient;
        _cacheManager = new CacheManager(_config.Cache, _apiClient, _logger);
    }

    /// <summary>
    /// Initialize SDK
    /// </summary>
    public async Task InitializeAsync()
    {
        _logger.Info("Initializing GatrixServerSDK...");

        try
        {
            // Initialize cache
            await _cacheManager.InitializeAsync(_config.GatrixUrl);

            // Initialize event listener only if using event-based refresh method
            var refreshMethod = _config.Cache.RefreshMethod;
            if (_config.Redis != null && refreshMethod == CacheRefreshMethod.Event)
            {
                _eventListener = new EventListener(_config.Redis, _cacheManager, _logger);
                await _eventListener.InitializeAsync();
            }

            _logger.Info("GatrixServerSDK initialized successfully");
        }
        catch (Exception ex)
        {
            _logger.Error("Failed to initialize SDK", new { error = ex.Message });
            throw;
        }
    }

    /// <summary>
    /// Close SDK
    /// </summary>
    public async Task CloseAsync()
    {
        _logger.Info("Closing GatrixServerSDK...");

        try
        {
            _cacheManager.StopAutoRefresh();

            if (_eventListener != null)
            {
                await _eventListener.CloseAsync();
            }

            _logger.Info("GatrixServerSDK closed successfully");
            _logger.Info("SDK가 종료되었습니다.");
        }
        catch (Exception ex)
        {
            _logger.Error("Failed to close SDK", new { error = ex.Message });
            throw;
        }
    }

    /// <summary>
    /// Async dispose
    /// </summary>
    public async ValueTask DisposeAsync()
    {
        await CloseAsync();
        GC.SuppressFinalize(this);
    }

    /// <summary>
    /// Get all game worlds from cache
    /// </summary>
    public List<GameWorld> GetCachedGameWorlds() => _cacheManager.GetGameWorlds();

    /// <summary>
    /// Get game world by ID from cache
    /// </summary>
    public GameWorld? GetCachedGameWorldById(string id) => _cacheManager.GetGameWorldById(id);

    /// <summary>
    /// Get all popup notices from cache
    /// </summary>
    public List<PopupNotice> GetCachedPopupNotices() => _cacheManager.GetPopupNotices();

    /// <summary>
    /// Get popup notice by ID from cache
    /// </summary>
    public PopupNotice? GetCachedPopupNoticeById(string id) => _cacheManager.GetPopupNoticeById(id);

    /// <summary>
    /// Get all surveys from cache
    /// </summary>
    public List<Survey> GetCachedSurveys() => _cacheManager.GetSurveys();

    /// <summary>
    /// Get survey by ID from cache
    /// </summary>
    public Survey? GetCachedSurveyById(string id) => _cacheManager.GetSurveyById(id);

    /// <summary>
    /// [Obsolete] Use GetCachedGameWorlds instead. This method will be removed in a future version.
    /// </summary>
    [Obsolete("Use GetCachedGameWorlds() instead. This method will be removed in a future version.")]
    public List<GameWorld> GetGameWorlds() => GetCachedGameWorlds();

    /// <summary>
    /// [Obsolete] Use GetCachedGameWorldById instead. This method will be removed in a future version.
    /// </summary>
    [Obsolete("Use GetCachedGameWorldById() instead. This method will be removed in a future version.")]
    public GameWorld? GetGameWorldById(string id) => GetCachedGameWorldById(id);

    /// <summary>
    /// [Obsolete] Use GetCachedPopupNotices instead. This method will be removed in a future version.
    /// </summary>
    [Obsolete("Use GetCachedPopupNotices() instead. This method will be removed in a future version.")]
    public List<PopupNotice> GetPopupNotices() => GetCachedPopupNotices();

    /// <summary>
    /// [Obsolete] Use GetCachedPopupNoticeById instead. This method will be removed in a future version.
    /// </summary>
    [Obsolete("Use GetCachedPopupNoticeById() instead. This method will be removed in a future version.")]
    public PopupNotice? GetPopupNoticeById(string id) => GetCachedPopupNoticeById(id);

    /// <summary>
    /// [Obsolete] Use GetCachedSurveys instead. This method will be removed in a future version.
    /// </summary>
    [Obsolete("Use GetCachedSurveys() instead. This method will be removed in a future version.")]
    public List<Survey> GetSurveys() => GetCachedSurveys();

    /// <summary>
    /// [Obsolete] Use GetCachedSurveyById instead. This method will be removed in a future version.
    /// </summary>
    [Obsolete("Use GetCachedSurveyById() instead. This method will be removed in a future version.")]
    public Survey? GetSurveyById(string id) => GetCachedSurveyById(id);

    /// <summary>
    /// Refresh all caches
    /// </summary>
    public async Task RefreshCacheAsync()
    {
        await _cacheManager.RefreshAllAsync(_config.GatrixUrl);
    }

    /// <summary>
    /// Register service instance via Backend API
    /// </summary>
    public async Task<ServiceRegistrationResponse> RegisterServiceAsync(RegisterServiceInput input)
    {
        // Auto-detect hostname and internalAddress if not provided
        var hostname = input.Hostname ?? Environment.MachineName;
        var internalAddress = input.InternalAddress ?? GetFirstNicAddress();

        var registrationInput = new RegisterServiceInput
        {
            Labels = input.Labels,
            Hostname = hostname,
            InternalAddress = internalAddress,
            Ports = input.Ports,
            Status = input.Status,
            Stats = input.Stats,
            Meta = input.Meta
        };

        _logger.Info("Registering service via API", new { hostname, internalAddress });

        var response = await _apiClient.PostAsync<ApiResponse<ServiceRegistrationResponse>>(
            "/api/v1/server/services/register",
            registrationInput
        );

        if (!response.Success || response.Data == null)
        {
            throw new InvalidOperationException(response.Message ?? "Failed to register service");
        }

        _logger.Info("Service registered via API", new
        {
            instanceId = response.Data.InstanceId,
            labels = input.Labels,
            hostname = response.Data.Hostname,
            internalAddress = internalAddress,
            externalAddress = response.Data.ExternalAddress
        });

        return response.Data;
    }

    /// <summary>
    /// Get the first non-internal IPv4 address from network interfaces
    /// </summary>
    private static string GetFirstNicAddress()
    {
        try
        {
            var interfaces = System.Net.NetworkInformation.NetworkInterface.GetAllNetworkInterfaces();

            // First pass: Look for non-internal IPv4 addresses
            foreach (var iface in interfaces)
            {
                if (iface.OperationalStatus != System.Net.NetworkInformation.OperationalStatus.Up)
                    continue;

                var props = iface.GetIPProperties();
                foreach (var addr in props.UnicastAddresses)
                {
                    if (addr.Address.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork)
                    {
                        var ipStr = addr.Address.ToString();
                        if (!ipStr.StartsWith("127."))
                        {
                            return ipStr;
                        }
                    }
                }
            }

            // Fallback to localhost
            return "127.0.0.1";
        }
        catch
        {
            return "127.0.0.1";
        }
    }

    /// <summary>
    /// Register event listener
    /// Works with both event-based and polling refresh methods
    /// Returns a function to unregister the listener
    /// </summary>
    public Action On(string eventType, Func<SdkEvent, Task> callback)
    {
        var refreshMethod = _config.Cache?.RefreshMethod ?? CacheRefreshMethod.Polling;

        // For event-based refresh, use EventListener
        if (refreshMethod == CacheRefreshMethod.Event)
        {
            if (_eventListener == null)
            {
                throw new InvalidOperationException("Event listener not initialized. Ensure Redis is configured and refreshMethod is set to 'event'.");
            }

            return _eventListener.On(eventType, callback);
        }
        // For polling refresh, register callback with CacheManager
        else if (refreshMethod == CacheRefreshMethod.Polling)
        {
            if (_cacheManager == null)
            {
                throw new InvalidOperationException("Cache manager not initialized.");
            }

            var unsubscribe = _cacheManager.OnRefresh((type, data) =>
            {
                // Convert cache refresh events to SDK events
                var sdkEvent = new SdkEvent
                {
                    Type = type,
                    Data = data,
                    Timestamp = DateTime.UtcNow
                };
                callback(sdkEvent).GetAwaiter().GetResult();
            });
            return unsubscribe;
        }

        return () => { }; // Return no-op function as fallback
    }

    /// <summary>
    /// Unregister event listener
    /// </summary>
    public void Off(string eventType, Func<SdkEvent, Task> callback)
    {
        var refreshMethod = _config.Cache?.RefreshMethod ?? CacheRefreshMethod.Polling;

        // For event-based refresh, use EventListener
        if (refreshMethod == CacheRefreshMethod.Event)
        {
            if (_eventListener == null)
            {
                throw new InvalidOperationException("Event listener not initialized.");
            }

            _eventListener.Off(eventType, callback);
        }
        // For polling refresh, we don't have a way to unregister specific callbacks
        // This is a limitation of the current implementation
    }
}

