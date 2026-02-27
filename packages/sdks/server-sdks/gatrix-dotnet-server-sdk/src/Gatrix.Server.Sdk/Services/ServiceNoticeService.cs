using Gatrix.Server.Sdk.Cache;
using Gatrix.Server.Sdk.Client;
using Gatrix.Server.Sdk.Models;
using Microsoft.Extensions.Logging;

namespace Gatrix.Server.Sdk.Services;

public interface IServiceNoticeService
{
    Task InitializeAsync(string environment, CancellationToken ct = default);
    Task<List<ServiceNotice>> FetchAsync(string environment, CancellationToken ct = default);
    List<ServiceNotice> GetCached(string environment);
    List<ServiceNotice> GetAll(string environment);
    void UpsertSingle(ServiceNotice item, string environment);
    void Remove(int id, string environment);
}

public class ServiceNoticeService : BaseEnvironmentService<ServiceNotice, List<ServiceNotice>>, IServiceNoticeService
{
    public ServiceNoticeService(GatrixApiClient apiClient, ILogger<ServiceNoticeService> logger, ICacheStorageProvider? storage = null)
        : base(apiClient, logger, storage) { }

    protected override string ServiceName => "ServiceNotice";
    protected override string GetEndpoint(string environment) =>
        $"/api/v1/server/{Uri.EscapeDataString(environment)}/service-notices";
    protected override List<ServiceNotice> ExtractItems(List<ServiceNotice> response) => response;
    protected override object GetItemId(ServiceNotice item) => item.Id;

    public Task<List<ServiceNotice>> FetchAsync(string environment, CancellationToken ct = default) =>
        FetchByEnvironmentAsync(environment, ct);

    public List<ServiceNotice> GetAll(string environment) => GetCached(environment);
    public void UpsertSingle(ServiceNotice item, string environment) => UpsertItemInCache(item, environment);
    public void Remove(int id, string environment) => RemoveFromCache(id, environment);
}
