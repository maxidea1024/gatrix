using System.Text.Json;
using Gatrix.Server.Sdk.Evaluation;
using Gatrix.Server.Sdk.Models;
using Xunit;

namespace Gatrix.Server.Sdk.Tests;

/// <summary>
/// Comprehensive unit tests for FeatureFlagEvaluator.
/// Covers: disabled flags, enabled flags (no strategies, with strategies),
/// all constraint operators, inverted constraints, case-insensitive mode,
/// segment evaluation, rollout percentage, variant selection, and value coercion.
/// </summary>
public class FeatureFlagEvaluatorTests
{
    private static readonly Dictionary<string, FeatureSegment> EmptySegments = new();

    // ═══════════════════════════════════════════════════════════════
    //  Helpers
    // ═══════════════════════════════════════════════════════════════

    private static FeatureFlag MakeFlag(
        string name = "test-flag",
        bool isEnabled = true,
        string valueType = "boolean",
        object? enabledValue = null,
        object? disabledValue = null,
        List<FeatureStrategy>? strategies = null,
        List<Variant>? variants = null,
        string? valueSource = null)
    {
        return new FeatureFlag
        {
            Id = "flag-001",
            Name = name,
            IsEnabled = isEnabled,
            ValueType = valueType,
            EnabledValue = enabledValue ?? (valueType == "boolean" ? true : (object)"on"),
            DisabledValue = disabledValue ?? (valueType == "boolean" ? false : (object)"off"),
            Strategies = strategies ?? [],
            Variants = variants ?? [],
            ValueSource = valueSource,
        };
    }

    private static FeatureStrategy MakeStrategy(
        bool isEnabled = true,
        List<Constraint>? constraints = null,
        List<string>? segments = null,
        StrategyParameters? parameters = null)
    {
        return new FeatureStrategy
        {
            Name = "strategy-1",
            IsEnabled = isEnabled,
            Constraints = constraints,
            Segments = segments,
            Parameters = parameters,
        };
    }

    private static Constraint MakeConstraint(
        string contextName,
        string op,
        string? value = null,
        List<string>? values = null,
        bool inverted = false,
        bool caseInsensitive = false)
    {
        return new Constraint
        {
            ContextName = contextName,
            Operator = op,
            Value = value,
            Values = values,
            Inverted = inverted,
            CaseInsensitive = caseInsensitive,
        };
    }

