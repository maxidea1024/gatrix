using Gatrix.Server.Sdk.Models;

namespace Gatrix.Server.Sdk.Services;

/// <summary>
/// Feature flag evaluation service.
/// All evaluations are performed locally using cached flag definitions.
/// context and environment are optional — omit for single-env mode with no per-call context.
/// </summary>
public interface IFeatureFlagService
{
    // ── Core evaluation ───────────────────────────────────────────────

    /// <summary>Evaluate a flag and return the full result.</summary>
    EvaluationResult Evaluate(string flagName, EvaluationContext? context = null, string? environment = null);

    // ── IsEnabled ─────────────────────────────────────────────────────

    bool IsEnabled(string flagName, bool fallback, EvaluationContext? context = null, string? environment = null);

    // ── Variant (returns variant name only) ────────────────────────────

    /// <summary>Returns the matched variant name, or fallback if flag not found.</summary>
    string Variation(string flagName, string fallback = "", EvaluationContext? context = null, string? environment = null);

    // ── Typed Variations ──────────────────────────────────────────────

    string StringVariation(string flagName, string fallback, EvaluationContext? context = null, string? environment = null);
    int IntVariation(string flagName, int fallback, EvaluationContext? context = null, string? environment = null);
    long LongVariation(string flagName, long fallback, EvaluationContext? context = null, string? environment = null);
    float FloatVariation(string flagName, float fallback, EvaluationContext? context = null, string? environment = null);
    double DoubleVariation(string flagName, double fallback, EvaluationContext? context = null, string? environment = null);
    bool BoolVariation(string flagName, bool fallback, EvaluationContext? context = null, string? environment = null);
    T? JsonVariation<T>(string flagName, T? fallback = default, EvaluationContext? context = null, string? environment = null);

    // ── *Details — returns value + evaluation metadata ─────────────────

    EvaluationDetail<string> StringVariationDetails(string flagName, string fallback, EvaluationContext? context = null, string? environment = null);
    EvaluationDetail<int> IntVariationDetails(string flagName, int fallback, EvaluationContext? context = null, string? environment = null);
    EvaluationDetail<long> LongVariationDetails(string flagName, long fallback, EvaluationContext? context = null, string? environment = null);
    EvaluationDetail<float> FloatVariationDetails(string flagName, float fallback, EvaluationContext? context = null, string? environment = null);
    EvaluationDetail<double> DoubleVariationDetails(string flagName, double fallback, EvaluationContext? context = null, string? environment = null);
    EvaluationDetail<bool> BoolVariationDetails(string flagName, bool fallback, EvaluationContext? context = null, string? environment = null);

    // ── Data Refresh ──────────────────────────────────────────────────

    /// <summary>Initialize the service by loading definitions from local storage.</summary>
    Task InitializeAsync(string environment, CancellationToken ct = default);

    /// <summary>Fetch flag and segment definitions from API and update local cache.</summary>
    Task FetchAsync(string environment, CancellationToken ct = default);

    // ── *OrThrow — throws FeatureFlagException if not found / no value ─

    string StringVariationOrThrow(string flagName, EvaluationContext? context = null, string? environment = null);
    int IntVariationOrThrow(string flagName, EvaluationContext? context = null, string? environment = null);
    long LongVariationOrThrow(string flagName, EvaluationContext? context = null, string? environment = null);
    float FloatVariationOrThrow(string flagName, EvaluationContext? context = null, string? environment = null);
    double DoubleVariationOrThrow(string flagName, EvaluationContext? context = null, string? environment = null);
    bool BoolVariationOrThrow(string flagName, EvaluationContext? context = null, string? environment = null);
    T JsonVariationOrThrow<T>(string flagName, EvaluationContext? context = null, string? environment = null);
}
