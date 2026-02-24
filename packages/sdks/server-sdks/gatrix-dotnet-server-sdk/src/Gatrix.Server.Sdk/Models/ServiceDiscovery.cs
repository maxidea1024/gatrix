using System.Text.Json.Serialization;

namespace Gatrix.Server.Sdk.Models;

public class ServiceInstance
{
    [JsonPropertyName("instanceId")] public string InstanceId { get; set; } = string.Empty;
    [JsonPropertyName("labels")] public ServiceLabels Labels { get; set; } = new();
    [JsonPropertyName("hostname")] public string Hostname { get; set; } = string.Empty;
    [JsonPropertyName("externalAddress")] public string ExternalAddress { get; set; } = string.Empty;
    [JsonPropertyName("internalAddress")] public string InternalAddress { get; set; } = string.Empty;
    [JsonPropertyName("ports")] public Dictionary<string, int> Ports { get; set; } = new();
    [JsonPropertyName("status")] public string Status { get; set; } = string.Empty;
    [JsonPropertyName("stats")] public Dictionary<string, object>? Stats { get; set; }
    [JsonPropertyName("meta")] public Dictionary<string, object>? Meta { get; set; }
    [JsonPropertyName("updatedAt")] public string UpdatedAt { get; set; } = string.Empty;
}

public class ServiceLabels
{
    [JsonPropertyName("service")] public string Service { get; set; } = string.Empty;
    [JsonPropertyName("group")] public string? Group { get; set; }
    [JsonPropertyName("environment")] public string? Environment { get; set; }
    [JsonPropertyName("region")] public string? Region { get; set; }
}

public class RegisterServiceInput
{
    [JsonPropertyName("instanceId")] public string? InstanceId { get; set; }
    [JsonPropertyName("labels")] public ServiceLabels Labels { get; set; } = new();
    [JsonPropertyName("hostname")] public string? Hostname { get; set; }
    [JsonPropertyName("internalAddress")] public string? InternalAddress { get; set; }
    [JsonPropertyName("ports")] public Dictionary<string, int> Ports { get; set; } = new();
    [JsonPropertyName("status")] public string? Status { get; set; }
    [JsonPropertyName("stats")] public Dictionary<string, object>? Stats { get; set; }
    [JsonPropertyName("meta")] public Dictionary<string, object>? Meta { get; set; }
}

public class UpdateServiceStatusInput
{
    [JsonPropertyName("status")] public string? Status { get; set; }
    [JsonPropertyName("stats")] public Dictionary<string, object>? Stats { get; set; }
    [JsonPropertyName("autoRegisterIfMissing")] public bool? AutoRegisterIfMissing { get; set; }
    [JsonPropertyName("hostname")] public string? Hostname { get; set; }
    [JsonPropertyName("internalAddress")] public string? InternalAddress { get; set; }
    [JsonPropertyName("ports")] public Dictionary<string, int>? Ports { get; set; }
    [JsonPropertyName("meta")] public Dictionary<string, object>? Meta { get; set; }
}

public class GetServicesParams
{
    public string? Service { get; set; }
    public string? Group { get; set; }
    public string? Environment { get; set; }
    public string? Region { get; set; }
    public string? Status { get; set; }
    public bool ExcludeSelf { get; set; } = true;
}
