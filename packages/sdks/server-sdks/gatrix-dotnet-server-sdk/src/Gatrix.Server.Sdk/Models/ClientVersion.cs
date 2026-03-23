using System.Text.Json.Serialization;

namespace Gatrix.Server.Sdk.Models;

public class ClientVersion
{
    [JsonPropertyName("id")] public int Id { get; set; }
    [JsonPropertyName("platform")] public string Platform { get; set; } = string.Empty;
    [JsonPropertyName("clientVersion")] public string Version { get; set; } = string.Empty;
    [JsonPropertyName("clientStatus")] public string ClientStatus { get; set; } = string.Empty;
    [JsonPropertyName("gameServerAddress")] public string GameServerAddress { get; set; } = string.Empty;
    [JsonPropertyName("patchAddress")] public string PatchAddress { get; set; } = string.Empty;
    [JsonPropertyName("guestModeAllowed")] public bool GuestModeAllowed { get; set; }
    [JsonPropertyName("externalClickLink")] public string? ExternalClickLink { get; set; }
    [JsonPropertyName("maintenanceMessage")] public string? MaintenanceMessage { get; set; }
    [JsonPropertyName("maintenanceLocales")] public List<MaintenanceLocale>? MaintenanceLocales { get; set; }
    [JsonPropertyName("customPayload")] public Dictionary<string, object>? CustomPayload { get; set; }
    [JsonPropertyName("minPatchVersion")] public string? MinPatchVersion { get; set; }
}
