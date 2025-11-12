using Gatrix.ServerSDK.Client;
using Gatrix.ServerSDK.Types;
using Gatrix.ServerSDK.Utils;

namespace Gatrix.ServerSDK.Cache;

/// <summary>
/// Cache manager for SDK data
/// </summary>
public class CacheManager
{
    private readonly CacheConfig _config;
    private readonly ApiClient _apiClient;
    private readonly GatrixLogger _logger;
    private Timer? _refreshTimer;
    private readonly List<Action<string, object>> _refreshCallbacks = [];

    private List<GameWorld> _gameWorlds = [];
    private List<PopupNotice> _popupNotices = [];
    private List<Survey> _surveys = [];

    public CacheManager(CacheConfig config, ApiClient apiClient, GatrixLogger logger)
    {
        _config = config;
        _apiClient = apiClient;
        _logger = logger;
    }

    /// <summary>
    /// Register callback for cache refresh events
    /// </summary>
    public void OnRefresh(Action<string, object> callback)
    {
        _refreshCallbacks.Add(callback);
    }

    /// <summary>
    /// Emit refresh event to all registered callbacks
    /// </summary>
    private void EmitRefreshEvent(string type, object data)
    {
        foreach (var callback in _refreshCallbacks)
        {
            try
            {
                callback(type, data);
            }
            catch (Exception ex)
            {
                _logger.Error("Error in refresh callback", new { error = ex.Message });
            }
        }
    }

    /// <summary>
    /// Initialize cache
    /// </summary>
    public async Task InitializeAsync(string gatrixUrl)
    {
        _logger.Info("Initializing cache...");

        try
        {
            // Load all data in parallel
            await Task.WhenAll(
                LoadGameWorldsAsync(gatrixUrl),
                LoadPopupNoticesAsync(gatrixUrl),
                LoadSurveysAsync(gatrixUrl)
            );

            _logger.Info("Cache initialized successfully");

            // Setup auto-refresh if using polling method
            if (_config.RefreshMethod == CacheRefreshMethod.Polling && _config.Ttl > 0)
            {
                StartAutoRefresh(gatrixUrl);
            }
        }
        catch (Exception ex)
        {
            _logger.Error("Failed to initialize cache", new { error = ex.Message });
            throw;
        }
    }

    /// <summary>
    /// Load game worlds
    /// </summary>
    private async Task LoadGameWorldsAsync(string gatrixUrl)
    {
        try
        {
            var response = await _apiClient.GetAsync<ApiResponse<List<GameWorld>>>($"{gatrixUrl}/api/game-worlds");
            _gameWorlds = response.Data ?? [];
            _logger.Info("Game worlds fetched", new { count = _gameWorlds.Count });
        }
        catch (Exception ex)
        {
            _logger.Warn("Failed to load game worlds", new { error = ex.Message });
        }
    }

    /// <summary>
    /// Load popup notices
    /// </summary>
    private async Task LoadPopupNoticesAsync(string gatrixUrl)
    {
        try
        {
            var response = await _apiClient.GetAsync<ApiResponse<List<PopupNotice>>>($"{gatrixUrl}/api/popup-notices");
            _popupNotices = response.Data ?? [];
            _logger.Info("Popup notices fetched", new { count = _popupNotices.Count });
        }
        catch (Exception ex)
        {
            _logger.Warn("Failed to load popup notices", new { error = ex.Message });
        }
    }

    /// <summary>
    /// Load surveys
    /// </summary>
    private async Task LoadSurveysAsync(string gatrixUrl)
    {
        try
        {
            var response = await _apiClient.GetAsync<ApiResponse<List<Survey>>>($"{gatrixUrl}/api/surveys?isActive=true");
            _surveys = response.Data ?? [];
            _logger.Info("Surveys fetched", new { count = _surveys.Count });
        }
        catch (Exception ex)
        {
            _logger.Warn("Failed to load surveys", new { error = ex.Message });
        }
    }

    /// <summary>
    /// Start auto-refresh timer
    /// </summary>
    private void StartAutoRefresh(string gatrixUrl)
    {
        var intervalMs = _config.Ttl * 1000;
        _refreshTimer = new Timer(
            async _ => await RefreshAllAsync(gatrixUrl),
            null,
            intervalMs,
            intervalMs
        );
        _logger.Info("Auto-refresh started", new { intervalMs });
    }

    /// <summary>
    /// Stop auto-refresh timer
    /// </summary>
    public void StopAutoRefresh()
    {
        _refreshTimer?.Dispose();
        _refreshTimer = null;
        _logger.Info("Auto-refresh stopped");
    }

    /// <summary>
    /// Refresh all caches
    /// </summary>
    public async Task RefreshAllAsync(string gatrixUrl)
    {
        _logger.Info("Refreshing all caches...");

        try
        {
            await Task.WhenAll(
                LoadGameWorldsAsync(gatrixUrl),
                LoadPopupNoticesAsync(gatrixUrl),
                LoadSurveysAsync(gatrixUrl)
            );

            _logger.Info("All caches refreshed successfully");

            // Emit refresh events for polling method
            if (_config.RefreshMethod == CacheRefreshMethod.Polling)
            {
                EmitRefreshEvent("cache.refreshed", new
                {
                    timestamp = DateTime.UtcNow.ToString("O"),
                    types = new[] { "gameworld", "popup", "survey" }
                });
            }
        }
        catch (Exception ex)
        {
            _logger.Error("Failed to refresh caches", new { error = ex.Message });
        }
    }

    /// <summary>
    /// Get all game worlds
    /// </summary>
    public List<GameWorld> GetGameWorlds() => _gameWorlds;

    /// <summary>
    /// Get all popup notices
    /// </summary>
    public List<PopupNotice> GetPopupNotices() => _popupNotices;

    /// <summary>
    /// Get all surveys
    /// </summary>
    public List<Survey> GetSurveys() => _surveys;

    /// <summary>
    /// Get game world by ID
    /// </summary>
    public GameWorld? GetGameWorldById(string id) => _gameWorlds.FirstOrDefault(w => w.Id == id);

    /// <summary>
    /// Get popup notice by ID
    /// </summary>
    public PopupNotice? GetPopupNoticeById(string id) => _popupNotices.FirstOrDefault(p => p.Id == id);

    /// <summary>
    /// Get survey by ID
    /// </summary>
    public Survey? GetSurveyById(string id) => _surveys.FirstOrDefault(s => s.Id == id);
}

