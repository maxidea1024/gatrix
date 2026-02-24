using System.Text.Json.Serialization;

namespace Gatrix.Server.Sdk.Models;

/// <summary>
/// Evaluation reason — maps to shared EvaluationReason type.
/// </summary>
public static class EvaluationReasons
{
    public const string Enabled = "enabled";
    public const string Disabled = "disabled";
    public const string StrategyMatch = "strategy_match";
    public const string ConstraintMatch = "constraint_match";
    public const string Rollout = "rollout";
    public const string Default = "default";
    public const string NotFound = "not_found";
    public const string Error = "error";
}

/// <summary>
/// Variant source names — maps to shared VARIANT_SOURCE.
/// </summary>
public static class VariantSource
{
    public const string FlagDefaultEnabled = "flag_default_enabled";
    public const string FlagDefaultDisabled = "flag_default_disabled";
    public const string EnvDefaultEnabled = "env_default_enabled";
    public const string EnvDefaultDisabled = "env_default_disabled";
    public const string Missing = "missing";
}

/// <summary>
/// Result of a feature flag evaluation — maps to shared EvaluationResult.
/// </summary>
public class EvaluationResult
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("flagName")]
    public string FlagName { get; set; } = string.Empty;

    [JsonPropertyName("enabled")]
    public bool Enabled { get; set; }

    [JsonPropertyName("variant")]
    public Variant Variant { get; set; } = new();

    [JsonPropertyName("reason")]
    public string Reason { get; set; } = string.Empty;
}

/// <summary>
/// Detailed evaluation result including the resolved value and variant metadata.
/// Returned by *Details methods.
/// </summary>
public class EvaluationDetail<T>
{
    public string FlagName { get; set; } = string.Empty;
    public T? Value { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string? VariantName { get; set; }
}
