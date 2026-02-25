using Gatrix.Server.Sdk.Client;
using Gatrix.Server.Sdk.Models;
using Microsoft.Extensions.Logging;

namespace Gatrix.Server.Sdk.Services;

public interface IServiceMaintenanceService
{
    Task FetchAsync(string environment, CancellationToken ct = default);
    MaintenanceStatus? GetStatus(string environment);
    bool IsActive(string environment);
    string? GetMessage(string environment, string lang = "en");
}

public class ServiceMaintenanceService : BaseEnvironmentService<MaintenanceStatus, MaintenanceStatus>, IServiceMaintenanceService
{
    public ServiceMaintenanceService(GatrixApiClient apiClient, ILogger<ServiceMaintenanceService> logger)
        : base(apiClient, logger) { }

    protected override string ServiceName => "ServiceMaintenance";
    protected override string GetEndpoint(string environment) =>
        $"/api/v1/server/{Uri.EscapeDataString(environment)}/service-maintenance";
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
