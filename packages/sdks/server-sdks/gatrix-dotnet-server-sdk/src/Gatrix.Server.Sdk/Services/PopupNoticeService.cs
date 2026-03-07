using System.Text.Json.Serialization;
using Gatrix.Server.Sdk.Cache;
using Gatrix.Server.Sdk.Client;
using Gatrix.Server.Sdk.Models;
using Microsoft.Extensions.Logging;

namespace Gatrix.Server.Sdk.Services;

public interface IPopupNoticeService
{
    Task InitializeAsync(string environmentId, CancellationToken ct = default);
    Task<List<PopupNotice>> FetchAsync(string environmentId, CancellationToken ct = default);
    List<PopupNotice> GetCached(string environmentId);
    List<PopupNotice> GetAll(string environmentId);
    List<PopupNotice> GetForWorld(string worldId, string environmentId);
    List<PopupNotice> GetActive(string environmentId, string? platform = null,
        string? channel = null, string? worldId = null, string? userId = null);
    Task UpdateSingleNoticeAsync(int id, string environmentId, bool? isVisible = null, CancellationToken ct = default);
    void RemoveNotice(int id, string environmentId);
}

internal class PopupNoticeByIdResponse
{
    [JsonPropertyName("notice")] public PopupNotice Notice { get; set; } = null!;
}

public class PopupNoticeService : BaseEnvironmentService<PopupNotice, List<PopupNotice>>, IPopupNoticeService
{
    public PopupNoticeService(GatrixApiClient apiClient, ILogger<PopupNoticeService> logger, ICacheStorageProvider? storage = null)
        : base(apiClient, logger, storage) { }

    protected override string ServiceName => "PopupNotice";
    protected override string GetEndpoint(string environmentId) =>
        $"/api/v1/server/ingame-popup-notices";
    protected override List<PopupNotice> ExtractItems(List<PopupNotice> response) => response;
    protected override object GetItemId(PopupNotice item) => item.Id;

    public Task<List<PopupNotice>> FetchAsync(string environmentId, CancellationToken ct = default) =>
        FetchByEnvironmentAsync(environmentId, ct);
    public List<PopupNotice> GetAll(string environmentId) => GetCached(environmentId);

    // ── Single-item cache operations (event-driven) ─────────────

    public async Task UpdateSingleNoticeAsync(int id, string environmentId, bool? isVisible = null, CancellationToken ct = default)
    {
        try
        {
            if (isVisible == false)
            {
                Logger.LogInformation("PopupNotice isVisible=false, removing from cache (id={Id})", id);
                RemoveFromCache(id, environmentId);
                return;
            }

            await Task.Delay(100, ct);

            var response = await ApiClient.GetAsync<PopupNoticeByIdResponse>(
                $"/api/v1/server/ingame-popup-notices/{id}", ct: ct);

            if (!response.Success || response.Data?.Notice is null)
            {
                Logger.LogDebug("PopupNotice not found (id={Id}), removing from cache", id);
                RemoveFromCache(id, environmentId);
                return;
            }

            UpsertItemInCache(response.Data.Notice, environmentId);
            Logger.LogDebug("Single PopupNotice upserted in cache (id={Id})", id);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Failed to update single PopupNotice (id={Id}), falling back to full refresh", id);
            await FetchByEnvironmentAsync(environmentId, ct);
        }
    }

    public void RemoveNotice(int id, string environmentId)
    {
        RemoveFromCache(id, environmentId);
        Logger.LogInformation("PopupNotice removed from cache (id={Id})", id);
    }

    // ── Targeting ───────────────────────────────────────────────

    public List<PopupNotice> GetForWorld(string worldId, string environmentId) =>
        GetCached(environmentId).Where(n => MatchesTarget(n.TargetWorlds, n.TargetWorldsInverted, worldId)).ToList();

    public List<PopupNotice> GetActive(string environmentId, string? platform = null,
        string? channel = null, string? worldId = null, string? userId = null)
    {
        var now = DateTime.UtcNow;
        return GetCached(environmentId)
            .Where(n =>
            {
                if (n.StartDate is not null && DateTime.Parse(n.StartDate) > now) return false;
                if (n.EndDate is not null && DateTime.Parse(n.EndDate) < now) return false;
                if (platform is not null && !MatchesTarget(n.TargetPlatforms, n.TargetPlatformsInverted, platform)) return false;
                if (channel is not null && !MatchesTarget(n.TargetChannels, n.TargetChannelsInverted, channel)) return false;
                if (worldId is not null && !MatchesTarget(n.TargetWorlds, n.TargetWorldsInverted, worldId)) return false;
                if (userId is not null && !MatchesTarget(n.TargetUserIds, n.TargetUserIdsInverted, userId)) return false;
                return true;
            })
            .OrderBy(n => n.DisplayPriority)
            .ToList();
    }

    private static bool MatchesTarget(List<string>? targets, bool? inverted, string value)
    {
        if (targets is null or { Count: 0 }) return true;
        var contains = targets.Contains(value, StringComparer.OrdinalIgnoreCase);
        return inverted == true ? !contains : contains;
    }
}
