using System;
using System.Text.Json.Serialization;

namespace Gatrix.Server.Sdk.Models;

/// <summary>
/// Represents a variable (Key-Value) item in Gatrix.
/// </summary>
public class VarItem
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("varKey")]
    public string VarKey { get; set; } = string.Empty;

    [JsonPropertyName("varValue")]
    public string? VarValue { get; set; }

    [JsonPropertyName("valueType")]
    public string ValueType { get; set; } = "string";

    [JsonPropertyName("description")]
    public string? Description { get; set; }

    [JsonPropertyName("isSystemDefined")]
    public bool IsSystemDefined { get; set; }

    [JsonPropertyName("isCopyable")]
    public bool IsCopyable { get; set; }

    [JsonPropertyName("updatedAt")]
    public DateTime? UpdatedAt { get; set; }
}
