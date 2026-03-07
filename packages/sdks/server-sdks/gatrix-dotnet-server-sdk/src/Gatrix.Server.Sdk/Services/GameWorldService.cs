using Gatrix.Server.Sdk.Cache;
using Gatrix.Server.Sdk.Client;
using Gatrix.Server.Sdk.Models;
using Microsoft.Extensions.Logging;

namespace Gatrix.Server.Sdk.Services;

public interface IGameWorldService
{
    Task InitializeAsync(string environment, CancellationToken ct = default);
    Task<List<GameWorld>> FetchAsync(string environment, CancellationToken ct = default);
    List<GameWorld> GetCached(string environment);
    List<GameWorld> GetAll(string environment);
    GameWorld? GetByWorldId(string worldId, string environment);
    bool IsWorldMaintenanceActive(string worldId, string environment);
    string? GetWorldMaintenanceMessage(string worldId, string environment, string lang = "en");

    /// <summary>
    /// Update a single game world in cache.
    /// If isVisible=false, removes from cache (no API call).
    /// If isVisible=true, fetches single item from API and upserts.
    /// Falls back to full refresh on failure.
    /// </summary>
    Task UpdateSingleWorldAsync(int id, string environment, bool? isVisible = null, CancellationToken ct = default);

    /// <summary>Remove a game world from cache by id.</summary>
    void RemoveWorld(int id, string environment);
}

public class GameWorldService : BaseEnvironmentService<GameWorld, GameWorldListResponse>, IGameWorldService
{
    public GameWorldService(GatrixApiClient apiClient, ILogger<GameWorldService> logger, ICacheStorageProvider? storage = null)
        : base(apiClient, logger, storage) { }

    protected override string ServiceName => "GameWorld";
    protected override string GetEndpoint(string environment) =>
        $"/api/v1/server/game-worlds";
    protected override List<GameWorld> ExtractItems(GameWorldListResponse response) =>
        response.Worlds.OrderBy(w => w.DisplayOrder).ToList();
    protected override object GetItemId(GameWorld item) => item.Id;

    public Task<List<GameWorld>> FetchAsync(string environment, CancellationToken ct = default) =>
        FetchByEnvironmentAsync(environment, ct);

    public List<GameWorld> GetAll(string environment) => GetCached(environment);

    public GameWorld? GetByWorldId(string worldId, string environment) =>
        GetCached(environment).FirstOrDefault(w =>
            string.Equals(w.WorldId, worldId, StringComparison.OrdinalIgnoreCase));

    // ── Single-item cache operations (event-driven) ─────────────

    public async Task UpdateSingleWorldAsync(int id, string environment, bool? isVisible = null, CancellationToken ct = default)
    {
        try
        {
            // If explicitly not visible, just remove from cache
            if (isVisible == false)
            {
                Logger.LogInformation("GameWorld isVisible=false, removing from cache (id={Id})", id);
                RemoveFromCache(id, environment);
                return;
            }

            // Small delay to ensure backend transaction is committed
            await Task.Delay(100, ct);

            // Fetch single item from API
            var response = await ApiClient.GetAsync<GameWorld>(
                $"/api/v1/server/game-worlds/{id}", ct: ct);

            if (!response.Success || response.Data is null)
            {
                Logger.LogDebug("GameWorld not found (id={Id}), removing from cache", id);
                RemoveFromCache(id, environment);
                return;
            }

            UpsertItemInCache(response.Data, environment);
            Logger.LogDebug("Single GameWorld upserted in cache (id={Id})", id);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Failed to update single GameWorld (id={Id}), falling back to full refresh", id);
            await FetchByEnvironmentAsync(environment, ct);
        }
    }

    public void RemoveWorld(int id, string environment)
    {
        RemoveFromCache(id, environment);
        Logger.LogInformation("GameWorld removed from cache (id={Id})", id);
    }

    // ── Maintenance helpers ─────────────────────────────────────

    public bool IsWorldMaintenanceActive(string worldId, string environment)
    {
        var world = GetByWorldId(worldId, environment);
        if (world is null || !world.IsMaintenance) return false;

        var now = DateTime.UtcNow;
        var start = world.MaintenanceStartDate is not null
            ? DateTime.Parse(world.MaintenanceStartDate) : (DateTime?)null;
        var end = world.MaintenanceEndDate is not null
            ? DateTime.Parse(world.MaintenanceEndDate) : (DateTime?)null;

        if (start.HasValue && now < start.Value) return false;
        if (end.HasValue && now > end.Value) return false;
        return true;
    }

    public string? GetWorldMaintenanceMessage(string worldId, string environment, string lang = "en")
    {
        var world = GetByWorldId(worldId, environment);
        if (world is null) return null;

        if (world.SupportsMultiLanguage == true && world.MaintenanceLocales is { Count: > 0 })
        {
            var locale = world.MaintenanceLocales.FirstOrDefault(l => l.Lang == lang)
                      ?? world.MaintenanceLocales.FirstOrDefault();
            if (locale is not null) return locale.Message;
        }

        return world.MaintenanceMessage;
    }
}
