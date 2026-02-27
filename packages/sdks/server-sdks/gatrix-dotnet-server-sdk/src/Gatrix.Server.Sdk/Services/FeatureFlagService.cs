using System.Collections.Concurrent;
using System.Globalization;
using System.Text.Json;
using Gatrix.Server.Sdk.Cache;
using Gatrix.Server.Sdk.Client;
using Gatrix.Server.Sdk.Context;
using Gatrix.Server.Sdk.Evaluation;
using Gatrix.Server.Sdk.Exceptions;
using Gatrix.Server.Sdk.Models;
using Gatrix.Server.Sdk.Options;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Gatrix.Server.Sdk.Services;

/// <summary>
/// Feature flag service implementation.
/// Evaluates flags locally using cached definitions and the shared evaluator.
/// All typed variation methods: evaluate ??extract ??convert ??fallback.
/// </summary>
public class FeatureFlagService : IFeatureFlagService
{
    private readonly FlagDefinitionCache _cache;
    private readonly GatrixApiClient _apiClient;
    private readonly GatrixAmbientContext _ambientContext;
    private readonly GatrixSdkOptions _options;
    private readonly ILogger<FeatureFlagService> _logger;
    private readonly ICacheStorageProvider? _storage;

    private readonly ConcurrentDictionary<string, string> _etagsByEnv = new(StringComparer.OrdinalIgnoreCase);

    // Static context merged into every evaluation
    private EvaluationContext _staticContext = new();

    public FeatureFlagService(
        FlagDefinitionCache cache,
        GatrixApiClient apiClient,
        GatrixAmbientContext ambientContext,
        IOptions<GatrixSdkOptions> options,
        ILogger<FeatureFlagService> logger,
        ICacheStorageProvider? storage = null)
    {
        _cache = cache;
        _apiClient = apiClient;
        _ambientContext = ambientContext;
        _options = options.Value;
        _logger = logger;
        _storage = storage;

        // Initialize static context from options if configured
        if (_options.Features.StaticContext is { Count: > 0 })
        {
            _staticContext = new EvaluationContext
            {
                Properties = _options.Features.StaticContext
                    .ToDictionary(
                        kvp => kvp.Key,
                        kvp => (object?)kvp.Value,
                        StringComparer.OrdinalIgnoreCase)
            };
        }
    }

    /// <summary>Set static context applied to all evaluations.</summary>
    public void SetStaticContext(EvaluationContext context) => _staticContext = context;

