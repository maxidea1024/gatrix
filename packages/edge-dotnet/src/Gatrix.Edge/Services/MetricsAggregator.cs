using System.Collections.Concurrent;
using System.Net.Http.Json;
using System.Text.Json;
using Gatrix.Edge.Options;
using Microsoft.Extensions.Options;

namespace Gatrix.Edge.Services;

/// <summary>
/// Buffers and aggregates metrics from client/server SDKs before flushing to backend.
/// Reduces backend load by collapsing high-frequency requests from multiple SDK instances.
/// </summary>
public class MetricsAggregator : IHostedService, IDisposable
{
    private readonly ConcurrentDictionary<string, ClientMetricBucket> _clientBuffers = new();
    private readonly ConcurrentDictionary<string, ServerMetricBuffer> _serverBuffers = new();
    private readonly ConcurrentDictionary<string, ServerUnknownBuffer> _serverUnknownBuffers = new();
    private readonly EdgeOptions _options;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<MetricsAggregator> _logger;
    private Timer? _flushTimer;

    public MetricsAggregator(
        IOptions<EdgeOptions> options,
        IHttpClientFactory httpClientFactory,
        ILogger<MetricsAggregator> logger)
    {
        _options = options.Value;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        _flushTimer = new Timer(
            async _ => await FlushSafe(),
            state: null,
            dueTime: _options.MetricsFlushIntervalMs,
            period: _options.MetricsFlushIntervalMs);

        _logger.LogInformation("MetricsAggregator started (flush interval={Interval}ms)", _options.MetricsFlushIntervalMs);
        return Task.CompletedTask;
    }

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        _flushTimer?.Change(Timeout.Infinite, 0);
        await FlushAsync();
        _logger.LogInformation("MetricsAggregator shutdown complete");
    }

    /// <summary>
    /// Add client SDK metrics to buffer.
    /// </summary>
    public void AddClientMetrics(string environment, string appName, JsonElement bucket, string? sdkVersion)
    {
        var key = $"{environment}:{appName}";
        _clientBuffers.AddOrUpdate(key,
            _ => CreateClientBucket(bucket, sdkVersion),
            (_, existing) =>
            {
                MergeClientBucket(existing, bucket, sdkVersion);
                return existing;
            });
    }

    /// <summary>
    /// Add server SDK metrics to buffer.
    /// </summary>
    public void AddServerMetrics(string environment, string appName, JsonElement metrics, string? sdkVersion)
    {
        var key = $"{environment}:{appName}";
        _serverBuffers.AddOrUpdate(key,
            _ =>
            {
                var buf = new ServerMetricBuffer { SdkVersion = sdkVersion };
                MergeServerMetrics(buf, metrics);
                return buf;
            },
            (_, existing) =>
            {
                if (sdkVersion != null) existing.SdkVersion = sdkVersion;
                MergeServerMetrics(existing, metrics);
                return existing;
            });
    }

    /// <summary>
    /// Add server SDK unknown flag report to buffer.
    /// </summary>
    public void AddServerUnknownReport(string environment, string appName, string flagName, int count, string? sdkVersion)
    {
        var key = $"{environment}:{appName}";
        _serverUnknownBuffers.AddOrUpdate(key,
            _ => new ServerUnknownBuffer
            {
                SdkVersion = sdkVersion,
                Flags = new ConcurrentDictionary<string, int>(new[] { KeyValuePair.Create(flagName, count) })
            },
            (_, existing) =>
            {
                if (sdkVersion != null) existing.SdkVersion = sdkVersion;
                existing.Flags.AddOrUpdate(flagName, count, (_, c) => c + count);
                return existing;
            });
    }

    private async Task FlushSafe()
    {
        try { await FlushAsync(); }
        catch (Exception ex) { _logger.LogError(ex, "MetricsAggregator flush failed"); }
    }

    public async Task FlushAsync()
    {
        // Snapshot and clear
        var clientJobs = new List<KeyValuePair<string, ClientMetricBucket>>();
        foreach (var key in _clientBuffers.Keys.ToArray())
        {
            if (_clientBuffers.TryRemove(key, out var val))
                clientJobs.Add(KeyValuePair.Create(key, val));
        }

        var serverJobs = new List<KeyValuePair<string, ServerMetricBuffer>>();
        foreach (var key in _serverBuffers.Keys.ToArray())
        {
            if (_serverBuffers.TryRemove(key, out var val))
                serverJobs.Add(KeyValuePair.Create(key, val));
        }

        var unknownJobs = new List<KeyValuePair<string, ServerUnknownBuffer>>();
        foreach (var key in _serverUnknownBuffers.Keys.ToArray())
        {
            if (_serverUnknownBuffers.TryRemove(key, out var val))
                unknownJobs.Add(KeyValuePair.Create(key, val));
        }

        if (clientJobs.Count == 0 && serverJobs.Count == 0 && unknownJobs.Count == 0)
            return;

        _logger.LogDebug("Flushing aggregated metrics: {Client} client, {Server} server, {Unknown} unknown groups",
            clientJobs.Count, serverJobs.Count, unknownJobs.Count);

        var tasks = new List<Task>();

        // Client metrics
        foreach (var (key, buffer) in clientJobs)
        {
            var parts = key.Split(':', 2);
            tasks.Add(FlushClientMetrics(parts[0], parts[1], buffer));
        }

        // Server metrics
        foreach (var (key, buffer) in serverJobs)
        {
            var parts = key.Split(':', 2);
            tasks.Add(FlushServerMetrics(parts[0], parts[1], buffer));
        }

        // Unknown reports
        foreach (var (key, buffer) in unknownJobs)
        {
            var parts = key.Split(':', 2);
            foreach (var (flagName, count) in buffer.Flags)
            {
                tasks.Add(FlushServerUnknown(parts[0], parts[1], flagName, count, buffer.SdkVersion));
            }
        }

        await Task.WhenAll(tasks);
    }

    private async Task FlushClientMetrics(string environment, string appName, ClientMetricBucket buffer)
    {
        try
        {
            var client = _httpClientFactory.CreateClient("GatrixBackend");
            var request = new HttpRequestMessage(HttpMethod.Post,
                $"/api/v1/client/features/{Uri.EscapeDataString(environment)}/metrics")
            {
                Content = JsonContent.Create(new
                {
                    appName,
                    sdkVersion = buffer.SdkVersion,
                    bucket = new
                    {
                        start = buffer.Start.ToString("o"),
                        stop = buffer.Stop.ToString("o"),
                        flags = buffer.Flags,
                        missing = buffer.Missing,
                    },
                })
            };
            
            // Note: x-api-token, x-application-name, x-environment are added by HttpClient defaults
            if (buffer.SdkVersion != null)
                request.Headers.Add("x-sdk-version", buffer.SdkVersion);

            var resp = await client.SendAsync(request);
            resp.EnsureSuccessStatusCode();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to flush client metrics for {Key}", $"{environment}:{appName}");
        }
    }

    private async Task FlushServerMetrics(string environment, string appName, ServerMetricBuffer buffer)
    {
        try
        {
            var metrics = buffer.Metrics.Values.ToList();
            var client = _httpClientFactory.CreateClient("GatrixBackend");
            var request = new HttpRequestMessage(HttpMethod.Post,
                $"/api/v1/server/{Uri.EscapeDataString(environment)}/features/metrics")
            {
                Content = JsonContent.Create(new
                {
                    metrics,
                    bucket = new
                    {
                        start = DateTime.UtcNow.AddMilliseconds(-_options.MetricsFlushIntervalMs).ToString("o"),
                        stop = DateTime.UtcNow.ToString("o"),
                    },
                    timestamp = DateTime.UtcNow.ToString("o"),
                })
            };
            
            // Note: x-api-token, x-environment are added by HttpClient defaults
            // Override application name with the specific one from metrics
            request.Headers.Remove("X-Application-Name");
            request.Headers.Add("X-Application-Name", appName);
            
            if (buffer.SdkVersion != null)
                request.Headers.Add("x-sdk-version", buffer.SdkVersion);

            var resp = await client.SendAsync(request);
            resp.EnsureSuccessStatusCode();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to flush server metrics for {Key}", $"{environment}:{appName}");
        }
    }

    private async Task FlushServerUnknown(string environment, string appName, string flagName, int count, string? sdkVersion)
    {
        try
        {
            var client = _httpClientFactory.CreateClient("GatrixBackend");
            var request = new HttpRequestMessage(HttpMethod.Post,
                $"/api/v1/server/{Uri.EscapeDataString(environment)}/features/unknown")
            {
                Content = JsonContent.Create(new { flagName, count, sdkVersion })
            };
            
            // Note: x-api-token, x-environment are added by HttpClient defaults
            // Override application name with the specific one
            request.Headers.Remove("X-Application-Name");
            request.Headers.Add("X-Application-Name", appName);
            
            if (sdkVersion != null)
                request.Headers.Add("x-sdk-version", sdkVersion);

            var resp = await client.SendAsync(request);
            resp.EnsureSuccessStatusCode();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to flush unknown report for {Flag} in {Key}", flagName, $"{environment}:{appName}");
        }
    }

    // Helpers

    private static ClientMetricBucket CreateClientBucket(JsonElement bucket, string? sdkVersion)
    {
        var b = new ClientMetricBucket { SdkVersion = sdkVersion };
        if (bucket.TryGetProperty("start", out var startEl))
            b.Start = DateTime.TryParse(startEl.GetString(), out var s) ? s : DateTime.UtcNow;
        if (bucket.TryGetProperty("stop", out var stopEl))
            b.Stop = DateTime.TryParse(stopEl.GetString(), out var s2) ? s2 : DateTime.UtcNow;
        MergeBucketFlags(b, bucket);
        return b;
    }

    private static void MergeClientBucket(ClientMetricBucket existing, JsonElement bucket, string? sdkVersion)
    {
        if (sdkVersion != null) existing.SdkVersion = sdkVersion;

        if (bucket.TryGetProperty("stop", out var stopEl) &&
            DateTime.TryParse(stopEl.GetString(), out var stop) && stop > existing.Stop)
        {
            existing.Stop = stop;
        }

        MergeBucketFlags(existing, bucket);
    }

    private static void MergeBucketFlags(ClientMetricBucket b, JsonElement bucket)
    {
        if (bucket.TryGetProperty("flags", out var flagsEl) && flagsEl.ValueKind == JsonValueKind.Object)
        {
            foreach (var flagProp in flagsEl.EnumerateObject())
            {
                if (!b.Flags.TryGetValue(flagProp.Name, out var existing))
                {
                    existing = new FlagMetricData();
                    b.Flags[flagProp.Name] = existing;
                }

                if (flagProp.Value.TryGetProperty("yes", out var yesEl))
                    existing.Yes += yesEl.GetInt32();
                if (flagProp.Value.TryGetProperty("no", out var noEl))
                    existing.No += noEl.GetInt32();
                if (flagProp.Value.TryGetProperty("variants", out var variantsEl) &&
                    variantsEl.ValueKind == JsonValueKind.Object)
                {
                    foreach (var v in variantsEl.EnumerateObject())
                    {
                        existing.Variants.TryGetValue(v.Name, out var vc);
                        existing.Variants[v.Name] = vc + v.Value.GetInt32();
                    }
                }
            }
        }

        if (bucket.TryGetProperty("missing", out var missingEl) && missingEl.ValueKind == JsonValueKind.Object)
        {
            foreach (var m in missingEl.EnumerateObject())
            {
                b.Missing.TryGetValue(m.Name, out var mc);
                b.Missing[m.Name] = mc + m.Value.GetInt32();
            }
        }
    }

    private static void MergeServerMetrics(ServerMetricBuffer buf, JsonElement metrics)
    {
        if (metrics.ValueKind != JsonValueKind.Array) return;

        foreach (var item in metrics.EnumerateArray())
        {
            var flagName = item.TryGetProperty("flagName", out var fn) ? fn.GetString() ?? "" : "";
            var enabled = item.TryGetProperty("enabled", out var en) && en.GetBoolean();
            var variantName = item.TryGetProperty("variantName", out var vn) ? vn.GetString() : null;
            var count = item.TryGetProperty("count", out var cn) ? cn.GetInt32() : 1;

            var key = $"{flagName}:{enabled}:{variantName ?? ""}";
            buf.Metrics.AddOrUpdate(key,
                _ => new ServerMetricItem { FlagName = flagName, Enabled = enabled, VariantName = variantName, Count = count },
                (_, existing) => { existing.Count += count; return existing; });
        }
    }

    public void Dispose()
    {
        _flushTimer?.Dispose();
        GC.SuppressFinalize(this);
    }

    // Nested types

    private class ClientMetricBucket
    {
        public DateTime Start { get; set; } = DateTime.UtcNow;
        public DateTime Stop { get; set; } = DateTime.UtcNow;
        public Dictionary<string, FlagMetricData> Flags { get; set; } = new();
        public Dictionary<string, int> Missing { get; set; } = new();
        public string? SdkVersion { get; set; }
    }

    private class FlagMetricData
    {
        public int Yes { get; set; }
        public int No { get; set; }
        public Dictionary<string, int> Variants { get; set; } = new();
    }

    private class ServerMetricBuffer
    {
        public ConcurrentDictionary<string, ServerMetricItem> Metrics { get; set; } = new();
        public string? SdkVersion { get; set; }
    }

    private class ServerMetricItem
    {
        public string FlagName { get; set; } = "";
        public bool Enabled { get; set; }
        public string? VariantName { get; set; }
        public int Count { get; set; }
    }

    private class ServerUnknownBuffer
    {
        public ConcurrentDictionary<string, int> Flags { get; set; } = new();
        public string? SdkVersion { get; set; }
    }
}
