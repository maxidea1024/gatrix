using Gatrix.Server.Sdk.Cache;
using Gatrix.Server.Sdk.Client;
using Gatrix.Server.Sdk.Models;
using Microsoft.Extensions.Logging;

namespace Gatrix.Server.Sdk.Services;

public interface IServiceNoticeService
{
    Task InitializeAsync(string environmentId, CancellationToken ct = default);
    Task<List<ServiceNotice>> FetchAsync(string environmentId, CancellationToken ct = default);
    List<ServiceNotice> GetCached(string environmentId);
    List<ServiceNotice> GetAll(string environmentId);
    void UpsertSingle(ServiceNotice item, string environmentId);
    void Remove(int id, string environmentId);
}

public class ServiceNoticeService : BaseEnvironmentService<ServiceNotice, List<ServiceNotice>>, IServiceNoticeService
{
    public ServiceNoticeService(GatrixApiClient apiClient, ILogger<ServiceNoticeService> logger, ICacheStorageProvider? storage = null)
        : base(apiClient, logger, storage) { }

    protected override string ServiceName => "ServiceNotice";
    protected override string GetEndpoint(string environmentId) =>
        $"/api/v1/server/service-notices";
    protected override List<ServiceNotice> ExtractItems(List<ServiceNotice> response) => response;
    protected override object GetItemId(ServiceNotice item) => item.Id;

    public Task<List<ServiceNotice>> FetchAsync(string environmentId, CancellationToken ct = default) =>
        FetchByEnvironmentAsync(environmentId, ct);

    public List<ServiceNotice> GetAll(string environmentId) => GetCached(environmentId);
    public void UpsertSingle(ServiceNotice item, string environmentId) => UpsertItemInCache(item, environmentId);
    public void Remove(int id, string environmentId) => RemoveFromCache(id, environmentId);
}
