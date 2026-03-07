using Gatrix.Server.Sdk.Cache;
using Gatrix.Server.Sdk.Client;
using Gatrix.Server.Sdk.Models;
using Microsoft.Extensions.Logging;

namespace Gatrix.Server.Sdk.Services;

public interface IServiceMaintenanceService
{
    Task InitializeAsync(string environmentId, CancellationToken ct = default);
    Task FetchAsync(string environmentId, CancellationToken ct = default);
    List<MaintenanceStatus> GetCached(string environmentId);
    MaintenanceStatus? GetStatus(string environmentId);
    bool IsActive(string environmentId);
    string? GetMessage(string environmentId, string lang = "en");
}

public class ServiceMaintenanceService : BaseEnvironmentService<MaintenanceStatus, MaintenanceStatus>, IServiceMaintenanceService
{
    public ServiceMaintenanceService(GatrixApiClient apiClient, ILogger<ServiceMaintenanceService> logger, ICacheStorageProvider? storage = null)
        : base(apiClient, logger, storage) { }

    protected override string ServiceName => "ServiceMaintenance";
    protected override string GetEndpoint(string environmentId) =>
        $"/api/v1/server/service-maintenance";
    protected override List<MaintenanceStatus> ExtractItems(MaintenanceStatus response) => [response];
    protected override object GetItemId(MaintenanceStatus item) => "singleton";

    public async Task FetchAsync(string environmentId, CancellationToken ct = default)
    {
        await FetchByEnvironmentAsync(environmentId, ct);
    }

    public MaintenanceStatus? GetStatus(string environmentId) => GetCached(environmentId).FirstOrDefault();

    public bool IsActive(string environmentId) => GetStatus(environmentId)?.IsMaintenanceActive ?? false;

    public string? GetMessage(string environmentId, string lang = "en")
    {
        var status = GetStatus(environmentId);
        if (status?.Detail is null) return null;

        if (status.Detail.LocaleMessages?.TryGetValue(lang, out var msg) == true)
            return msg;
        return status.Detail.Message;
    }
}
