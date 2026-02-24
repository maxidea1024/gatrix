using Gatrix.Server.Sdk.Client;
using Microsoft.Extensions.Logging;

namespace Gatrix.Server.Sdk.Services;

/// <summary>
/// Abstract base class for services that handle per-environment data caching.
/// Reduces code duplication across GameWorld, Banner, PopupNotice, Survey, etc.
///
/// DESIGN PRINCIPLES:
/// - All methods that access cached data receive environment explicitly
/// - Single-environment mode: environment defaults to config value
/// - Multi-environment mode: environment MUST always be provided
/// </summary>
public abstract class BaseEnvironmentService<T, TResponse>
{
    protected readonly GatrixApiClient ApiClient;
    protected readonly ILogger Logger;
    private readonly Dictionary<string, List<T>> _cachedByEnv = new(StringComparer.OrdinalIgnoreCase);
    private readonly object _lock = new();

    protected BaseEnvironmentService(GatrixApiClient apiClient, ILogger logger)
    {
        ApiClient = apiClient;
        Logger = logger;
    }

    // ── Abstract methods (must be implemented by subclasses) ──────

    /// <summary>API endpoint for the given environment.</summary>
    protected abstract string GetEndpoint(string environment);

    /// <summary>Extract item list from API response.</summary>
    protected abstract List<T> ExtractItems(TResponse response);

    /// <summary>Service name for logging.</summary>
    protected abstract string ServiceName { get; }

    /// <summary>Get the ID of an item (for single-item cache updates).</summary>
    protected abstract object GetItemId(T item);

    // ── Common implementation ─────────────────────────────────────

    /// <summary>Fetch items from API and cache them.</summary>
    public async Task<List<T>> FetchByEnvironmentAsync(string environment, CancellationToken ct = default)
    {
        var endpoint = GetEndpoint(environment);
        Logger.LogDebug("Fetching {Service} for {Environment}", ServiceName, environment);

        var response = await ApiClient.GetAsync<TResponse>(endpoint, ct);

        if (!response.Success || response.Data is null)
        {
            Logger.LogWarning("Failed to fetch {Service} for {Environment}", ServiceName, environment);
            return GetCached(environment);
        }

        var items = ExtractItems(response.Data);
        UpdateCache(items, environment);

        Logger.LogInformation("{Service} cached: {Count} items for {Environment}",
            ServiceName, items.Count, environment);

        return items;
    }

    /// <summary>Get cached items for a specific environment.</summary>
    public List<T> GetCached(string environment)
    {
        lock (_lock)
        {
            return _cachedByEnv.TryGetValue(environment, out var items)
                ? new List<T>(items)
                : [];
        }
    }

    /// <summary>Replace cache for an environment atomically.</summary>
    public void UpdateCache(List<T> items, string environment)
    {
        lock (_lock)
        {
            _cachedByEnv[environment] = new List<T>(items);
        }
    }

    /// <summary>Update a single item in cache (upsert).</summary>
    protected void UpsertItemInCache(T item, string environment)
    {
        lock (_lock)
        {
            if (!_cachedByEnv.TryGetValue(environment, out var items))
            {
                _cachedByEnv[environment] = [item];
                return;
            }

            var itemId = GetItemId(item);
            var index = items.FindIndex(i => GetItemId(i)?.Equals(itemId) == true);
            if (index >= 0)
                items[index] = item;
            else
                items.Add(item);
        }
    }

    /// <summary>Remove an item from cache by ID.</summary>
    protected void RemoveFromCache(object id, string environment)
    {
        lock (_lock)
        {
            if (!_cachedByEnv.TryGetValue(environment, out var items)) return;
            items.RemoveAll(i => GetItemId(i)?.Equals(id) == true);
        }
    }

    /// <summary>Get all cached environment names.</summary>
    public IReadOnlyList<string> GetCachedEnvironments()
    {
        lock (_lock) { return _cachedByEnv.Keys.ToList(); }
    }

    /// <summary>Clear all cached data.</summary>
    public void ClearCache()
    {
        lock (_lock) { _cachedByEnv.Clear(); }
    }
}
