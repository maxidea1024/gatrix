using Gatrix.Server.Sdk.Client;
using Gatrix.Server.Sdk.Models;
using Microsoft.Extensions.Logging;

namespace Gatrix.Server.Sdk.Services;

public interface IWhitelistService
{
    Task InitializeAsync(string environment, CancellationToken ct = default);
    Task FetchAsync(string environment, CancellationToken ct = default);
    List<WhitelistData> GetCached(string environment);
    WhitelistData? Get(string environment);
    bool IsIpWhitelisted(string ip, string environment);
    bool IsAccountWhitelisted(string accountId, string environment);
}

public class WhitelistService : BaseEnvironmentService<WhitelistData, WhitelistData>, IWhitelistService
{
    public WhitelistService(GatrixApiClient apiClient, ILogger<WhitelistService> logger)
        : base(apiClient, logger) { }

    protected override string ServiceName => "Whitelist";
    protected override string GetEndpoint(string environment) =>
        $"/api/v1/server/{Uri.EscapeDataString(environment)}/whitelist";
    protected override List<WhitelistData> ExtractItems(WhitelistData response) => [response];
    protected override object GetItemId(WhitelistData item) => "singleton";

    public async Task FetchAsync(string environment, CancellationToken ct = default)
    {
        await FetchByEnvironmentAsync(environment, ct);
    }

    public WhitelistData? Get(string environment) => GetCached(environment).FirstOrDefault();

    public bool IsIpWhitelisted(string ip, string environment)
    {
        var data = Get(environment);
        if (data?.IpWhitelist is not { Enabled: true }) return false;
        return data.IpWhitelist.Ips.Contains(ip);
    }

    public bool IsAccountWhitelisted(string accountId, string environment)
    {
        var data = Get(environment);
        if (data?.AccountWhitelist is not { Enabled: true }) return false;
        return data.AccountWhitelist.AccountIds.Contains(accountId, StringComparer.OrdinalIgnoreCase);
    }
}
