using System.Collections.Concurrent;
using System.Net.Http.Json;
using System.Text.Json;
using Gatrix.Edge.Options;
using Microsoft.Extensions.Options;

namespace Gatrix.Edge.Services;

/// <summary>
/// Tracks API token usage and periodically reports to backend.
/// </summary>
public class TokenUsageTracker : IHostedService, IDisposable
{
    private readonly ConcurrentDictionary<int, TokenUsageStats> _usageMap = new();
    private readonly EdgeOptions _options;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<TokenUsageTracker> _logger;
    private readonly string _edgeInstanceId;
    private Timer? _reportTimer;

    public TokenUsageTracker(
        IOptions<EdgeOptions> options,
        IHttpClientFactory httpClientFactory,
        ILogger<TokenUsageTracker> logger)
    {
        _options = options.Value;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _edgeInstanceId = $"edge-{_options.Group}-{System.Diagnostics.Process.GetCurrentProcess().Id}";
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("[TokenUsageTracker] Initializing (interval={Interval}ms, instance={Instance})",
            _options.TokenUsageReportIntervalMs, _edgeInstanceId);

        _reportTimer = new Timer(
            async _ => await ReportUsageToBackendSafe(),
            state: null,
            dueTime: _options.TokenUsageReportIntervalMs,
            period: _options.TokenUsageReportIntervalMs);

        _logger.LogInformation("[TokenUsageTracker] Initialized");
        return Task.CompletedTask;
    }

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        _reportTimer?.Change(Timeout.Infinite, 0);

        if (!_usageMap.IsEmpty)
        {
            try { await ReportUsageToBackendAsync(); }
            catch (Exception ex) { _logger.LogError(ex, "[TokenUsageTracker] Failed to report during shutdown"); }
        }

        _usageMap.Clear();
        _logger.LogInformation("[TokenUsageTracker] Shutdown complete");
    }

    /// <summary>
    /// Record a token usage.
    /// </summary>
    public void RecordUsage(int tokenId)
    {
        _usageMap.AddOrUpdate(tokenId,
            _ => new TokenUsageStats { UsageCount = 1, LastUsedAt = DateTime.UtcNow },
            (_, existing) =>
            {
                existing.UsageCount++;
                existing.LastUsedAt = DateTime.UtcNow;
                return existing;
            });
    }

    private async Task ReportUsageToBackendSafe()
    {
        try { await ReportUsageToBackendAsync(); }
        catch (Exception ex) { _logger.LogError(ex, "[TokenUsageTracker] Failed to report usage"); }
    }

    private async Task ReportUsageToBackendAsync()
    {
        if (_usageMap.IsEmpty) return;

        // Snapshot and clear atomically
        var usageData = new List<object>();
        var backup = new Dictionary<int, TokenUsageStats>();

        foreach (var kvp in _usageMap)
        {
            if (_usageMap.TryRemove(kvp.Key, out var stats))
            {
                backup[kvp.Key] = stats;
                usageData.Add(new
                {
                    tokenId = kvp.Key,
                    usageCount = stats.UsageCount,
                    lastUsedAt = stats.LastUsedAt.ToString("o"),
                });
            }
        }

        try
        {
            var client = _httpClientFactory.CreateClient("GatrixBackend");
            var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/server/internal/token-usage-report")
            {
                Content = JsonContent.Create(new
                {
                    edgeInstanceId = _edgeInstanceId,
                    usageData,
                    reportedAt = DateTime.UtcNow.ToString("o"),
                })
            };
            request.Headers.Add("x-api-token", _options.ApiToken);
            request.Headers.Add("x-application-name", _options.ApplicationName);

            var response = await client.SendAsync(request);
            response.EnsureSuccessStatusCode();

            _logger.LogInformation("[TokenUsageTracker] Usage reported: {Count} tokens, {Total} total",
                usageData.Count, backup.Values.Sum(s => s.UsageCount));
        }
        catch
        {
            // Restore on failure
            foreach (var kvp in backup)
            {
                _usageMap.AddOrUpdate(kvp.Key,
                    _ => kvp.Value,
                    (_, existing) =>
                    {
                        existing.UsageCount += kvp.Value.UsageCount;
                        if (kvp.Value.LastUsedAt > existing.LastUsedAt)
                            existing.LastUsedAt = kvp.Value.LastUsedAt;
                        return existing;
                    });
            }
            throw;
        }
    }

    public void Dispose()
    {
        _reportTimer?.Dispose();
        GC.SuppressFinalize(this);
    }

    private class TokenUsageStats
    {
        public int UsageCount { get; set; }
        public DateTime LastUsedAt { get; set; }
    }
}
