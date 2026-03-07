using System.Collections.Concurrent;
using Gatrix.Server.Sdk.Client;
using Gatrix.Server.Sdk.Models;
using Gatrix.Server.Sdk.Options;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Gatrix.Server.Sdk.Services;

/// <summary>
/// Flag analytics metrics — buffers evaluation events and flushes periodically.
/// Matches server-sdk FeatureFlagService metrics pattern.
/// </summary>
public class FlagMetricsService : IDisposable
{
    private readonly GatrixApiClient _apiClient;
    private readonly GatrixSdkOptions _options;
    private readonly ILogger<FlagMetricsService> _logger;
    private readonly ConcurrentDictionary<string, FlagBucketEntry> _bucket = new();
    private readonly ConcurrentDictionary<string, int> _missingFlags = new();
    private Timer? _flushTimer;
    private DateTime _bucketStart = DateTime.UtcNow;
    private bool _disposed;

    public FlagMetricsService(
        GatrixApiClient apiClient,
        IOptions<GatrixSdkOptions> options,
        ILogger<FlagMetricsService> logger)
    {
        _apiClient = apiClient;
        _options = options.Value;
        _logger = logger;
    }

    /// <summary>Start periodic flushing (default: 60s).</summary>
    public void Start(int intervalMs = 60_000)
    {
        _flushTimer = new Timer(async _ => await FlushSafe(), null, intervalMs, intervalMs);
    }

    /// <summary>Record a flag evaluation for metrics.</summary>
    public void RecordEvaluation(string flagName, bool enabled, string? variantName)
    {
        var entry = _bucket.GetOrAdd(flagName, _ => new FlagBucketEntry());
        if (enabled)
            Interlocked.Increment(ref entry.Yes);
        else
            Interlocked.Increment(ref entry.No);

        if (variantName is not null)
            entry.Variants.AddOrUpdate(variantName, 1, (_, count) => count + 1);
    }

    /// <summary>Record a missing flag access.</summary>
    public void RecordMissing(string flagName)
    {
        _missingFlags.AddOrUpdate(flagName, 1, (_, count) => count + 1);
    }

    /// <summary>Flush buffered metrics to the backend.</summary>
    public async Task FlushAsync(CancellationToken ct = default)
    {
        if (_bucket.IsEmpty && _missingFlags.IsEmpty) return;

        var bucketStop = DateTime.UtcNow;
        var bucketStart = _bucketStart;
        _bucketStart = bucketStop;

        // Snapshot and clear
        var flagsPayload = new Dictionary<string, object>();
        foreach (var kvp in _bucket)
        {
            if (_bucket.TryRemove(kvp.Key, out var entry))
            {
                flagsPayload[kvp.Key] = new
                {
                    yes = entry.Yes,
                    no = entry.No,
                    variants = entry.Variants.ToDictionary(v => v.Key, v => v.Value),
                };
            }
        }

        var missingPayload = new Dictionary<string, int>();
        foreach (var kvp in _missingFlags)
        {
            if (_missingFlags.TryRemove(kvp.Key, out var count))
                missingPayload[kvp.Key] = count;
        }

        var payload = new
        {
            appName = _options.ApplicationName,
            sdkVersion = SdkInfo.FullName,
            bucket = new
            {
                start = bucketStart.ToString("o"),
                stop = bucketStop.ToString("o"),
                flags = flagsPayload,
                missing = missingPayload,
            },
        };

        await _apiClient.PostAsync<object>(
            "/api/v1/client/features/metrics", payload, ct);

        _logger.LogDebug("Flag metrics flushed: {FlagCount} flags, {MissingCount} missing",
            flagsPayload.Count, missingPayload.Count);
    }

    private async Task FlushSafe()
    {
        try { await FlushAsync(); }
        catch (Exception ex) { _logger.LogError(ex, "Flag metrics flush failed"); }
    }

    public void Dispose()
    {
        if (_disposed) return;
        _flushTimer?.Dispose();
        _disposed = true;
        GC.SuppressFinalize(this);
    }

    private class FlagBucketEntry
    {
        public int Yes;
        public int No;
        public ConcurrentDictionary<string, int> Variants { get; } = new();
    }
}
