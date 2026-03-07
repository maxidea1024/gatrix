using Gatrix.Server.Sdk.Cache;
using Gatrix.Server.Sdk.Client;
using Gatrix.Server.Sdk.Models;
using Microsoft.Extensions.Logging;

namespace Gatrix.Server.Sdk.Services;

public interface IClientVersionService
{
    Task InitializeAsync(string environmentId, CancellationToken ct = default);
    Task<List<ClientVersion>> FetchAsync(string environmentId, CancellationToken ct = default);
    List<ClientVersion> GetCached(string environmentId);
    List<ClientVersion> GetAll(string environmentId);
    void UpsertSingle(ClientVersion item, string environmentId);
    void Remove(int id, string environmentId);
}

public class ClientVersionService : BaseEnvironmentService<ClientVersion, List<ClientVersion>>, IClientVersionService
{
    public ClientVersionService(GatrixApiClient apiClient, ILogger<ClientVersionService> logger, ICacheStorageProvider? storage = null)
        : base(apiClient, logger, storage) { }

    protected override string ServiceName => "ClientVersion";
    protected override string GetEndpoint(string environmentId) =>
        $"/api/v1/server/client-versions";
    protected override List<ClientVersion> ExtractItems(List<ClientVersion> response) => response;
    protected override object GetItemId(ClientVersion item) => item.Id;

    public Task<List<ClientVersion>> FetchAsync(string environmentId, CancellationToken ct = default) =>
        FetchByEnvironmentAsync(environmentId, ct);

    public List<ClientVersion> GetAll(string environmentId) => GetCached(environmentId);
    public void UpsertSingle(ClientVersion item, string environmentId) => UpsertItemInCache(item, environmentId);
    public void Remove(int id, string environmentId) => RemoveFromCache(id, environmentId);
}
