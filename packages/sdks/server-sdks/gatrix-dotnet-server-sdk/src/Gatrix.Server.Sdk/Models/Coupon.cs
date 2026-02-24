using System.Text.Json.Serialization;

namespace Gatrix.Server.Sdk.Models;

public class RedeemCouponRequest
{
    [JsonPropertyName("code")] public string Code { get; set; } = string.Empty;
    [JsonPropertyName("userId")] public string UserId { get; set; } = string.Empty;
    [JsonPropertyName("userName")] public string UserName { get; set; } = string.Empty;
    [JsonPropertyName("characterId")] public string CharacterId { get; set; } = string.Empty;
    [JsonPropertyName("worldId")] public string WorldId { get; set; } = string.Empty;
    [JsonPropertyName("platform")] public string Platform { get; set; } = string.Empty;
    [JsonPropertyName("channel")] public string Channel { get; set; } = string.Empty;
    [JsonPropertyName("subChannel")] public string SubChannel { get; set; } = string.Empty;
}

public class RedeemCouponResponse
{
    [JsonPropertyName("reward")] public List<Reward> Rewards { get; set; } = [];
    [JsonPropertyName("userUsedCount")] public int UserUsedCount { get; set; }
    [JsonPropertyName("globalUsed")] public int GlobalUsed { get; set; }
    [JsonPropertyName("sequence")] public int Sequence { get; set; }
    [JsonPropertyName("usedAt")] public string UsedAt { get; set; } = string.Empty;
    [JsonPropertyName("rewardMailTitle")] public string RewardMailTitle { get; set; } = string.Empty;
    [JsonPropertyName("rewardMailContent")] public string RewardMailContent { get; set; } = string.Empty;
}
