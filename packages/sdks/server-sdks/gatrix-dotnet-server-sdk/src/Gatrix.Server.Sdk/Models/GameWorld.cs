using System.Text.Json.Serialization;

namespace Gatrix.Server.Sdk.Models;

public class GameWorld
{
    [JsonPropertyName("id")] public int Id { get; set; }
    [JsonPropertyName("worldId")] public string WorldId { get; set; } = string.Empty;
    [JsonPropertyName("name")] public string Name { get; set; } = string.Empty;
    [JsonPropertyName("isMaintenance")] public bool IsMaintenance { get; set; }
    [JsonPropertyName("maintenanceMessage")] public string? MaintenanceMessage { get; set; }
    [JsonPropertyName("maintenanceStartDate")] public string? MaintenanceStartDate { get; set; }
    [JsonPropertyName("maintenanceEndDate")] public string? MaintenanceEndDate { get; set; }
    [JsonPropertyName("supportsMultiLanguage")] public bool? SupportsMultiLanguage { get; set; }
    [JsonPropertyName("maintenanceLocales")] public List<MaintenanceLocale>? MaintenanceLocales { get; set; }
    [JsonPropertyName("forceDisconnect")] public bool? ForceDisconnect { get; set; }
    [JsonPropertyName("gracePeriodMinutes")] public int? GracePeriodMinutes { get; set; }
    [JsonPropertyName("displayOrder")] public int DisplayOrder { get; set; }
    [JsonPropertyName("customPayload")] public Dictionary<string, object>? CustomPayload { get; set; }
    [JsonPropertyName("infraSettings")] public Dictionary<string, object>? InfraSettings { get; set; }
    [JsonPropertyName("worldServerAddress")] public string WorldServerAddress { get; set; } = string.Empty;
    [JsonPropertyName("tags")] public List<string>? Tags { get; set; }
}

public class MaintenanceLocale
{
    [JsonPropertyName("lang")] public string Lang { get; set; } = string.Empty;
    [JsonPropertyName("message")] public string Message { get; set; } = string.Empty;
}

public class GameWorldListResponse
{
    [JsonPropertyName("worlds")] public List<GameWorld> Worlds { get; set; } = [];
}
