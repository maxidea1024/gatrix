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
/// Value source names — maps to shared VALUE_SOURCE.
/// </summary>
public static class ValueSource
{
    public const string FlagDefaultEnabled = "$flag-default-enabled";
    public const string FlagDefaultDisabled = "$flag-default-disabled";
    public const string EnvDefaultEnabled = "$env-default-enabled";
    public const string EnvDefaultDisabled = "$env-default-disabled";
    public const string Missing = "$missing";
    public const string TypeMismatch = "$type-mismatch";
}

/// <summary>
/// Result of a feature flag evaluation — maps to shared EvaluationResult.
/// </summary>
public class EvaluationResult
{
    /// <summary>
    /// Evaluation ID
    /// </summary>
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    /// <summary>
    /// Flag name
    /// </summary>
    [JsonPropertyName("flagName")]
    public string FlagName { get; set; } = string.Empty;

    /// <summary>
    /// Whether the flag is enabled
    /// </summary>
    [JsonPropertyName("enabled")]
    public bool Enabled { get; set; }

    /// <summary>
    /// Variant
    /// </summary>
    [JsonPropertyName("variant")]
    public Variant Variant { get; set; } = new();

    /// <summary>
    /// Evaluation reason
    /// </summary>
    [JsonPropertyName("reason")]
    public string Reason { get; set; } = string.Empty;

    /// <summary>
    /// Value type of the flag (string, number, boolean, json)
    /// </summary>
    [JsonPropertyName("valueType")]
    public string? ValueType { get; set; }
}

/// <summary>
/// Detailed evaluation result including the resolved value and variant metadata.
/// Returned by *Details methods.
/// </summary>
public class EvaluationDetail<T>
{
    /// <summary>
    /// Flag name
    /// </summary>
    public string FlagName { get; set; } = string.Empty;

    /// <summary>
    /// Resolved value
    /// </summary>
    public T? Value { get; set; }

    /// <summary>
    /// Evaluation reason
    /// </summary>
    public string Reason { get; set; } = string.Empty;

    /// <summary>
    /// Variant name
    /// </summary>
    public string? VariantName { get; set; }
}
