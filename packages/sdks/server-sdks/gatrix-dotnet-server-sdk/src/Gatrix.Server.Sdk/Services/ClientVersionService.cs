using Gatrix.Server.Sdk.Cache;
using Gatrix.Server.Sdk.Client;
using Gatrix.Server.Sdk.Models;
using Microsoft.Extensions.Logging;

namespace Gatrix.Server.Sdk.Services;

public interface IClientVersionService
{
    Task InitializeAsync(string environment, CancellationToken ct = default);
    Task<List<ClientVersion>> FetchAsync(string environment, CancellationToken ct = default);
    List<ClientVersion> GetCached(string environment);
    List<ClientVersion> GetAll(string environment);
}

public class ClientVersionService : BaseEnvironmentService<ClientVersion, List<ClientVersion>>, IClientVersionService
{
    public ClientVersionService(GatrixApiClient apiClient, ILogger<ClientVersionService> logger, ICacheStorageProvider? storage = null)
        : base(apiClient, logger, storage) { }

    protected override string ServiceName => "ClientVersion";
    protected override string GetEndpoint(string environment) =>
        $"/api/v1/server/{Uri.EscapeDataString(environment)}/client-versions";
    protected override List<ClientVersion> ExtractItems(List<ClientVersion> response) => response;
    protected override object GetItemId(ClientVersion item) => item.Id;

    public Task<List<ClientVersion>> FetchAsync(string environment, CancellationToken ct = default) =>
        FetchByEnvironmentAsync(environment, ct);

    public List<ClientVersion> GetAll(string environment) => GetCached(environment);
}
