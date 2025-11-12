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
    /// Get all game worlds
    /// </summary>
    public List<GameWorld> GetGameWorlds() => _cacheManager.GetGameWorlds();

    /// <summary>
    /// Get game world by ID
    /// </summary>
    public GameWorld? GetGameWorldById(string id) => _cacheManager.GetGameWorldById(id);

    /// <summary>
    /// Get all popup notices
    /// </summary>
    public List<PopupNotice> GetPopupNotices() => _cacheManager.GetPopupNotices();

    /// <summary>
    /// Get popup notice by ID
    /// </summary>
    public PopupNotice? GetPopupNoticeById(string id) => _cacheManager.GetPopupNoticeById(id);

    /// <summary>
    /// Get all surveys
    /// </summary>
    public List<Survey> GetSurveys() => _cacheManager.GetSurveys();

    /// <summary>
    /// Get survey by ID
    /// </summary>
    public Survey? GetSurveyById(string id) => _cacheManager.GetSurveyById(id);

    /// <summary>
    /// Refresh all caches
    /// </summary>
    public async Task RefreshCacheAsync()
    {
        await _cacheManager.RefreshAllAsync(_config.GatrixUrl);
    }

    /// <summary>
    /// Register event listener
    /// </summary>
    public void On(string eventType, Func<SdkEvent, Task> callback)
    {
        if (_eventListener == null)
        {
            throw new InvalidOperationException("Event listener not initialized. Ensure Redis is configured and refreshMethod is set to 'event'.");
        }

        _eventListener.On(eventType, callback);
    }

    /// <summary>
    /// Unregister event listener
    /// </summary>
    public void Off(string eventType, Func<SdkEvent, Task> callback)
    {
        if (_eventListener == null)
        {
            throw new InvalidOperationException("Event listener not initialized.");
        }

        _eventListener.Off(eventType, callback);
    }
}

