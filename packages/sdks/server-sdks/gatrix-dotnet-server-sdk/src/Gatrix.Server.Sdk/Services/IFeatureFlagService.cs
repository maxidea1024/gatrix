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
    EvaluationResult Evaluate(string flagName, EvaluationContext? context = null, string? environmentId = null);

    // ── IsEnabled ─────────────────────────────────────────────────────

    bool IsEnabled(string flagName, bool fallback, EvaluationContext? context = null, string? environmentId = null);

    // ── Variant (returns variant name only) ────────────────────────────

    /// <summary>Returns the matched variant name, or fallback if flag not found.</summary>
    string Variation(string flagName, string fallback = "", EvaluationContext? context = null, string? environmentId = null);

    // ── Typed Variations ──────────────────────────────────────────────

    string StringVariation(string flagName, string fallback, EvaluationContext? context = null, string? environmentId = null);
    int IntVariation(string flagName, int fallback, EvaluationContext? context = null, string? environmentId = null);
    long LongVariation(string flagName, long fallback, EvaluationContext? context = null, string? environmentId = null);
    float FloatVariation(string flagName, float fallback, EvaluationContext? context = null, string? environmentId = null);
    double DoubleVariation(string flagName, double fallback, EvaluationContext? context = null, string? environmentId = null);
    bool BoolVariation(string flagName, bool fallback, EvaluationContext? context = null, string? environmentId = null);
    T? JsonVariation<T>(string flagName, T? fallback = default, EvaluationContext? context = null, string? environmentId = null);

    // ── *Details — returns value + evaluation metadata ─────────────────

    EvaluationDetail<string> StringVariationDetails(string flagName, string fallback, EvaluationContext? context = null, string? environmentId = null);
    EvaluationDetail<int> IntVariationDetails(string flagName, int fallback, EvaluationContext? context = null, string? environmentId = null);
    EvaluationDetail<long> LongVariationDetails(string flagName, long fallback, EvaluationContext? context = null, string? environmentId = null);
    EvaluationDetail<float> FloatVariationDetails(string flagName, float fallback, EvaluationContext? context = null, string? environmentId = null);
    EvaluationDetail<double> DoubleVariationDetails(string flagName, double fallback, EvaluationContext? context = null, string? environmentId = null);
    EvaluationDetail<bool> BoolVariationDetails(string flagName, bool fallback, EvaluationContext? context = null, string? environmentId = null);

    // ── Data Refresh ──────────────────────────────────────────────────

    /// <summary>Initialize the service by loading definitions from local storage.</summary>
    Task InitializeAsync(string environmentId, CancellationToken ct = default);

    /// <summary>Fetch flag and segment definitions from API and update local cache.</summary>
    Task FetchAsync(string environmentId, CancellationToken ct = default);

    // ── *OrThrow — throws FeatureFlagException if not found / no value ─

    string StringVariationOrThrow(string flagName, EvaluationContext? context = null, string? environmentId = null);
    int IntVariationOrThrow(string flagName, EvaluationContext? context = null, string? environmentId = null);
    long LongVariationOrThrow(string flagName, EvaluationContext? context = null, string? environmentId = null);
    float FloatVariationOrThrow(string flagName, EvaluationContext? context = null, string? environmentId = null);
    double DoubleVariationOrThrow(string flagName, EvaluationContext? context = null, string? environmentId = null);
    bool BoolVariationOrThrow(string flagName, EvaluationContext? context = null, string? environmentId = null);
    T JsonVariationOrThrow<T>(string flagName, EvaluationContext? context = null, string? environmentId = null);
}
