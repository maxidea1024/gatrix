using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using Gatrix.Server.Sdk.Models;

namespace Gatrix.Server.Sdk.Evaluation;

/// <summary>
/// Feature Flag Evaluator — exact port of @gatrix/shared FeatureFlagEvaluator.
/// 
/// Key design decisions (from original):
/// - isArchived is NOT checked here. It is a management-only field.
/// - Segment constraints are evaluated BEFORE strategy constraints.
/// - isActive on segments is for UI display only, not for evaluation.
/// </summary>
public class FeatureFlagEvaluator
{
    /// <summary>
    /// Evaluate a single flag.
    /// </summary>
    public static EvaluationResult Evaluate(
        FeatureFlag flag,
        EvaluationContext context,
        IReadOnlyDictionary<string, FeatureSegment> segmentsMap)
    {
        string reason = EvaluationReasons.Disabled;

        if (flag.IsEnabled)
        {
            var activeStrategies = flag.Strategies.Where(s => s.IsEnabled).ToList();

            if (activeStrategies.Count > 0)
            {
                foreach (var strategy in activeStrategies)
                {
                    if (EvaluateStrategy(strategy, context, flag, segmentsMap))
                    {
                        var variantData = SelectVariant(flag, context, strategy);
                        var defaultEnabledName = flag.ValueSource == "environment"
                            ? VariantSource.EnvDefaultEnabled
                            : VariantSource.FlagDefaultEnabled;

                        var variant = new Variant
                        {
                            Name = variantData?.Name ?? defaultEnabledName,
                            Weight = variantData?.Weight ?? 100,
                            Value = GetFallbackValue(variantData?.Value ?? flag.EnabledValue, flag.ValueType),
                            ValueType = flag.ValueType ?? "string",
                            Enabled = true,
                        };

                        return new EvaluationResult
                        {
                            Id = flag.Id,
                            FlagName = flag.Name,
                            Enabled = true,
                            Reason = EvaluationReasons.StrategyMatch,
                            Variant = variant,
                        };
                    }
                }
                // Strategies exist but none matched
                reason = EvaluationReasons.Default;
            }
            else
            {
                // No strategies or all disabled — enabled by default
                var variantData = SelectVariant(flag, context);
                var defaultEnabledName = flag.ValueSource == "environment"
                    ? VariantSource.EnvDefaultEnabled
                    : VariantSource.FlagDefaultEnabled;

                var variant = new Variant
                {
                    Name = variantData?.Name ?? defaultEnabledName,
                    Weight = variantData?.Weight ?? 100,
                    Value = GetFallbackValue(variantData?.Value ?? flag.EnabledValue, flag.ValueType),
                    ValueType = flag.ValueType ?? "string",
                    Enabled = true,
                };

                return new EvaluationResult
                {
                    Id = flag.Id,
                    FlagName = flag.Name,
                    Enabled = true,
                    Reason = EvaluationReasons.Default,
                    Variant = variant,
                };
            }
        }

        // Disabled or no strategy matched
        var defaultDisabledName = flag.ValueSource == "environment"
            ? VariantSource.EnvDefaultDisabled
            : VariantSource.FlagDefaultDisabled;

        return new EvaluationResult
        {
            Id = flag.Id,
            FlagName = flag.Name,
            Enabled = false,
            Reason = reason,
            Variant = new Variant
            {
                Name = defaultDisabledName,
                Weight = 100,
                Value = GetFallbackValue(flag.DisabledValue, flag.ValueType),
                ValueType = flag.ValueType ?? "string",
                Enabled = false,
            },
        };
    }

    /// <summary>
    /// Evaluate a single strategy.
    /// Order: segments → constraints → rollout
    /// </summary>
    private static bool EvaluateStrategy(
        FeatureStrategy strategy,
        EvaluationContext context,
        FeatureFlag flag,
        IReadOnlyDictionary<string, FeatureSegment> segmentsMap)
    {
        // 1. Check segment constraints (all referenced segments must pass)
        if (strategy.Segments is { Count: > 0 })
        {
            foreach (var segmentName in strategy.Segments)
            {
                if (!segmentsMap.TryGetValue(segmentName, out var segment))
                    continue; // isActive is for UI only

                if (segment.Constraints.Count > 0)
                {
                    var segmentPass = segment.Constraints.All(c => EvaluateConstraint(c, context));
                    if (!segmentPass) return false;
                }
            }
        }

        // 2. Check strategy constraints
        if (strategy.Constraints is { Count: > 0 })
        {
            var allConstraintsPass = strategy.Constraints.All(c => EvaluateConstraint(c, context));
            if (!allConstraintsPass) return false;
        }

        // 3. Check rollout percentage
        var rollout = strategy.Parameters?.Rollout ?? 100;
        if (rollout < 100)
        {
            var stickiness = strategy.Parameters?.Stickiness ?? "default";
            var groupId = strategy.Parameters?.GroupId ?? flag.Name;
            var percentage = CalculatePercentage(context, stickiness, groupId);
            if (percentage > rollout) return false;
        }

        return true;
    }

