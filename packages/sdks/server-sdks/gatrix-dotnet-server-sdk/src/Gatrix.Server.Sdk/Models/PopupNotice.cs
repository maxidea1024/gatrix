using System.Text.Json.Serialization;

namespace Gatrix.Server.Sdk.Models;

public class PopupNotice
{
    [JsonPropertyName("id")] public int Id { get; set; }
    [JsonPropertyName("content")] public string Content { get; set; } = string.Empty;
    [JsonPropertyName("targetWorlds")] public List<string>? TargetWorlds { get; set; }
    [JsonPropertyName("targetWorldsInverted")] public bool? TargetWorldsInverted { get; set; }
    [JsonPropertyName("targetPlatforms")] public List<string>? TargetPlatforms { get; set; }
    [JsonPropertyName("targetPlatformsInverted")] public bool? TargetPlatformsInverted { get; set; }
    [JsonPropertyName("targetChannels")] public List<string>? TargetChannels { get; set; }
    [JsonPropertyName("targetChannelsInverted")] public bool? TargetChannelsInverted { get; set; }
    [JsonPropertyName("targetSubchannels")] public List<string>? TargetSubchannels { get; set; }
    [JsonPropertyName("targetSubchannelsInverted")] public bool? TargetSubchannelsInverted { get; set; }
    [JsonPropertyName("targetUserIds")] public List<string>? TargetUserIds { get; set; }
    [JsonPropertyName("targetUserIdsInverted")] public bool? TargetUserIdsInverted { get; set; }
    [JsonPropertyName("displayPriority")] public int DisplayPriority { get; set; }
    [JsonPropertyName("showOnce")] public bool ShowOnce { get; set; }
    [JsonPropertyName("startDate")] public string? StartDate { get; set; }
    [JsonPropertyName("endDate")] public string? EndDate { get; set; }
}
