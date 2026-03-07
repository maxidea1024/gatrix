using Gatrix.Server.Sdk.Cache;
using Gatrix.Server.Sdk.Client;
using Gatrix.Server.Sdk.Models;
using Microsoft.Extensions.Logging;

namespace Gatrix.Server.Sdk.Services;

public interface IServiceMaintenanceService
{
    Task InitializeAsync(string environment, CancellationToken ct = default);
    Task FetchAsync(string environment, CancellationToken ct = default);
    List<MaintenanceStatus> GetCached(string environment);
    MaintenanceStatus? GetStatus(string environment);
    bool IsActive(string environment);
    string? GetMessage(string environment, string lang = "en");
}

public class ServiceMaintenanceService : BaseEnvironmentService<MaintenanceStatus, MaintenanceStatus>, IServiceMaintenanceService
{
    public ServiceMaintenanceService(GatrixApiClient apiClient, ILogger<ServiceMaintenanceService> logger, ICacheStorageProvider? storage = null)
        : base(apiClient, logger, storage) { }

    protected override string ServiceName => "ServiceMaintenance";
    protected override string GetEndpoint(string environment) =>
        $"/api/v1/server/service-maintenance";
    protected override List<MaintenanceStatus> ExtractItems(MaintenanceStatus response) => [response];
    protected override object GetItemId(MaintenanceStatus item) => "singleton";

    public async Task FetchAsync(string environment, CancellationToken ct = default)
    {
        await FetchByEnvironmentAsync(environment, ct);
    }

    public MaintenanceStatus? GetStatus(string environment) => GetCached(environment).FirstOrDefault();

    public bool IsActive(string environment) => GetStatus(environment)?.IsMaintenanceActive ?? false;

    public string? GetMessage(string environment, string lang = "en")
    {
        var status = GetStatus(environment);
        if (status?.Detail is null) return null;

        if (status.Detail.LocaleMessages?.TryGetValue(lang, out var msg) == true)
            return msg;
        return status.Detail.Message;
    }
}
