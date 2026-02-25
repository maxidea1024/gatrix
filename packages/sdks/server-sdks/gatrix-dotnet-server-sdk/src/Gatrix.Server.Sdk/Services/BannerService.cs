using Gatrix.Server.Sdk.Client;
using Gatrix.Server.Sdk.Models;
using Microsoft.Extensions.Logging;

namespace Gatrix.Server.Sdk.Services;

public interface IBannerService
{
    Task InitializeAsync(string environment, CancellationToken ct = default);
    Task<List<Banner>> FetchAsync(string environment, CancellationToken ct = default);
    List<Banner> GetCached(string environment);
    List<Banner> GetAll(string environment);
}

public class BannerService : BaseEnvironmentService<Banner, List<Banner>>, IBannerService
{
    public BannerService(GatrixApiClient apiClient, ILogger<BannerService> logger)
        : base(apiClient, logger) { }

    protected override string ServiceName => "Banner";
    protected override string GetEndpoint(string environment) =>
        $"/api/v1/server/{Uri.EscapeDataString(environment)}/banners";
    protected override List<Banner> ExtractItems(List<Banner> response) => response;
    protected override object GetItemId(Banner item) => item.BannerId;

    public Task<List<Banner>> FetchAsync(string environment, CancellationToken ct = default) =>
        FetchByEnvironmentAsync(environment, ct);

    public List<Banner> GetAll(string environment) => GetCached(environment);
}
