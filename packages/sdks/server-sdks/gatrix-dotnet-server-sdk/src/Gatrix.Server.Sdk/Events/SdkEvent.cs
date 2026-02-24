using System.Text.Json;
using System.Text.Json.Serialization;

namespace Gatrix.Server.Sdk.Events;

/// <summary>
/// SDK event received from Redis Pub/Sub.
/// </summary>
public class SdkEvent
{
    [JsonPropertyName("type")] public string Type { get; set; } = string.Empty;
    [JsonPropertyName("data")] public SdkEventData Data { get; set; } = new();
    [JsonPropertyName("timestamp")] public string? Timestamp { get; set; }
}

public class SdkEventData
{
    [JsonPropertyName("id")] public JsonElement? Id { get; set; }
    [JsonPropertyName("environment")] public string? Environment { get; set; }
    [JsonPropertyName("isVisible")] public JsonElement? IsVisible { get; set; }
    [JsonPropertyName("isActive")] public JsonElement? IsActive { get; set; }
    [JsonPropertyName("status")] public string? Status { get; set; }
    [JsonPropertyName("segmentName")] public string? SegmentName { get; set; }

    /// <summary>Get id as int, handling JSON number/string.</summary>
    public int? GetIdAsInt()
    {
        if (Id is null || Id.Value.ValueKind == JsonValueKind.Null) return null;
        if (Id.Value.ValueKind == JsonValueKind.Number) return Id.Value.GetInt32();
        if (Id.Value.ValueKind == JsonValueKind.String && int.TryParse(Id.Value.GetString(), out var v)) return v;
        return null;
    }

    /// <summary>Get id as string.</summary>
    public string? GetIdAsString()
    {
        if (Id is null || Id.Value.ValueKind == JsonValueKind.Null) return null;
        return Id.Value.ToString();
    }

    /// <summary>Resolve isVisible from JSON (handles 0/1 from MySQL).</summary>
    public bool? GetIsVisible()
    {
        if (IsVisible is null || IsVisible.Value.ValueKind == JsonValueKind.Null) return null;
        if (IsVisible.Value.ValueKind == JsonValueKind.True) return true;
        if (IsVisible.Value.ValueKind == JsonValueKind.False) return false;
        if (IsVisible.Value.ValueKind == JsonValueKind.Number) return IsVisible.Value.GetInt32() != 0;
        return null;
    }

    /// <summary>Resolve isActive from JSON (handles 0/1 from MySQL).</summary>
    public bool? GetIsActive()
    {
        if (IsActive is null || IsActive.Value.ValueKind == JsonValueKind.Null) return null;
        if (IsActive.Value.ValueKind == JsonValueKind.True) return true;
        if (IsActive.Value.ValueKind == JsonValueKind.False) return false;
        if (IsActive.Value.ValueKind == JsonValueKind.Number) return IsActive.Value.GetInt32() != 0;
        return null;
    }
}

/// <summary>Callback delegate for SDK events.</summary>
public delegate Task SdkEventCallback(SdkEvent sdkEvent);