    /// <summary>
    /// Evaluate a single constraint — exact port of all operators.
    /// </summary>
    private static bool EvaluateConstraint(Constraint constraint, EvaluationContext context)
    {
        var contextValue = GetContextValue(constraint.ContextName, context);

        // Handle exists/not_exists BEFORE undefined check
        if (constraint.Operator == "exists")
        {
            var result = contextValue is not null;
            return constraint.Inverted ? !result : result;
        }
        if (constraint.Operator == "not_exists")
        {
            var result = contextValue is null;
            return constraint.Inverted ? !result : result;
        }

        // Handle arr_empty BEFORE undefined check (undefined is considered empty)
        if (constraint.Operator == "arr_empty")
        {
            var result = contextValue is not IEnumerable<object> arr || !arr.Any();
            return constraint.Inverted ? !result : result;
        }

        if (contextValue is null)
        {
            return constraint.Inverted;
        }

        // Array operators
        if (constraint.Operator is "arr_any" or "arr_all")
        {
            var arr = contextValue switch
            {
                JsonElement je when je.ValueKind == JsonValueKind.Array =>
                    je.EnumerateArray().Select(e => e.GetString() ?? "").ToList(),
                IEnumerable<object> enumerable => enumerable.Select(o => o?.ToString() ?? "").ToList(),
                _ => new List<string>(),
            };

            var targetValues = constraint.Values?
                .Select(v => constraint.CaseInsensitive ? v.ToLowerInvariant() : v)
                .ToList() ?? [];
            var compareArr = constraint.CaseInsensitive
                ? arr.Select(v => v.ToLowerInvariant()).ToList()
                : arr;

            bool result;
            if (constraint.Operator == "arr_any")
            {
                result = targetValues.Any(tv => compareArr.Contains(tv));
            }
            else // arr_all
            {
                result = targetValues.Count > 0 && targetValues.All(tv => compareArr.Contains(tv));
            }
            return constraint.Inverted ? !result : result;
        }

        var stringValue = ObjectToString(contextValue);
        var compareValue = constraint.CaseInsensitive ? stringValue.ToLowerInvariant() : stringValue;
        var targetValue = constraint.Value is not null
            ? (constraint.CaseInsensitive ? constraint.Value.ToLowerInvariant() : constraint.Value)
            : "";
        var targetVals = constraint.Values?
            .Select(v => constraint.CaseInsensitive ? v.ToLowerInvariant() : v)
            .ToList() ?? [];

        bool evalResult = constraint.Operator switch
        {
            // String
            "str_eq" => compareValue == targetValue,
            "str_contains" => compareValue.Contains(targetValue),
            "str_starts_with" => compareValue.StartsWith(targetValue),
            "str_ends_with" => compareValue.EndsWith(targetValue),
            "str_in" => targetVals.Contains(compareValue),
            "str_regex" => EvalRegex(stringValue, constraint.Value, constraint.CaseInsensitive),

            // Number
            "num_eq" => ToDouble(contextValue) == ToDouble(constraint.Value),
            "num_gt" => ToDouble(contextValue) > ToDouble(constraint.Value),
            "num_gte" => ToDouble(contextValue) >= ToDouble(constraint.Value),
            "num_lt" => ToDouble(contextValue) < ToDouble(constraint.Value),
            "num_lte" => ToDouble(contextValue) <= ToDouble(constraint.Value),
            "num_in" => targetVals.Select(v => ToDouble(v)).Contains(ToDouble(contextValue)),

            // Boolean
            "bool_is" => ToBool(contextValue) == (constraint.Value == "true"),

            // Date
            "date_eq" => ToDateTicks(stringValue) == ToDateTicks(targetValue),
            "date_gt" => ToDateTicks(stringValue) > ToDateTicks(targetValue),
            "date_gte" => ToDateTicks(stringValue) >= ToDateTicks(targetValue),
            "date_lt" => ToDateTicks(stringValue) < ToDateTicks(targetValue),
            "date_lte" => ToDateTicks(stringValue) <= ToDateTicks(targetValue),

            // Semver
            "semver_eq" => CompareSemver(stringValue, targetValue) == 0,
            "semver_gt" => CompareSemver(stringValue, targetValue) > 0,
            "semver_gte" => CompareSemver(stringValue, targetValue) >= 0,
            "semver_lt" => CompareSemver(stringValue, targetValue) < 0,
            "semver_lte" => CompareSemver(stringValue, targetValue) <= 0,
            "semver_in" => targetVals.Any(v => CompareSemver(stringValue, v) == 0),

            _ => false,
        };

        return constraint.Inverted ? !evalResult : evalResult;
    }

    // ── Context value extraction ──────────────────────────────────────

    private static object? GetContextValue(string name, EvaluationContext context)
    {
        return name switch
        {
            "userId" => context.UserId,
            "sessionId" => context.SessionId,
            "appName" => context.AppName,
            "appVersion" => context.AppVersion,
            "remoteAddress" => context.RemoteAddress,
            _ => context.Properties.TryGetValue(name, out var val) ? val : null,
        };
    }

    // ── Rollout percentage ────────────────────────────────────────────

