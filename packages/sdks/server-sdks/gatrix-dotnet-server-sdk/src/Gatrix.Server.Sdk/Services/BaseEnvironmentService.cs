using System.Text.Json;
using Gatrix.Server.Sdk.Cache;
using Gatrix.Server.Sdk.Client;
using Microsoft.Extensions.Logging;

namespace Gatrix.Server.Sdk.Services;

/// <summary>
/// Abstract base class for services that handle per-environment data caching.
/// Supports local persistence and ETag-based 304 optimizations.
/// </summary>
public abstract class BaseEnvironmentService<T, TResponse>
{
    protected readonly GatrixApiClient ApiClient;
    protected readonly ILogger Logger;
    protected readonly ICacheStorageProvider? Storage;
    private readonly Dictionary<string, List<T>> _cachedByEnv = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, string> _etagsByEnv = new(StringComparer.OrdinalIgnoreCase);
    private readonly object _lock = new();

    protected BaseEnvironmentService(GatrixApiClient apiClient, ILogger logger, ICacheStorageProvider? storage = null)
    {
        ApiClient = apiClient;
        Logger = logger;
        Storage = storage;
    }

    // ── Abstract methods (must be implemented by subclasses) ──────

    /// <summary>API endpoint for the given environment.</summary>
    protected abstract string GetEndpoint(string environmentId);

    /// <summary>Extract item list from API response.</summary>
    protected abstract List<T> ExtractItems(TResponse response);

    /// <summary>Service name for logging.</summary>
    protected abstract string ServiceName { get; }

    /// <summary>Get the ID of an item (for single-item cache updates).</summary>
    protected abstract object GetItemId(T item);

    // ── Common implementation ─────────────────────────────────────

    /// <summary>Initialize the service by loading data from local storage.</summary>
    public virtual async Task InitializeAsync(string environmentId, CancellationToken ct = default)
    {
        if (Storage == null) return;

        var cacheKey = GetCacheKey(environmentId);
        var etagKey = GetEtagKey(environmentId);

        try
        {
            var cachedJson = await Storage.GetAsync(cacheKey, ct);
            if (!string.IsNullOrEmpty(cachedJson))
            {
                var items = JsonSerializer.Deserialize<List<T>>(cachedJson);
                if (items != null)
                {
                    UpdateCache(items, environmentId);
                    Logger.LogDebug("Loaded {Count} {Service} items from local storage for {Environment}",
                        items.Count, ServiceName, environmentId);
                }
            }

            var cachedEtag = await Storage.GetAsync(etagKey, ct);
            if (!string.IsNullOrEmpty(cachedEtag))
            {
                lock (_lock)
                {
                    _etagsByEnv[environmentId] = cachedEtag;
                }
            }
        }
        catch (Exception ex)
        {
            Logger.LogWarning(ex, "Failed to load {Service} from local storage for {Environment}", ServiceName, environmentId);
        }
    }

    /// <summary>Fetch items from API and cache them (local + remote).</summary>
    public async Task<List<T>> FetchByEnvironmentAsync(string environmentId, CancellationToken ct = default)
    {
        var endpoint = GetEndpoint(environmentId);
        Logger.LogDebug("Fetching {Service} for {Environment}", ServiceName, environmentId);

        string? etag;
        lock (_lock)
        {
            _etagsByEnv.TryGetValue(environmentId, out etag);
        }

        var response = await ApiClient.GetAsync<TResponse>(endpoint, etag, ct);

        if (!response.Success)
        {
            Logger.LogWarning("Failed to fetch {Service} for {Environment}", ServiceName, environmentId);
            return GetCached(environmentId);
        }

        if (response.NotModified)
        {
            Logger.LogDebug("{Service} for {Environment} not modified (304)", ServiceName, environmentId);
            return GetCached(environmentId);
        }

        if (response.Data is null)
        {
            return GetCached(environmentId);
        }

        var items = ExtractItems(response.Data);
        
        // Safety check: if backend returns empty but we already have local data,
        // be careful about overwriting it during the initial sync or temporary backend issues.
        var currentItems = GetCached(environmentId);
        if (items.Count == 0 && currentItems.Count > 0)
        {
            Logger.LogWarning("{Service} received empty list from backend for {Environment}, but local cache has data. Keeping local data for now to avoid outage.", 
                ServiceName, environmentId);
            return currentItems;
        }

        UpdateCache(items, environmentId);

        if (Storage != null)
        {
            var json = JsonSerializer.Serialize(items);
            await Storage.SaveAsync(GetCacheKey(environmentId), json, ct);
        }

        if (response.Etag != null)
        {
            lock (_lock)
            {
                _etagsByEnv[environmentId] = response.Etag;
            }
            if (Storage != null)
            {
                await Storage.SaveAsync(GetEtagKey(environmentId), response.Etag, ct);
            }
        }

        Logger.LogInformation("{Service} cached: {Count} items for {Environment}",
            ServiceName, items.Count, environmentId);

        return items;
    }

    protected string GetCacheKey(string environmentId) => $"{ServiceName}_{environmentId}_data";
    protected string GetEtagKey(string environmentId) => $"{ServiceName}_{environmentId}_etag";

    /// <summary>Get cached items for a specific environment.</summary>
    public List<T> GetCached(string environmentId)
    {
        lock (_lock)
        {
            return _cachedByEnv.TryGetValue(environmentId, out var items)
                ? new List<T>(items)
                : [];
        }
    }

    /// <summary>Replace cache for an environment atomically.</summary>
    public void UpdateCache(List<T> items, string environmentId)
    {
        lock (_lock)
        {
            _cachedByEnv[environmentId] = new List<T>(items);
        }
        _ = PersistCacheAsync(environmentId);
    }

    /// <summary>Update a single item in cache (upsert).</summary>
    protected void UpsertItemInCache(T item, string environmentId)
    {
        lock (_lock)
        {
            if (!_cachedByEnv.TryGetValue(environmentId, out var items))
            {
                items = [item];
                _cachedByEnv[environmentId] = items;
            }
            else
            {
                var itemId = GetItemId(item);
                var index = items.FindIndex(i => GetItemId(i)?.Equals(itemId) == true);
                if (index >= 0)
                    items[index] = item;
                else
                    items.Add(item);
            }
        }
        _ = PersistCacheAsync(environmentId);
    }

    /// <summary>Remove an item from cache by ID.</summary>
    protected void RemoveFromCache(object id, string environmentId)
    {
        lock (_lock)
        {
            if (!_cachedByEnv.TryGetValue(environmentId, out var items)) return;
            items.RemoveAll(i => GetItemId(i)?.Equals(id) == true);
        }
        _ = PersistCacheAsync(environmentId);
    }

    /// <summary>Persist current cache for an environment to local storage.</summary>
    protected async Task PersistCacheAsync(string environmentId, CancellationToken ct = default)
    {
        if (Storage == null) return;

        try
        {
            var items = GetCached(environmentId);
            var cacheKey = GetCacheKey(environmentId);
            var json = JsonSerializer.Serialize(items);
            await Storage.SaveAsync(cacheKey, json, ct);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Failed to persist {Service} to local storage for {Environment}", ServiceName, environmentId);
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
