using Gatrix.Server.Sdk.Cache;
using Gatrix.Server.Sdk.Client;
using Gatrix.Server.Sdk.Models;
using Microsoft.Extensions.Logging;

namespace Gatrix.Server.Sdk.Services;

public interface IWhitelistService
{
    Task InitializeAsync(string environmentId, CancellationToken ct = default);
    Task FetchAsync(string environmentId, CancellationToken ct = default);
    List<WhitelistData> GetCached(string environmentId);
    WhitelistData? Get(string environmentId);
    bool IsIpWhitelisted(string ip, string environmentId);
    bool IsAccountWhitelisted(string accountId, string environmentId);
}

public class WhitelistService : BaseEnvironmentService<WhitelistData, WhitelistData>, IWhitelistService
{
    public WhitelistService(GatrixApiClient apiClient, ILogger<WhitelistService> logger, ICacheStorageProvider? storage = null)
        : base(apiClient, logger, storage) { }

    protected override string ServiceName => "Whitelist";
    protected override string GetEndpoint(string environmentId) =>
        $"/api/v1/server/whitelist";
    protected override List<WhitelistData> ExtractItems(WhitelistData response) => [response];
    protected override object GetItemId(WhitelistData item) => "singleton";

    public async Task FetchAsync(string environmentId, CancellationToken ct = default)
    {
        await FetchByEnvironmentAsync(environmentId, ct);
    }

    public WhitelistData? Get(string environmentId) => GetCached(environmentId).FirstOrDefault();

    public bool IsIpWhitelisted(string ip, string environmentId)
    {
        var data = Get(environmentId);
        if (data?.IpWhitelist is not { Enabled: true }) return false;
        return data.IpWhitelist.Ips.Contains(ip);
    }

    public bool IsAccountWhitelisted(string accountId, string environmentId)
    {
        var data = Get(environmentId);
        if (data?.AccountWhitelist is not { Enabled: true }) return false;
        return data.AccountWhitelist.AccountIds.Contains(accountId, StringComparer.OrdinalIgnoreCase);
    }
}
