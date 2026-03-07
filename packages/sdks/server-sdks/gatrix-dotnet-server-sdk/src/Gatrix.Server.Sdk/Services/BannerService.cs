using Gatrix.Server.Sdk.Cache;
using Gatrix.Server.Sdk.Client;
using Gatrix.Server.Sdk.Models;
using Microsoft.Extensions.Logging;

namespace Gatrix.Server.Sdk.Services;

public interface IBannerService
{
    Task InitializeAsync(string environmentId, CancellationToken ct = default);
    Task<List<Banner>> FetchAsync(string environmentId, CancellationToken ct = default);
    List<Banner> GetCached(string environmentId);
    List<Banner> GetAll(string environmentId);
    void UpsertSingle(Banner item, string environmentId);
    void Remove(int id, string environmentId);
}

public class BannerService : BaseEnvironmentService<Banner, List<Banner>>, IBannerService
{
    public BannerService(GatrixApiClient apiClient, ILogger<BannerService> logger, ICacheStorageProvider? storage = null)
        : base(apiClient, logger, storage) { }

    protected override string ServiceName => "Banner";
    protected override string GetEndpoint(string environmentId) =>
        $"/api/v1/server/banners";
    protected override List<Banner> ExtractItems(List<Banner> response) => response;
    protected override object GetItemId(Banner item) => item.BannerId;

    public Task<List<Banner>> FetchAsync(string environmentId, CancellationToken ct = default) =>
        FetchByEnvironmentAsync(environmentId, ct);

    public List<Banner> GetAll(string environmentId) => GetCached(environmentId);
    public void UpsertSingle(Banner item, string environmentId) => UpsertItemInCache(item, environmentId);
    public void Remove(int id, string environmentId) => RemoveFromCache(id, environmentId);
}
