using System.Text.Json.Serialization;

namespace Gatrix.Server.Sdk.Models;

public class MaintenanceStatus
{
    [JsonPropertyName("hasMaintenanceScheduled")] public bool HasMaintenanceScheduled { get; set; }
    [JsonPropertyName("isMaintenanceActive")] public bool IsMaintenanceActive { get; set; }
    [JsonPropertyName("isUnderMaintenance")] public bool IsUnderMaintenance { get; set; }
    [JsonPropertyName("detail")] public MaintenanceDetail? Detail { get; set; }
}

public class MaintenanceDetail
{
    [JsonPropertyName("type")] public string Type { get; set; } = string.Empty;
    [JsonPropertyName("startsAt")] public string? StartsAt { get; set; }
    [JsonPropertyName("endsAt")] public string? EndsAt { get; set; }
    [JsonPropertyName("message")] public string Message { get; set; } = string.Empty;
    [JsonPropertyName("localeMessages")] public Dictionary<string, string>? LocaleMessages { get; set; }
    [JsonPropertyName("kickExistingPlayers")] public bool? KickExistingPlayers { get; set; }
    [JsonPropertyName("kickDelayMinutes")] public int? KickDelayMinutes { get; set; }
}
