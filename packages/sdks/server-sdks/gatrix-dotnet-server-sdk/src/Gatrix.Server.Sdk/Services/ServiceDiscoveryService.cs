using Gatrix.Server.Sdk.Client;
using Gatrix.Server.Sdk.Models;
using Microsoft.Extensions.Logging;

namespace Gatrix.Server.Sdk.Services;

public interface IServiceDiscoveryService
{
    Task<ServiceInstance> RegisterAsync(RegisterServiceInput input, CancellationToken ct = default);
    Task UpdateStatusAsync(string instanceId, UpdateServiceStatusInput input, CancellationToken ct = default);
    Task DeregisterAsync(string instanceId, CancellationToken ct = default);
    Task<List<ServiceInstance>> GetServicesAsync(GetServicesParams? filter = null, CancellationToken ct = default);
}

public class ServiceDiscoveryService : IServiceDiscoveryService
{
    private readonly GatrixApiClient _apiClient;
    private readonly ILogger<ServiceDiscoveryService> _logger;

    public ServiceDiscoveryService(GatrixApiClient apiClient, ILogger<ServiceDiscoveryService> logger)
    {
        _apiClient = apiClient;
        _logger = logger;
    }

    public async Task<ServiceInstance> RegisterAsync(RegisterServiceInput input, CancellationToken ct = default)
    {
        var response = await _apiClient.PostAsync<ServiceInstance>(
            "/api/v1/service-discovery/register", input, ct);

        if (!response.Success || response.Data is null)
            throw new InvalidOperationException("Service registration failed");

        _logger.LogInformation("Service registered: {InstanceId}", response.Data.InstanceId);
        return response.Data;
    }

    public async Task UpdateStatusAsync(string instanceId, UpdateServiceStatusInput input, CancellationToken ct = default)
    {
        await _apiClient.PostAsync<object>(
            $"/api/v1/service-discovery/{Uri.EscapeDataString(instanceId)}/status", input, ct);
    }

    public async Task DeregisterAsync(string instanceId, CancellationToken ct = default)
    {
        await _apiClient.PostAsync<object>(
            $"/api/v1/service-discovery/{Uri.EscapeDataString(instanceId)}/deregister", null, ct);
        _logger.LogInformation("Service deregistered: {InstanceId}", instanceId);
    }

    public async Task<List<ServiceInstance>> GetServicesAsync(GetServicesParams? filter = null, CancellationToken ct = default)
    {
        var query = BuildQuery(filter);
        var response = await _apiClient.GetAsync<List<ServiceInstance>>(
            $"/api/v1/service-discovery/services{query}", ct: ct);
        return response.Data ?? [];
    }

    private static string BuildQuery(GetServicesParams? filter)
    {
        if (filter is null) return "";
        var parts = new List<string>();
        if (filter.Service is not null) parts.Add($"service={Uri.EscapeDataString(filter.Service)}");
        if (filter.Group is not null) parts.Add($"group={Uri.EscapeDataString(filter.Group)}");
        if (filter.Environment is not null) parts.Add($"environment={Uri.EscapeDataString(filter.Environment)}");
        if (filter.Region is not null) parts.Add($"region={Uri.EscapeDataString(filter.Region)}");
        if (filter.Status is not null) parts.Add($"status={Uri.EscapeDataString(filter.Status)}");
        return parts.Count > 0 ? "?" + string.Join("&", parts) : "";
    }
}
