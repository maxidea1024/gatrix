using System.Text.Json.Serialization;

namespace Gatrix.Server.Sdk.Models;

public class StoreProduct
{
    [JsonPropertyName("id")] public string Id { get; set; } = string.Empty;
    [JsonPropertyName("productId")] public string ProductId { get; set; } = string.Empty;
    [JsonPropertyName("productName")] public string ProductName { get; set; } = string.Empty;
    [JsonPropertyName("store")] public string Store { get; set; } = string.Empty;
    [JsonPropertyName("price")] public decimal Price { get; set; }
    [JsonPropertyName("currency")] public string Currency { get; set; } = string.Empty;
    [JsonPropertyName("description")] public string? Description { get; set; }
    [JsonPropertyName("tags")] public List<string>? Tags { get; set; }
}