    private static EvaluationContext MakeContext(
        string? userId = null,
        string? sessionId = null,
        string? appName = null,
        string? appVersion = null,
        string? remoteAddress = null,
        Dictionary<string, object?>? properties = null)
    {
        return new EvaluationContext
        {
            UserId = userId,
            SessionId = sessionId,
            AppName = appName,
            AppVersion = appVersion,
            RemoteAddress = remoteAddress,
            Properties = properties ?? new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase),
        };
    }

    // ═══════════════════════════════════════════════════════════════
    //  1. Disabled flag
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public void DisabledFlag_ReturnsDisabledResult()
    {
        var flag = MakeFlag(isEnabled: false);
        var ctx = MakeContext(userId: "user-1");

        var result = FeatureFlagEvaluator.Evaluate(flag, ctx, EmptySegments);

        Assert.False(result.Enabled);
        Assert.Equal(EvaluationReasons.Disabled, result.Reason);
        Assert.Equal(VariantSource.FlagDefaultDisabled, result.Variant.Name);
        Assert.Equal(false, result.Variant.Enabled);
    }

    [Fact]
    public void DisabledFlag_WithEnvironmentValueSource_UsesEnvVariantName()
    {
        var flag = MakeFlag(isEnabled: false, valueSource: "environment");
        var ctx = MakeContext();

        var result = FeatureFlagEvaluator.Evaluate(flag, ctx, EmptySegments);

        Assert.False(result.Enabled);
        Assert.Equal(VariantSource.EnvDefaultDisabled, result.Variant.Name);
    }

    // ═══════════════════════════════════════════════════════════════
    //  2. Enabled flag — no strategies
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public void EnabledFlag_NoStrategies_ReturnsEnabledDefault()
    {
        var flag = MakeFlag(isEnabled: true);
        var ctx = MakeContext();

        var result = FeatureFlagEvaluator.Evaluate(flag, ctx, EmptySegments);

        Assert.True(result.Enabled);
        Assert.Equal(EvaluationReasons.Default, result.Reason);
        Assert.Equal(VariantSource.FlagDefaultEnabled, result.Variant.Name);
        Assert.Equal(true, result.Variant.Enabled);
    }

    [Fact]
    public void EnabledFlag_AllStrategiesDisabled_ReturnsEnabledDefault()
    {
        var flag = MakeFlag(
            isEnabled: true,
            strategies: [MakeStrategy(isEnabled: false)]);
        var ctx = MakeContext();

        var result = FeatureFlagEvaluator.Evaluate(flag, ctx, EmptySegments);

        Assert.True(result.Enabled);
        Assert.Equal(EvaluationReasons.Default, result.Reason);
    }

    // ═══════════════════════════════════════════════════════════════
    //  3. Strategy matching — constraint-based
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public void StrategyMatch_NoConstraints_MatchesAnyContext()
    {
        var flag = MakeFlag(
            isEnabled: true,
            strategies: [MakeStrategy()]);
        var ctx = MakeContext();

        var result = FeatureFlagEvaluator.Evaluate(flag, ctx, EmptySegments);

        Assert.True(result.Enabled);
        Assert.Equal(EvaluationReasons.StrategyMatch, result.Reason);
    }

    [Fact]
    public void StrategyMatch_NoMatchingStrategy_ReturnsDisabledDefault()
    {
        var flag = MakeFlag(
            isEnabled: true,
            strategies:
            [
                MakeStrategy(constraints: [MakeConstraint("userId", "str_eq", "admin")])
            ]);
        var ctx = MakeContext(userId: "guest");

        var result = FeatureFlagEvaluator.Evaluate(flag, ctx, EmptySegments);

        Assert.False(result.Enabled);
        Assert.Equal(EvaluationReasons.Default, result.Reason);
    }

    [Fact]
    public void StrategyMatch_MultipleStrategies_MatchesFirst()
    {
        var flag = MakeFlag(
            isEnabled: true,
            valueType: "string",
            enabledValue: "strategy-result",
            strategies:
            [
                MakeStrategy(constraints: [MakeConstraint("userId", "str_eq", "vip")]),
                MakeStrategy(constraints: [MakeConstraint("userId", "str_eq", "normal")]),
            ]);
        var ctx = MakeContext(userId: "normal");

        var result = FeatureFlagEvaluator.Evaluate(flag, ctx, EmptySegments);

        Assert.True(result.Enabled);
        Assert.Equal(EvaluationReasons.StrategyMatch, result.Reason);
    }

    // ═══════════════════════════════════════════════════════════════
    //  4. String operators
    // ═══════════════════════════════════════════════════════════════

    [Theory]
    [InlineData("str_eq", "hello", "hello", true)]
    [InlineData("str_eq", "hello", "world", false)]
    [InlineData("str_contains", "hello world", "lo wo", true)]
    [InlineData("str_contains", "hello", "xyz", false)]
    [InlineData("str_starts_with", "hello world", "hello", true)]
    [InlineData("str_starts_with", "hello world", "world", false)]
    [InlineData("str_ends_with", "hello world", "world", true)]
    [InlineData("str_ends_with", "hello world", "hello", false)]
    public void StringOperators_BasicCases(string op, string contextVal, string constraintVal, bool expected)
    {
        var flag = MakeFlag(
            isEnabled: true,
            strategies: [MakeStrategy(constraints: [MakeConstraint("userId", op, constraintVal)])]);
        var ctx = MakeContext(userId: contextVal);

        var result = FeatureFlagEvaluator.Evaluate(flag, ctx, EmptySegments);

        Assert.Equal(expected, result.Enabled);
    }

    [Fact]
    public void StringOperator_StrIn()
    {
        var flag = MakeFlag(
            isEnabled: true,
            strategies: [MakeStrategy(constraints:
                [MakeConstraint("userId", "str_in", values: ["admin", "vip", "moderator"])])]);

        var result1 = FeatureFlagEvaluator.Evaluate(flag, MakeContext(userId: "vip"), EmptySegments);
        Assert.True(result1.Enabled);

        var result2 = FeatureFlagEvaluator.Evaluate(flag, MakeContext(userId: "guest"), EmptySegments);
        Assert.False(result2.Enabled);
    }

    [Fact]
    public void StringOperator_StrRegex()
    {
        var flag = MakeFlag(
            isEnabled: true,
            strategies: [MakeStrategy(constraints:
                [MakeConstraint("userId", "str_regex", @"^user-\d+$")])]);

        Assert.True(FeatureFlagEvaluator.Evaluate(flag, MakeContext(userId: "user-123"), EmptySegments).Enabled);
        Assert.False(FeatureFlagEvaluator.Evaluate(flag, MakeContext(userId: "admin"), EmptySegments).Enabled);
    }

    [Fact]
    public void StringOperator_CaseInsensitive()
    {
        var flag = MakeFlag(
            isEnabled: true,
            strategies: [MakeStrategy(constraints:
                [MakeConstraint("userId", "str_eq", "ADMIN", caseInsensitive: true)])]);

        Assert.True(FeatureFlagEvaluator.Evaluate(flag, MakeContext(userId: "admin"), EmptySegments).Enabled);
        Assert.True(FeatureFlagEvaluator.Evaluate(flag, MakeContext(userId: "Admin"), EmptySegments).Enabled);
        Assert.True(FeatureFlagEvaluator.Evaluate(flag, MakeContext(userId: "ADMIN"), EmptySegments).Enabled);
    }

    // ═══════════════════════════════════════════════════════════════
    //  5. Number operators
    // ═══════════════════════════════════════════════════════════════

    [Theory]
    [InlineData("num_eq", "42", "42", true)]
    [InlineData("num_eq", "42", "43", false)]
    [InlineData("num_gt", "50", "42", true)]
    [InlineData("num_gt", "42", "42", false)]
    [InlineData("num_gte", "42", "42", true)]
    [InlineData("num_gte", "41", "42", false)]
    [InlineData("num_lt", "10", "42", true)]
    [InlineData("num_lt", "42", "42", false)]
    [InlineData("num_lte", "42", "42", true)]
    [InlineData("num_lte", "43", "42", false)]
    public void NumberOperators_BasicCases(string op, string contextVal, string constraintVal, bool expected)
    {
        var flag = MakeFlag(
            isEnabled: true,
            strategies: [MakeStrategy(constraints:
                [MakeConstraint("userId", op, constraintVal)])]);
        var ctx = MakeContext(userId: contextVal);

        var result = FeatureFlagEvaluator.Evaluate(flag, ctx, EmptySegments);
        Assert.Equal(expected, result.Enabled);
    }

    [Fact]
    public void NumberOperator_NumIn()
    {
        var flag = MakeFlag(
            isEnabled: true,
            strategies: [MakeStrategy(constraints:
                [MakeConstraint("userId", "num_in", values: ["10", "20", "30"])])]);

        Assert.True(FeatureFlagEvaluator.Evaluate(flag, MakeContext(userId: "20"), EmptySegments).Enabled);
        Assert.False(FeatureFlagEvaluator.Evaluate(flag, MakeContext(userId: "25"), EmptySegments).Enabled);
    }

    // ═══════════════════════════════════════════════════════════════
    //  6. Boolean operator
    // ═══════════════════════════════════════════════════════════════

    [Theory]
    [InlineData("true", "true", true)]
    [InlineData("false", "false", true)]
    [InlineData("true", "false", false)]
    [InlineData("false", "true", false)]
    public void BoolOperator_BoolIs(string contextVal, string constraintVal, bool expected)
    {
        var flag = MakeFlag(
            isEnabled: true,
            strategies: [MakeStrategy(constraints:
                [MakeConstraint("userId", "bool_is", constraintVal)])]);
        var ctx = MakeContext(userId: contextVal);

        var result = FeatureFlagEvaluator.Evaluate(flag, ctx, EmptySegments);
        Assert.Equal(expected, result.Enabled);
    }

    // ═══════════════════════════════════════════════════════════════
    //  7. Date operators
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public void DateOperator_DateGt()
    {
        var flag = MakeFlag(
            isEnabled: true,
            strategies: [MakeStrategy(constraints:
                [MakeConstraint("userId", "date_gt", "2025-01-01")])]);

        Assert.True(FeatureFlagEvaluator.Evaluate(flag, MakeContext(userId: "2025-06-15"), EmptySegments).Enabled);
        Assert.False(FeatureFlagEvaluator.Evaluate(flag, MakeContext(userId: "2024-06-15"), EmptySegments).Enabled);
    }

    [Fact]
    public void DateOperator_DateLte()
    {
        var flag = MakeFlag(
            isEnabled: true,
            strategies: [MakeStrategy(constraints:
                [MakeConstraint("userId", "date_lte", "2025-12-31")])]);

        Assert.True(FeatureFlagEvaluator.Evaluate(flag, MakeContext(userId: "2025-12-31"), EmptySegments).Enabled);
        Assert.True(FeatureFlagEvaluator.Evaluate(flag, MakeContext(userId: "2025-01-01"), EmptySegments).Enabled);
        Assert.False(FeatureFlagEvaluator.Evaluate(flag, MakeContext(userId: "2026-01-01"), EmptySegments).Enabled);
    }

    // ═══════════════════════════════════════════════════════════════
    //  8. Semver operators
    // ═══════════════════════════════════════════════════════════════

    [Theory]
    [InlineData("semver_eq", "1.2.3", "1.2.3", true)]
    [InlineData("semver_eq", "1.2.3", "1.2.4", false)]
    [InlineData("semver_gt", "2.0.0", "1.9.9", true)]
    [InlineData("semver_gt", "1.0.0", "1.0.0", false)]
    [InlineData("semver_gte", "1.0.0", "1.0.0", true)]
    [InlineData("semver_lt", "1.0.0", "2.0.0", true)]
    [InlineData("semver_lte", "1.0.0", "1.0.0", true)]
    public void SemverOperators_BasicCases(string op, string contextVal, string constraintVal, bool expected)
    {
        var flag = MakeFlag(
            isEnabled: true,
            strategies: [MakeStrategy(constraints:
                [MakeConstraint("appVersion", op, constraintVal)])]);
        var ctx = MakeContext(appVersion: contextVal);

        Assert.Equal(expected, FeatureFlagEvaluator.Evaluate(flag, ctx, EmptySegments).Enabled);
    }

    [Fact]
    public void SemverOperator_VPrefix()
    {
        var flag = MakeFlag(
            isEnabled: true,
            strategies: [MakeStrategy(constraints:
                [MakeConstraint("appVersion", "semver_eq", "v1.2.3")])]);

        Assert.True(FeatureFlagEvaluator.Evaluate(flag, MakeContext(appVersion: "1.2.3"), EmptySegments).Enabled);
        Assert.True(FeatureFlagEvaluator.Evaluate(flag, MakeContext(appVersion: "v1.2.3"), EmptySegments).Enabled);
    }

    [Fact]
    public void SemverOperator_SemverIn()
    {
        var flag = MakeFlag(
            isEnabled: true,
            strategies: [MakeStrategy(constraints:
                [MakeConstraint("appVersion", "semver_in", values: ["1.0.0", "2.0.0", "3.0.0"])])]);

        Assert.True(FeatureFlagEvaluator.Evaluate(flag, MakeContext(appVersion: "2.0.0"), EmptySegments).Enabled);
        Assert.False(FeatureFlagEvaluator.Evaluate(flag, MakeContext(appVersion: "2.0.1"), EmptySegments).Enabled);
    }

    // ═══════════════════════════════════════════════════════════════
    //  9. Exists / Not-exists operators
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public void ExistsOperator_WithValue_ReturnsTrue()
    {
        var flag = MakeFlag(
            isEnabled: true,
            strategies: [MakeStrategy(constraints:
                [MakeConstraint("userId", "exists")])]);

        Assert.True(FeatureFlagEvaluator.Evaluate(flag, MakeContext(userId: "any"), EmptySegments).Enabled);
    }

    [Fact]
    public void ExistsOperator_WithoutValue_ReturnsFalse()
    {
        var flag = MakeFlag(
            isEnabled: true,
            strategies: [MakeStrategy(constraints:
                [MakeConstraint("userId", "exists")])]);

        Assert.False(FeatureFlagEvaluator.Evaluate(flag, MakeContext(), EmptySegments).Enabled);
    }

    [Fact]
    public void NotExistsOperator_WithoutValue_ReturnsTrue()
    {
        var flag = MakeFlag(
            isEnabled: true,
            strategies: [MakeStrategy(constraints:
                [MakeConstraint("userId", "not_exists")])]);

        Assert.True(FeatureFlagEvaluator.Evaluate(flag, MakeContext(), EmptySegments).Enabled);
    }

    [Fact]
    public void NotExistsOperator_WithValue_ReturnsFalse()
    {
        var flag = MakeFlag(
            isEnabled: true,
            strategies: [MakeStrategy(constraints:
                [MakeConstraint("userId", "not_exists")])]);

        Assert.False(FeatureFlagEvaluator.Evaluate(flag, MakeContext(userId: "any"), EmptySegments).Enabled);
    }

    // ═══════════════════════════════════════════════════════════════
    //  10. Inverted constraints
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public void InvertedConstraint_ReversesResult()
    {
        var flag = MakeFlag(
            isEnabled: true,
            strategies: [MakeStrategy(constraints:
                [MakeConstraint("userId", "str_eq", "admin", inverted: true)])]);

        // admin should NOT match (inverted)
        Assert.False(FeatureFlagEvaluator.Evaluate(flag, MakeContext(userId: "admin"), EmptySegments).Enabled);
        // non-admin SHOULD match (inverted)
        Assert.True(FeatureFlagEvaluator.Evaluate(flag, MakeContext(userId: "guest"), EmptySegments).Enabled);
    }

    [Fact]
    public void InvertedExists_WithValue_ReturnsFalse()
    {
        var flag = MakeFlag(
            isEnabled: true,
            strategies: [MakeStrategy(constraints:
                [MakeConstraint("userId", "exists", inverted: true)])]);

        Assert.False(FeatureFlagEvaluator.Evaluate(flag, MakeContext(userId: "any"), EmptySegments).Enabled);
    }

    // ═══════════════════════════════════════════════════════════════
    //  11. Custom properties
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public void CustomProperty_CanBeUsedInConstraints()
    {
        var flag = MakeFlag(
            isEnabled: true,
            strategies: [MakeStrategy(constraints:
                [MakeConstraint("country", "str_in", values: ["KR", "JP", "US"])])]);

        var ctx = MakeContext(properties: new Dictionary<string, object?> { ["country"] = "KR" });
        Assert.True(FeatureFlagEvaluator.Evaluate(flag, ctx, EmptySegments).Enabled);

        var ctx2 = MakeContext(properties: new Dictionary<string, object?> { ["country"] = "FR" });
        Assert.False(FeatureFlagEvaluator.Evaluate(flag, ctx2, EmptySegments).Enabled);
    }

    [Fact]
    public void MissingContextValue_OpNotExistsOrInverted_Fails()
    {
        // When context value is null and operator is not exists/not_exists,
        // it should return constraint.Inverted (false by default)
        var flag = MakeFlag(
            isEnabled: true,
            strategies: [MakeStrategy(constraints:
                [MakeConstraint("missingProp", "str_eq", "anything")])]);

        var result = FeatureFlagEvaluator.Evaluate(flag, MakeContext(), EmptySegments);
        Assert.False(result.Enabled);
    }

    // ═══════════════════════════════════════════════════════════════
    //  12. Segment evaluation
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public void Segment_AllConstraintsMustPass()
    {
        var segments = new Dictionary<string, FeatureSegment>
        {
            ["vip-users"] = new()
            {
                Name = "vip-users",
                IsActive = true,
                Constraints =
                [
                    new() { ContextName = "userId", Operator = "str_in", Values = ["user-1", "user-2", "user-3"] },
                ],
            },
        };

        var flag = MakeFlag(
            isEnabled: true,
            strategies: [MakeStrategy(segments: ["vip-users"])]);

        Assert.True(FeatureFlagEvaluator.Evaluate(flag, MakeContext(userId: "user-1"), segments).Enabled);
        Assert.False(FeatureFlagEvaluator.Evaluate(flag, MakeContext(userId: "user-99"), segments).Enabled);
    }

    [Fact]
    public void Segment_EvaluatedBeforeStrategyConstraints()
    {
        // Segment requires userId=admin, strategy requires appName=my-app
        // If segment fails, strategy constraints should not be evaluated
        var segments = new Dictionary<string, FeatureSegment>
        {
            ["admins"] = new()
            {
                Name = "admins",
                Constraints = [new() { ContextName = "userId", Operator = "str_eq", Value = "admin" }],
            },
        };

        var flag = MakeFlag(
            isEnabled: true,
            strategies: [MakeStrategy(
                segments: ["admins"],
                constraints: [MakeConstraint("appName", "str_eq", "my-app")])]);

        // userId=admin, appName=my-app → both pass → enabled
        Assert.True(FeatureFlagEvaluator.Evaluate(flag,
            MakeContext(userId: "admin", appName: "my-app"), segments).Enabled);

        // userId=guest → segment fails, strategy not evaluated → disabled
        Assert.False(FeatureFlagEvaluator.Evaluate(flag,
            MakeContext(userId: "guest", appName: "my-app"), segments).Enabled);

        // userId=admin, appName=other → segment passes, strategy fails → disabled
        Assert.False(FeatureFlagEvaluator.Evaluate(flag,
            MakeContext(userId: "admin", appName: "other"), segments).Enabled);
    }

    [Fact]
    public void Segment_UnknownSegmentName_IsIgnored()
    {
        var flag = MakeFlag(
            isEnabled: true,
            strategies: [MakeStrategy(segments: ["non-existent-segment"])]);

        // Unknown segment should be skipped, strategy still matches
        var result = FeatureFlagEvaluator.Evaluate(flag, MakeContext(), EmptySegments);
        Assert.True(result.Enabled);
    }

    // ═══════════════════════════════════════════════════════════════
    //  13. Rollout percentage
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public void Rollout100_AlwaysMatches()
    {
        var flag = MakeFlag(
            isEnabled: true,
            strategies: [MakeStrategy(parameters: new() { Rollout = 100 })]);

        // Should always pass regardless of userId
        for (var i = 0; i < 20; i++)
        {
            var result = FeatureFlagEvaluator.Evaluate(flag, MakeContext(userId: $"user-{i}"), EmptySegments);
            Assert.True(result.Enabled);
        }
    }

    [Fact]
    public void Rollout0_NeverMatches()
    {
        var flag = MakeFlag(
            isEnabled: true,
            strategies: [MakeStrategy(parameters: new() { Rollout = 0 })]);

        for (var i = 0; i < 20; i++)
        {
            var result = FeatureFlagEvaluator.Evaluate(flag, MakeContext(userId: $"user-{i}"), EmptySegments);
            Assert.False(result.Enabled);
        }
    }

    [Fact]
    public void Rollout_IsStickyByUserId()
    {
        var flag = MakeFlag(
            isEnabled: true,
            strategies: [MakeStrategy(parameters: new() { Rollout = 50, Stickiness = "userId" })]);
        var ctx = MakeContext(userId: "consistent-user");

        // Same userId should always produce same result
        var firstResult = FeatureFlagEvaluator.Evaluate(flag, ctx, EmptySegments).Enabled;
        for (var i = 0; i < 10; i++)
        {
            Assert.Equal(firstResult, FeatureFlagEvaluator.Evaluate(flag, ctx, EmptySegments).Enabled);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  14. Variant selection
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public void VariantSelection_NoVariants_UsesDefaultEnabledValue()
    {
        var flag = MakeFlag(
            isEnabled: true,
            valueType: "string",
            enabledValue: "default-on");

        var result = FeatureFlagEvaluator.Evaluate(flag, MakeContext(), EmptySegments);
        Assert.Equal("default-on", result.Variant.Value);
        Assert.Equal(VariantSource.FlagDefaultEnabled, result.Variant.Name);
    }

    [Fact]
    public void VariantSelection_SingleVariant100Weight_AlwaysSelected()
    {
        var flag = MakeFlag(
            isEnabled: true,
            valueType: "string",
            enabledValue: "default",
            variants:
            [
                new() { Name = "variant-a", Weight = 100, Value = "value-a", ValueType = "string" },
            ]);

        for (var i = 0; i < 20; i++)
        {
            var result = FeatureFlagEvaluator.Evaluate(flag, MakeContext(userId: $"user-{i}"), EmptySegments);
            Assert.Equal("variant-a", result.Variant.Name);
            Assert.Equal("value-a", result.Variant.Value);
        }
    }

    [Fact]
    public void VariantSelection_MultipleVariants_DistributionWorks()
    {
        var flag = MakeFlag(
            isEnabled: true,
            valueType: "string",
            enabledValue: "default",
            variants:
            [
                new() { Name = "control", Weight = 50, Value = "control-val", ValueType = "string" },
                new() { Name = "experiment", Weight = 50, Value = "exp-val", ValueType = "string" },
            ]);

        var counts = new Dictionary<string, int> { ["control"] = 0, ["experiment"] = 0 };

        // Run many evaluations with different userIds
        for (var i = 0; i < 1000; i++)
        {
            var result = FeatureFlagEvaluator.Evaluate(flag, MakeContext(userId: $"user-{i}"), EmptySegments);
            counts[result.Variant.Name]++;
        }

        // Both variants should have been selected (distribution should be roughly 50/50)
        Assert.True(counts["control"] > 0, "Control variant should be selected at least once");
        Assert.True(counts["experiment"] > 0, "Experiment variant should be selected at least once");
        // Allow loose range (30-70%) for randomness
        Assert.InRange(counts["control"], 300, 700);
    }

    // ═══════════════════════════════════════════════════════════════
    //  15. Value type coercion (GetFallbackValue)
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public void GetFallbackValue_NullString_ReturnsEmptyString()
    {
        Assert.Equal("", FeatureFlagEvaluator.GetFallbackValue(null, "string"));
    }

    [Fact]
    public void GetFallbackValue_NullBoolean_ReturnsFalse()
    {
        Assert.Equal(false, FeatureFlagEvaluator.GetFallbackValue(null, "boolean"));
    }

    [Fact]
    public void GetFallbackValue_NullNumber_ReturnsZero()
    {
        Assert.Equal(0, FeatureFlagEvaluator.GetFallbackValue(null, "number"));
    }

    [Fact]
    public void GetFallbackValue_JsonElementString_ReturnsString()
    {
        var je = JsonDocument.Parse("\"hello\"").RootElement;
        Assert.Equal("hello", FeatureFlagEvaluator.GetFallbackValue(je, "string"));
    }

    [Fact]
    public void GetFallbackValue_JsonElementNumber_ReturnsDouble()
    {
        var je = JsonDocument.Parse("42.5").RootElement;
        Assert.Equal(42.5, FeatureFlagEvaluator.GetFallbackValue(je, "number"));
    }

    [Fact]
    public void GetFallbackValue_JsonElementBool_ReturnsBool()
    {
        var jeTrue = JsonDocument.Parse("true").RootElement;
        Assert.Equal(true, FeatureFlagEvaluator.GetFallbackValue(jeTrue, "boolean"));

        var jeFalse = JsonDocument.Parse("false").RootElement;
        Assert.Equal(false, FeatureFlagEvaluator.GetFallbackValue(jeFalse, "boolean"));
    }

    [Fact]
    public void GetFallbackValue_CoercesStringToNumber()
    {
        Assert.Equal(42.0, FeatureFlagEvaluator.GetFallbackValue("42", "number"));
    }

    [Fact]
    public void GetFallbackValue_CoercesBoolToString()
    {
        Assert.Equal("True", FeatureFlagEvaluator.GetFallbackValue(true, "string"));
    }

    // ═══════════════════════════════════════════════════════════════
    //  16. Array operators
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public void ArrEmpty_WhenNoProperty_ReturnsTrue()
    {
        var flag = MakeFlag(
            isEnabled: true,
            strategies: [MakeStrategy(constraints:
                [MakeConstraint("tags", "arr_empty")])]);

        Assert.True(FeatureFlagEvaluator.Evaluate(flag, MakeContext(), EmptySegments).Enabled);
    }

    [Fact]
    public void ArrEmpty_WithItems_ReturnsFalse()
    {
        var flag = MakeFlag(
            isEnabled: true,
            strategies: [MakeStrategy(constraints:
                [MakeConstraint("tags", "arr_empty")])]);

        var ctx = MakeContext(properties: new Dictionary<string, object?>
        {
            ["tags"] = new List<object> { "a", "b" },
        });

        Assert.False(FeatureFlagEvaluator.Evaluate(flag, ctx, EmptySegments).Enabled);
    }

    [Fact]
    public void ArrAny_MatchesOneValue()
    {
        var flag = MakeFlag(
            isEnabled: true,
            strategies: [MakeStrategy(constraints:
                [MakeConstraint("tags", "arr_any", values: ["vip", "premium"])])]);

        var ctx = MakeContext(properties: new Dictionary<string, object?>
        {
            ["tags"] = new List<object> { "basic", "vip" },
        });
        Assert.True(FeatureFlagEvaluator.Evaluate(flag, ctx, EmptySegments).Enabled);

        var ctx2 = MakeContext(properties: new Dictionary<string, object?>
        {
            ["tags"] = new List<object> { "basic", "standard" },
        });
        Assert.False(FeatureFlagEvaluator.Evaluate(flag, ctx2, EmptySegments).Enabled);
    }

    [Fact]
    public void ArrAll_RequiresAllValues()
    {
        var flag = MakeFlag(
            isEnabled: true,
            strategies: [MakeStrategy(constraints:
                [MakeConstraint("roles", "arr_all", values: ["admin", "editor"])])]);

        var ctx = MakeContext(properties: new Dictionary<string, object?>
        {
            ["roles"] = new List<object> { "admin", "editor", "viewer" },
        });
        Assert.True(FeatureFlagEvaluator.Evaluate(flag, ctx, EmptySegments).Enabled);

        var ctx2 = MakeContext(properties: new Dictionary<string, object?>
        {
            ["roles"] = new List<object> { "admin", "viewer" },
        });
        Assert.False(FeatureFlagEvaluator.Evaluate(flag, ctx2, EmptySegments).Enabled);
    }

    // ═══════════════════════════════════════════════════════════════
    //  17. Multiple constraints — ALL must pass
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public void MultipleConstraints_AllMustPass()
    {
        var flag = MakeFlag(
            isEnabled: true,
            strategies: [MakeStrategy(constraints:
            [
                MakeConstraint("userId", "str_eq", "admin"),
                MakeConstraint("appVersion", "semver_gte", "2.0.0"),
            ])]);

        // Both pass
        Assert.True(FeatureFlagEvaluator.Evaluate(flag,
            MakeContext(userId: "admin", appVersion: "2.1.0"), EmptySegments).Enabled);

        // First fails
        Assert.False(FeatureFlagEvaluator.Evaluate(flag,
            MakeContext(userId: "guest", appVersion: "2.1.0"), EmptySegments).Enabled);

        // Second fails
        Assert.False(FeatureFlagEvaluator.Evaluate(flag,
            MakeContext(userId: "admin", appVersion: "1.9.0"), EmptySegments).Enabled);
    }

    // ═══════════════════════════════════════════════════════════════
    //  18. Value type in result
    // ═══════════════════════════════════════════════════════════════

    [Theory]
    [InlineData("string", "hello", "hello")]
    [InlineData("number", 42, 42.0)]
    [InlineData("boolean", true, true)]
    public void ResultVariant_HasCorrectValueAndType(string valueType, object enabledValue, object expectedValue)
    {
        var flag = MakeFlag(isEnabled: true, valueType: valueType, enabledValue: enabledValue);
        var result = FeatureFlagEvaluator.Evaluate(flag, MakeContext(), EmptySegments);

        Assert.Equal(expectedValue, result.Variant.Value);
        Assert.Equal(valueType, result.Variant.ValueType);
    }

    // ═══════════════════════════════════════════════════════════════
    //  19. Edge cases
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public void UnknownOperator_ReturnsFalse()
    {
        var flag = MakeFlag(
            isEnabled: true,
            strategies: [MakeStrategy(constraints:
                [MakeConstraint("userId", "unknown_operator", "test")])]);

        Assert.False(FeatureFlagEvaluator.Evaluate(flag, MakeContext(userId: "test"), EmptySegments).Enabled);
    }

    [Fact]
    public void InvalidRegexPattern_ReturnsFalse()
    {
        var flag = MakeFlag(
            isEnabled: true,
            strategies: [MakeStrategy(constraints:
                [MakeConstraint("userId", "str_regex", "[invalid")])]);

        Assert.False(FeatureFlagEvaluator.Evaluate(flag, MakeContext(userId: "test"), EmptySegments).Enabled);
    }

    [Fact]
    public void ContextFields_AllMappedCorrectly()
    {
        var fields = new (string contextName, Func<EvaluationContext, EvaluationContext> setVal)[]
        {
            ("userId", ctx => { ctx.UserId = "test"; return ctx; }),
            ("sessionId", ctx => { ctx.SessionId = "test"; return ctx; }),
            ("appName", ctx => { ctx.AppName = "test"; return ctx; }),
            ("appVersion", ctx => { ctx.AppVersion = "test"; return ctx; }),
            ("remoteAddress", ctx => { ctx.RemoteAddress = "test"; return ctx; }),
        };

        foreach (var (contextName, setVal) in fields)
        {
            var flag = MakeFlag(
                isEnabled: true,
                strategies: [MakeStrategy(constraints:
                    [MakeConstraint(contextName, "str_eq", "test")])]);

            var ctx = setVal(MakeContext());
            var result = FeatureFlagEvaluator.Evaluate(flag, ctx, EmptySegments);
            Assert.True(result.Enabled, $"Context field '{contextName}' should be accessible");
        }
    }
}
