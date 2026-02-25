using System.Text.Json.Serialization;

namespace Gatrix.Server.Sdk.Models;

public class Banner
{
    [JsonPropertyName("bannerId")] public string BannerId { get; set; } = string.Empty;
    [JsonPropertyName("name")] public string Name { get; set; } = string.Empty;
    [JsonPropertyName("description")] public string? Description { get; set; }
    [JsonPropertyName("width")] public int Width { get; set; }
    [JsonPropertyName("height")] public int Height { get; set; }
    [JsonPropertyName("playbackSpeed")] public int PlaybackSpeed { get; set; }
    [JsonPropertyName("isActive")] public bool IsActive { get; set; }
    [JsonPropertyName("metadata")] public Dictionary<string, object>? Metadata { get; set; }
    [JsonPropertyName("sequences")] public List<BannerSequence> Sequences { get; set; } = [];
    [JsonPropertyName("version")] public int Version { get; set; }
    [JsonPropertyName("status")] public string Status { get; set; } = string.Empty;
}

public class BannerSequence
{
    [JsonPropertyName("sequenceId")] public string SequenceId { get; set; } = string.Empty;
    [JsonPropertyName("name")] public string Name { get; set; } = string.Empty;
    [JsonPropertyName("frames")] public List<BannerFrame> Frames { get; set; } = [];
}

public class BannerFrame
{
    [JsonPropertyName("frameId")] public string FrameId { get; set; } = string.Empty;
    [JsonPropertyName("imageUrl")] public string ImageUrl { get; set; } = string.Empty;
    [JsonPropertyName("delay")] public int Delay { get; set; }
}