    /// <summary>Initialize the service by loading definitions from local storage.</summary>
    public async Task InitializeAsync(string environment, CancellationToken ct = default)
    {
        if (_storage == null) return;

        var flagsKey = $"FeatureFlags_{environment}_flags";
        var segmentsKey = $"FeatureFlags_{environment}_segments";
        var etagKey = $"FeatureFlags_{environment}_etag";

        try
        {
            var flagsJson = await _storage.GetAsync(flagsKey, ct);
            var segmentsJson = await _storage.GetAsync(segmentsKey, ct);

            if (!string.IsNullOrEmpty(flagsJson))
            {
                var flags = JsonSerializer.Deserialize<List<FeatureFlag>>(flagsJson);
                var segments = !string.IsNullOrEmpty(segmentsJson)
                    ? JsonSerializer.Deserialize<List<FeatureSegment>>(segmentsJson)
                    : [];

                if (flags != null)
                {
                    _cache.Update(flags, segments ?? [], environment);
                    _logger.LogDebug("Loaded {FlagCount} flags from local storage for {Environment}",
                        flags.Count, environment);
                }
            }

            var cachedEtag = await _storage.GetAsync(etagKey, ct);
            if (!string.IsNullOrEmpty(cachedEtag))
            {
                _etagsByEnv[environment] = cachedEtag;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to load feature flags from local storage for {Environment}", environment);
        }
    }

    /// <summary>Fetch flag and segment definitions from API and update local cache (remote + local).</summary>
    public async Task FetchAsync(string environment, CancellationToken ct = default)
    {
        try
        {
            _etagsByEnv.TryGetValue(environment, out var etag);

            var response = await _apiClient.GetAsync<FeatureFlagsApiResponse>(
                $"/api/v1/server/{Uri.EscapeDataString(environment)}/features", etag, ct);

            if (!response.Success)
            {
                _logger.LogWarning("Failed to fetch feature flags for {Environment}", environment);
                return;
            }

            if (response.NotModified)
            {
                _logger.LogDebug("Feature flags for {Environment} not modified (304)", environment);
                return;
            }

            if (response.Data is not null)
            {
                _cache.Update(response.Data.Flags, response.Data.Segments, environment);

                if (_storage != null)
                {
                    await _storage.SaveAsync($"FeatureFlags_{environment}_flags", JsonSerializer.Serialize(response.Data.Flags), ct);
                    await _storage.SaveAsync($"FeatureFlags_{environment}_segments", JsonSerializer.Serialize(response.Data.Segments), ct);
                }

                if (response.Etag != null)
                {
                    _etagsByEnv[environment] = response.Etag;
                    if (_storage != null)
                    {
                        await _storage.SaveAsync($"FeatureFlags_{environment}_etag", response.Etag, ct);
                    }
                }

                _logger.LogInformation("Feature flags cached: {FlagCount} flags, {SegmentCount} segments for {Environment}",
                    response.Data.Flags.Count, response.Data.Segments.Count, environment);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch feature flags for {Environment}", environment);
        }
    }

    /// <summary>Resolve environment: use explicit value, or fall back to configured default.</summary>
    private string? ResolveEnvironment(string? environment) =>
        environment ?? (_options.IsMultiEnvironmentMode ? null : _options.Environment);

    /// <summary>Fetch a single flag by name from the API and update cache.
    /// Since the API doesn't support single-flag fetch, does a full environment refresh.</summary>
    public async Task FetchSingleFlagAsync(string flagName, string environment, CancellationToken ct = default)
    {
        try
        {
            await FetchAsync(environment, ct);
            _logger.LogInformation("Updated single flag {FlagName} in {Environment} via full refresh", flagName, environment);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch single flag {FlagName} for {Environment}", flagName, environment);
        }
    }

    /// <summary>Get the underlying FlagDefinitionCache for direct cache operations.</summary>
    public FlagDefinitionCache GetCache() => _cache;

    // ══════════════════════════════════════════════════════════════
    //  Core Evaluation
    // ══════════════════════════════════════════════════════════════


    public EvaluationResult Evaluate(string flagName, EvaluationContext? context = null, string? environment = null)
    {
        var env = ResolveEnvironment(environment);

        // Multi-environment mode requires explicit environment
        if (env is null)
        {
            _logger.LogWarning("Cannot evaluate flag '{FlagName}': environment is required in multi-environment mode", flagName);
            return new EvaluationResult
            {
                Id = string.Empty,
                FlagName = flagName,
                Enabled = false,
                Reason = EvaluationReasons.NotFound,
                Variant = new Variant
                {
                    Name = ValueSource.Missing,
                    Weight = 100,
                    Enabled = false,
                    Value = null,
                    ValueType = "string",
                },
            };
        }

        var merged = ResolveContext(context);
        var flag = _cache.GetFlag(flagName, env);

        if (flag is null)
        {
            return new EvaluationResult
            {
                Id = string.Empty,
                FlagName = flagName,
                Enabled = false,
                Reason = EvaluationReasons.NotFound,
                Variant = new Variant
                {
                    Name = ValueSource.Missing,
                    Weight = 100,
                    Enabled = false,
                    Value = null,
                    ValueType = "string",
                },
            };
        }

        var segments = _cache.GetSegments();
        return FeatureFlagEvaluator.Evaluate(flag, merged, segments);
    }

    // ?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═
    //  IsEnabled
    // ?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═

    public bool IsEnabled(string flagName, bool fallback, EvaluationContext? context = null, string? environment = null)
    {
        var result = Evaluate(flagName, context, environment);
        return result.Reason == EvaluationReasons.NotFound ? fallback : result.Enabled;
    }

    // ?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═
    //  Variant (name only)
    // ?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═

    public string Variation(string flagName, string fallback = "", EvaluationContext? context = null, string? environment = null)
    {
        var result = Evaluate(flagName, context, environment);
        if (result.Reason == EvaluationReasons.NotFound) return fallback;
        return result.Variant.Name ?? fallback;
    }

    // ?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═
    //  Typed Variations
    // ?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═

    public string StringVariation(string flagName, string fallback, EvaluationContext? context = null, string? environment = null)
    {
        var result = Evaluate(flagName, context, environment);
        if (result.Reason == EvaluationReasons.NotFound || IsTypeMismatch(result, "string")) return fallback;
        return ExtractString(result.Variant) ?? fallback;
    }

    public int IntVariation(string flagName, int fallback, EvaluationContext? context = null, string? environment = null)
    {
        var result = Evaluate(flagName, context, environment);
        if (result.Reason == EvaluationReasons.NotFound || IsTypeMismatch(result, "number")) return fallback;
        var str = ExtractString(result.Variant);
        return str is not null && int.TryParse(str, CultureInfo.InvariantCulture, out var v) ? v : fallback;
    }

    public long LongVariation(string flagName, long fallback, EvaluationContext? context = null, string? environment = null)
    {
        var result = Evaluate(flagName, context, environment);
        if (result.Reason == EvaluationReasons.NotFound || IsTypeMismatch(result, "number")) return fallback;
        var str = ExtractString(result.Variant);
        return str is not null && long.TryParse(str, CultureInfo.InvariantCulture, out var v) ? v : fallback;
    }

    public float FloatVariation(string flagName, float fallback, EvaluationContext? context = null, string? environment = null)
    {
        var result = Evaluate(flagName, context, environment);
        if (result.Reason == EvaluationReasons.NotFound || IsTypeMismatch(result, "number")) return fallback;
        var str = ExtractString(result.Variant);
        return str is not null && float.TryParse(str, CultureInfo.InvariantCulture, out var v) ? v : fallback;
    }

    public double DoubleVariation(string flagName, double fallback, EvaluationContext? context = null, string? environment = null)
    {
        var result = Evaluate(flagName, context, environment);
        if (result.Reason == EvaluationReasons.NotFound || IsTypeMismatch(result, "number")) return fallback;
        var str = ExtractString(result.Variant);
        return str is not null && double.TryParse(str, CultureInfo.InvariantCulture, out var v) ? v : fallback;
    }

    public bool BoolVariation(string flagName, bool fallback, EvaluationContext? context = null, string? environment = null)
    {
        var result = Evaluate(flagName, context, environment);
        if (result.Reason == EvaluationReasons.NotFound || IsTypeMismatch(result, "boolean")) return fallback;
        var str = ExtractString(result.Variant);
        if (str is null) return fallback;
        if (bool.TryParse(str, out var v)) return v;
        // Also handle "1"/"0" style booleans
        if (str == "1") return true;
        if (str == "0") return false;
        return fallback;
    }

    public T? JsonVariation<T>(string flagName, T? fallback = default, EvaluationContext? context = null, string? environment = null)
    {
        var result = Evaluate(flagName, context, environment);
        if (result.Reason == EvaluationReasons.NotFound || IsTypeMismatch(result, "json") || result.Variant.Value is null)
            return fallback;

        try
        {
            if (result.Variant.Value is JsonElement jsonElement)
                return jsonElement.Deserialize<T>();

            var json = result.Variant.Value.ToString();
            return json is not null ? JsonSerializer.Deserialize<T>(json) : fallback;
        }
        catch
        {
            return fallback;
        }
    }

    // ?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═
    //  *Details ??value + evaluation metadata
    // ?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═

    public EvaluationDetail<string> StringVariationDetails(string flagName, string fallback, EvaluationContext? context = null, string? environment = null)
    {
        var result = Evaluate(flagName, context, environment);
        if (IsTypeMismatch(result, "string")) return MakeTypeMismatchDetail(result, fallback);
        var value = result.Reason == EvaluationReasons.NotFound ? fallback : ExtractString(result.Variant) ?? fallback;
        return MakeDetail(result, value);
    }

    public EvaluationDetail<int> IntVariationDetails(string flagName, int fallback, EvaluationContext? context = null, string? environment = null)
    {
        var result = Evaluate(flagName, context, environment);
        if (IsTypeMismatch(result, "number")) return MakeTypeMismatchDetail(result, fallback);
        var str = result.Reason == EvaluationReasons.NotFound ? null : ExtractString(result.Variant);
        var value = str is not null && int.TryParse(str, CultureInfo.InvariantCulture, out var v) ? v : fallback;
        return MakeDetail(result, value);
    }

    public EvaluationDetail<long> LongVariationDetails(string flagName, long fallback, EvaluationContext? context = null, string? environment = null)
    {
        var result = Evaluate(flagName, context, environment);
        if (IsTypeMismatch(result, "number")) return MakeTypeMismatchDetail(result, fallback);
        var str = result.Reason == EvaluationReasons.NotFound ? null : ExtractString(result.Variant);
        var value = str is not null && long.TryParse(str, CultureInfo.InvariantCulture, out var v) ? v : fallback;
        return MakeDetail(result, value);
    }

    public EvaluationDetail<float> FloatVariationDetails(string flagName, float fallback, EvaluationContext? context = null, string? environment = null)
    {
        var result = Evaluate(flagName, context, environment);
        if (IsTypeMismatch(result, "number")) return MakeTypeMismatchDetail(result, fallback);
        var str = result.Reason == EvaluationReasons.NotFound ? null : ExtractString(result.Variant);
        var value = str is not null && float.TryParse(str, CultureInfo.InvariantCulture, out var v) ? v : fallback;
        return MakeDetail(result, value);
    }

    public EvaluationDetail<double> DoubleVariationDetails(string flagName, double fallback, EvaluationContext? context = null, string? environment = null)
    {
        var result = Evaluate(flagName, context, environment);
        if (IsTypeMismatch(result, "number")) return MakeTypeMismatchDetail(result, fallback);
        var str = result.Reason == EvaluationReasons.NotFound ? null : ExtractString(result.Variant);
        var value = str is not null && double.TryParse(str, CultureInfo.InvariantCulture, out var v) ? v : fallback;
        return MakeDetail(result, value);
    }

    public EvaluationDetail<bool> BoolVariationDetails(string flagName, bool fallback, EvaluationContext? context = null, string? environment = null)
    {
        var result = Evaluate(flagName, context, environment);
        if (result.Reason == EvaluationReasons.NotFound) return MakeDetail(result, fallback);
        if (IsTypeMismatch(result, "boolean")) return MakeTypeMismatchDetail(result, fallback);
        var str = ExtractString(result.Variant);
        bool value = fallback;
        if (str is not null)
        {
            if (bool.TryParse(str, out var v)) value = v;
            else if (str == "1") value = true;
            else if (str == "0") value = false;
        }
        return MakeDetail(result, value);
    }

    // ?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═
    //  *OrThrow ??throws FeatureFlagException on failure
    // ?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═

    public string StringVariationOrThrow(string flagName, EvaluationContext? context = null, string? environment = null)
    {
        var result = EvaluateOrThrow(flagName, context, environment);
        return ExtractStringOrThrow(result, flagName);
    }

    public int IntVariationOrThrow(string flagName, EvaluationContext? context = null, string? environment = null)
    {
        var result = EvaluateOrThrow(flagName, context, environment);
        var str = ExtractStringOrThrow(result, flagName);
        return int.TryParse(str, CultureInfo.InvariantCulture, out var v)
            ? v
            : throw new FeatureFlagException(FeatureFlagErrorCode.InvalidValueType,
                $"Flag '{flagName}' variant value is not a valid int", flagName);
    }

    public long LongVariationOrThrow(string flagName, EvaluationContext? context = null, string? environment = null)
    {
        var result = EvaluateOrThrow(flagName, context, environment);
        var str = ExtractStringOrThrow(result, flagName);
        return long.TryParse(str, CultureInfo.InvariantCulture, out var v)
            ? v
            : throw new FeatureFlagException(FeatureFlagErrorCode.InvalidValueType,
                $"Flag '{flagName}' variant value is not a valid long", flagName);
    }

    public float FloatVariationOrThrow(string flagName, EvaluationContext? context = null, string? environment = null)
    {
        var result = EvaluateOrThrow(flagName, context, environment);
        var str = ExtractStringOrThrow(result, flagName);
        return float.TryParse(str, CultureInfo.InvariantCulture, out var v)
            ? v
            : throw new FeatureFlagException(FeatureFlagErrorCode.InvalidValueType,
                $"Flag '{flagName}' variant value is not a valid float", flagName);
    }

    public double DoubleVariationOrThrow(string flagName, EvaluationContext? context = null, string? environment = null)
    {
        var result = EvaluateOrThrow(flagName, context, environment);
        var str = ExtractStringOrThrow(result, flagName);
        return double.TryParse(str, CultureInfo.InvariantCulture, out var v)
            ? v
            : throw new FeatureFlagException(FeatureFlagErrorCode.InvalidValueType,
                $"Flag '{flagName}' variant value is not a valid double", flagName);
    }

    public bool BoolVariationOrThrow(string flagName, EvaluationContext? context = null, string? environment = null)
    {
        var result = EvaluateOrThrow(flagName, context, environment);
        var str = ExtractStringOrThrow(result, flagName);
        if (bool.TryParse(str, out var v)) return v;
        if (str == "1") return true;
        if (str == "0") return false;
        throw new FeatureFlagException(FeatureFlagErrorCode.InvalidValueType,
            $"Flag '{flagName}' variant value is not a valid bool", flagName);
    }

    public T JsonVariationOrThrow<T>(string flagName, EvaluationContext? context = null, string? environment = null)
    {
        var result = EvaluateOrThrow(flagName, context, environment);
        if (result.Variant.Value is null)
            throw new FeatureFlagException(FeatureFlagErrorCode.NoValue,
                $"Flag '{flagName}' has no variant value", flagName);

        try
        {
            if (result.Variant.Value is JsonElement je)
                return je.Deserialize<T>()!;

            var json = result.Variant.Value.ToString();
            return JsonSerializer.Deserialize<T>(json!)!;
        }
        catch (JsonException)
        {
            throw new FeatureFlagException(FeatureFlagErrorCode.InvalidValueType,
                $"Flag '{flagName}' variant value is not valid JSON for type {typeof(T).Name}", flagName);
        }
    }

    // ?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═
    //  Helpers
    // ?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═

    private EvaluationContext ResolveContext(EvaluationContext? perCall)
    {
        var baseContext = _staticContext.MergeWith(_ambientContext.CurrentContext);
        return baseContext.MergeWith(perCall);
    }

    private static string? ExtractString(Variant variant)
    {
        if (variant.Value is null) return null;
        if (variant.Value is JsonElement je)
            return je.ValueKind == JsonValueKind.String ? je.GetString() : je.GetRawText();
        return variant.Value.ToString();
    }

    private EvaluationResult EvaluateOrThrow(string flagName, EvaluationContext? context = null, string? environment = null)
    {
        var result = Evaluate(flagName, context, environment);
        if (result.Reason == EvaluationReasons.NotFound)
            throw new FeatureFlagException(FeatureFlagErrorCode.FlagNotFound,
                $"Feature flag '{flagName}' not found", flagName);
        return result;
    }

    private static string ExtractStringOrThrow(EvaluationResult result, string flagName)
    {
        if (result.Variant.Value is null)
            throw new FeatureFlagException(FeatureFlagErrorCode.NoValue,
                $"Flag '{flagName}' has no variant value", flagName);
        return ExtractString(result.Variant) ?? throw new FeatureFlagException(
            FeatureFlagErrorCode.NoValue, $"Flag '{flagName}' variant value is null", flagName);
    }

    /// <summary>Check if the result variant type matches the expected type.</summary>
    private static bool IsTypeMismatch(EvaluationResult result, string expectedType)
    {
        if (result.Reason == EvaluationReasons.NotFound) return false;
        var actualType = result.Variant.ValueType?.ToLowerInvariant();
        if (actualType is null) return false;
        return actualType != expectedType;
    }

    private static EvaluationDetail<T> MakeTypeMismatchDetail<T>(EvaluationResult result, T fallback)
    {
        return new EvaluationDetail<T>
        {
            FlagName = result.FlagName,
            Value = fallback,
            Reason = result.Reason,
            VariantName = ValueSource.TypeMismatch,
        };
    }
    private static EvaluationDetail<T> MakeDetail<T>(EvaluationResult result, T value)
    {
        return new EvaluationDetail<T>
        {
            FlagName = result.FlagName,
            Value = value,
            Reason = result.Reason,
            VariantName = result.Variant.Name,
        };
    }
}