    private static double CalculatePercentage(EvaluationContext context, string stickiness, string groupId)
    {
        string stickinessValue;

        if (stickiness is "default" or "userId")
        {
            stickinessValue = context.UserId ?? context.SessionId ?? Random.Shared.NextDouble().ToString(CultureInfo.InvariantCulture);
        }
        else if (stickiness == "sessionId")
        {
            stickinessValue = context.SessionId ?? Random.Shared.NextDouble().ToString(CultureInfo.InvariantCulture);
        }
        else if (stickiness == "random")
        {
            stickinessValue = Random.Shared.NextDouble().ToString(CultureInfo.InvariantCulture);
        }
        else
        {
            var val = GetContextValue(stickiness, context);
            stickinessValue = val?.ToString() ?? Random.Shared.NextDouble().ToString(CultureInfo.InvariantCulture);
        }

        var seed = $"{groupId}:{stickinessValue}";
        var hash = MurmurHash3.Hash(seed);
        return (hash % 10000) / 100.0;
    }

    // ── Variant selection (weighted) ──────────────────────────────────

    private static Variant? SelectVariant(FeatureFlag flag, EvaluationContext context, FeatureStrategy? matchedStrategy = null)
    {
        if (flag.Variants.Count == 0) return null;

        var totalWeight = flag.Variants.Sum(v => v.Weight);
        if (totalWeight <= 0) return null;

        var stickiness = matchedStrategy?.Parameters?.Stickiness ?? "default";
        var percentage = CalculatePercentage(context, stickiness, $"{flag.Name}-variant");
        var targetWeight = (percentage / 100.0) * totalWeight;

        double cumulativeWeight = 0;
        foreach (var variant in flag.Variants)
        {
            cumulativeWeight += variant.Weight;
            if (targetWeight <= cumulativeWeight) return variant;
        }
        return flag.Variants[^1];
    }

    // ── GetFallbackValue — coerce to declared valueType ─────────────

    /// <summary>
    /// Ensure a value matches the declared valueType.
    /// If null, returns a type-appropriate default.
    /// If exists but has wrong type, coerces it.
    /// </summary>
    public static object? GetFallbackValue(object? value, string? valueType)
    {
        if (value is null)
        {
            return valueType switch
            {
                "boolean" => false,
                "number" => 0,
                "json" => new Dictionary<string, object>(),
                _ => "", // string or default
            };
        }

        // Unwrap JsonElement
        if (value is JsonElement je)
        {
            return valueType switch
            {
                "string" => je.ValueKind == JsonValueKind.String ? je.GetString() : je.GetRawText(),
                "number" => je.TryGetDouble(out var d) ? d : 0,
                "boolean" => je.ValueKind == JsonValueKind.True,
                "json" => je,
                _ => je.GetRawText(),
            };
        }

        return valueType switch
        {
            "string" => value is string s ? s : value.ToString(),
            "number" => ToDouble(value),
            "boolean" => ToBool(value),
            "json" => value,
            _ => value,
        };
    }

    // ── Semver comparison ─────────────────────────────────────────────

    private static int CompareSemver(string a, string b)
    {
        var aParts = ParseSemver(a);
        var bParts = ParseSemver(b);
        var maxLen = Math.Max(aParts.Length, bParts.Length);

        for (var i = 0; i < maxLen; i++)
        {
            var aVal = i < aParts.Length ? aParts[i] : 0;
            var bVal = i < bParts.Length ? bParts[i] : 0;
            if (aVal < bVal) return -1;
            if (aVal > bVal) return 1;
        }
        return 0;
    }

    private static int[] ParseSemver(string v)
    {
        var cleaned = v.TrimStart('v', 'V');
        return cleaned.Split('.').Select(n => int.TryParse(n, out var i) ? i : 0).ToArray();
    }

    // ── Helpers ───────────────────────────────────────────────────────

    private static bool EvalRegex(string stringValue, string? pattern, bool caseInsensitive)
    {
        if (pattern is null) return false;
        try
        {
            var options = caseInsensitive ? RegexOptions.IgnoreCase : RegexOptions.None;
            return Regex.IsMatch(stringValue, pattern, options);
        }
        catch
        {
            return false;
        }
    }

    private static double ToDouble(object? value)
    {
        if (value is null) return 0;
        if (value is JsonElement je && je.TryGetDouble(out var d)) return d;
        return double.TryParse(value.ToString(), CultureInfo.InvariantCulture, out var result) ? result : 0;
    }

    private static bool ToBool(object? value)
    {
        if (value is bool b) return b;
        if (value is JsonElement je) return je.ValueKind == JsonValueKind.True;
        var str = value?.ToString();
        if (str == "true" || str == "1") return true;
        if (str == "false" || str == "0") return false;
        return value is not null;
    }

    private static long ToDateTicks(string value)
    {
        return DateTime.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.None, out var dt)
            ? dt.Ticks : 0;
    }

    private static string ObjectToString(object value)
    {
        if (value is JsonElement je)
        {
            return je.ValueKind == JsonValueKind.String ? je.GetString() ?? "" : je.GetRawText();
        }
        return value.ToString() ?? "";
    }
}
