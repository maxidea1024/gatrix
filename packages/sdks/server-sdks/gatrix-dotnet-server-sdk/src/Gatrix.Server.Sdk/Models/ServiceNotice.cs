using System.Text.Json.Serialization;

namespace Gatrix.Server.Sdk.Models;

public class ServiceNotice
{
    [JsonPropertyName("id")] public int Id { get; set; }
    [JsonPropertyName("isActive")] public bool IsActive { get; set; }
    [JsonPropertyName("isPinned")] public bool IsPinned { get; set; }
    [JsonPropertyName("category")] public string Category { get; set; } = string.Empty;
    [JsonPropertyName("platforms")] public List<string> Platforms { get; set; } = [];
    [JsonPropertyName("title")] public string Title { get; set; } = string.Empty;
    [JsonPropertyName("content")] public string Content { get; set; } = string.Empty;
    [JsonPropertyName("startDate")] public string? StartDate { get; set; }
    [JsonPropertyName("endDate")] public string? EndDate { get; set; }
}
