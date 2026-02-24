using System.Text.Json.Serialization;

namespace Gatrix.Server.Sdk.Models;

public class Survey
{
    [JsonPropertyName("id")] public string Id { get; set; } = string.Empty;
    [JsonPropertyName("platformSurveyId")] public string PlatformSurveyId { get; set; } = string.Empty;
    [JsonPropertyName("surveyTitle")] public string SurveyTitle { get; set; } = string.Empty;
    [JsonPropertyName("surveyContent")] public string? SurveyContent { get; set; }
    [JsonPropertyName("triggerConditions")] public List<TriggerCondition> TriggerConditions { get; set; } = [];
    [JsonPropertyName("participationRewards")] public List<Reward>? ParticipationRewards { get; set; }
    [JsonPropertyName("rewardMailTitle")] public string? RewardMailTitle { get; set; }
    [JsonPropertyName("rewardMailContent")] public string? RewardMailContent { get; set; }
    [JsonPropertyName("targetPlatforms")] public List<string>? TargetPlatforms { get; set; }
    [JsonPropertyName("targetChannels")] public List<string>? TargetChannels { get; set; }
    [JsonPropertyName("targetSubchannels")] public List<string>? TargetSubchannels { get; set; }
    [JsonPropertyName("targetWorlds")] public List<string>? TargetWorlds { get; set; }
}

public class TriggerCondition
{
    [JsonPropertyName("type")] public string Type { get; set; } = string.Empty;
    [JsonPropertyName("value")] public int Value { get; set; }
}

public class Reward
{
    [JsonPropertyName("type")] public int Type { get; set; }
    [JsonPropertyName("id")] public int Id { get; set; }
    [JsonPropertyName("quantity")] public int Quantity { get; set; }
}

public class SurveySettings
{
    [JsonPropertyName("defaultSurveyUrl")] public string DefaultSurveyUrl { get; set; } = string.Empty;
    [JsonPropertyName("completionUrl")] public string CompletionUrl { get; set; } = string.Empty;
    [JsonPropertyName("linkCaption")] public string LinkCaption { get; set; } = string.Empty;
    [JsonPropertyName("verificationKey")] public string VerificationKey { get; set; } = string.Empty;
}
