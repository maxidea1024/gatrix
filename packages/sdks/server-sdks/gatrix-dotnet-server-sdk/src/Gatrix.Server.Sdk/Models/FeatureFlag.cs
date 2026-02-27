using System.Text.Json.Serialization;

namespace Gatrix.Server.Sdk.Models;

// ══════════════════════════════════════════════════════════════════
//  Exact port of @gatrix/shared/evaluation/types.ts
// ══════════════════════════════════════════════════════════════════

/// <summary>
/// Context passed to flag evaluation.
/// Maps to shared EvaluationContext.
/// </summary>
public class EvaluationContext
{
    [JsonPropertyName("userId")]
    public string? UserId { get; set; }

    [JsonPropertyName("sessionId")]
    public string? SessionId { get; set; }

    [JsonPropertyName("appName")]
    public string? AppName { get; set; }

    [JsonPropertyName("appVersion")]
    public string? AppVersion { get; set; }

    [JsonPropertyName("remoteAddress")]
    public string? RemoteAddress { get; set; }

    [JsonPropertyName("environment")]
    public string? Environment { get; set; }

    [JsonPropertyName("currentTime")]
    public DateTime? CurrentTime { get; set; }

    [JsonPropertyName("properties")]
    public Dictionary<string, object?> Properties { get; set; } = new(StringComparer.OrdinalIgnoreCase);

    public EvaluationContext Clone()
    {
        return new EvaluationContext
        {
            UserId = UserId,
            SessionId = SessionId,
            AppName = AppName,
            AppVersion = AppVersion,
            RemoteAddress = RemoteAddress,
            Environment = Environment,
            CurrentTime = CurrentTime,
            Properties = new Dictionary<string, object?>(Properties, StringComparer.OrdinalIgnoreCase),
        };
    }

    public EvaluationContext MergeWith(EvaluationContext? other)
    {
        if (other is null) return Clone();

        var merged = new EvaluationContext
        {
            UserId = other.UserId ?? UserId,
            SessionId = other.SessionId ?? SessionId,
            AppName = other.AppName ?? AppName,
            AppVersion = other.AppVersion ?? AppVersion,
            RemoteAddress = other.RemoteAddress ?? RemoteAddress,
            Environment = other.Environment ?? Environment,
            CurrentTime = other.CurrentTime ?? CurrentTime,
            Properties = new Dictionary<string, object?>(Properties, StringComparer.OrdinalIgnoreCase),
        };

        foreach (var kvp in other.Properties)
        {
            merged.Properties[kvp.Key] = kvp.Value;
        }

        return merged;
    }
}

/// <summary>
/// Constraint — maps to shared Constraint interface.
/// </summary>
public class Constraint
{
    [JsonPropertyName("contextName")]
    public string ContextName { get; set; } = string.Empty;

    [JsonPropertyName("operator")]
    public string Operator { get; set; } = string.Empty;

    [JsonPropertyName("value")]
    public string? Value { get; set; }

    [JsonPropertyName("values")]
    public List<string>? Values { get; set; }

    [JsonPropertyName("caseInsensitive")]
    public bool CaseInsensitive { get; set; }

    [JsonPropertyName("inverted")]
    public bool Inverted { get; set; }
}

/// <summary>
/// Strategy parameters — maps to shared StrategyParameters.
/// </summary>
public class StrategyParameters
{
    [JsonPropertyName("rollout")]
    public int? Rollout { get; set; }

    [JsonPropertyName("stickiness")]
    public string? Stickiness { get; set; }

    [JsonPropertyName("groupId")]
    public string? GroupId { get; set; }

    [JsonPropertyName("percentage")]
    public int? Percentage { get; set; }

    [JsonPropertyName("userIds")]
    public string? UserIds { get; set; }

    [JsonPropertyName("IPs")]
    public string? IPs { get; set; }

    [JsonPropertyName("hostNames")]
    public string? HostNames { get; set; }
}

/// <summary>
/// Variant — maps to shared Variant interface.
/// </summary>
public class Variant
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("weight")]
    public int Weight { get; set; }

    [JsonPropertyName("value")]
    public object? Value { get; set; }

    [JsonPropertyName("enabled")]
    public bool? Enabled { get; set; }
}

/// <summary>
/// Feature Segment — maps to shared FeatureSegment.
/// isActive is for UI display only, not for evaluation.
/// </summary>
public class FeatureSegment
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("constraints")]
    public List<Constraint> Constraints { get; set; } = [];

    [JsonPropertyName("isActive")]
    public bool IsActive { get; set; }
}

/// <summary>
/// Feature Strategy — maps to shared FeatureStrategy.
/// </summary>
public class FeatureStrategy
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("parameters")]
    public StrategyParameters? Parameters { get; set; }

    [JsonPropertyName("constraints")]
    public List<Constraint>? Constraints { get; set; }

    [JsonPropertyName("segments")]
    public List<string>? Segments { get; set; }

    [JsonPropertyName("isEnabled")]
    public bool IsEnabled { get; set; }
}

/// <summary>
/// Feature Flag definition — maps to shared FeatureFlag.
/// isArchived is intentionally excluded — management-only field.
/// </summary>
public class FeatureFlag
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("isEnabled")]
    public bool IsEnabled { get; set; }

    [JsonPropertyName("impressionDataEnabled")]
    public bool ImpressionDataEnabled { get; set; }

    [JsonPropertyName("strategies")]
    public List<FeatureStrategy> Strategies { get; set; } = [];

    [JsonPropertyName("variants")]
    public List<Variant> Variants { get; set; } = [];

    [JsonPropertyName("valueType")]
    public string? ValueType { get; set; }

    [JsonPropertyName("enabledValue")]
    public object? EnabledValue { get; set; }

    [JsonPropertyName("disabledValue")]
    public object? DisabledValue { get; set; }

    [JsonPropertyName("valueSource")]
    public string? ValueSource { get; set; }

    [JsonPropertyName("version")]
    public int? Version { get; set; }

    /// <summary>When true, this flag was returned in compact mode — strategies, variants, and enabledValue were stripped.</summary>
    [JsonPropertyName("compact")]
    public bool? Compact { get; set; }
}
