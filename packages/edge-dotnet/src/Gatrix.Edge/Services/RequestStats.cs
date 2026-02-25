using System.Collections.Concurrent;

namespace Gatrix.Edge.Services;

/// <summary>
/// Collects and provides request statistics for monitoring.
/// Includes status code counts, endpoint counts, response time stats, and rate-limited logging.
/// </summary>
public class RequestStats
{
    private readonly DateTime _startTime = DateTime.UtcNow;
    private long _totalRequests;
    private readonly ConcurrentDictionary<int, long> _statusCodes = new();
    private readonly ConcurrentDictionary<string, EndpointStats> _endpoints = new();
    private long _totalBytesSent;
    private long _totalBytesReceived;
    private double _minDuration = double.MaxValue;
    private double _maxDuration;

    // Rate limiting
    private int _logRateLimit;
    private double _logTokens;
    private long _lastTokenRefill;
    private readonly object _rateLock = new();

    private const int MaxDurationsPerEndpoint = 1000;

    public RequestStats(int rateLimit = 100)
    {
        _logRateLimit = rateLimit;
        _logTokens = rateLimit;
        _lastTokenRefill = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
    }

    /// <summary>
    /// Record a request and return whether it should be logged (rate limited).
    /// </summary>
    public bool Record(string method, string path, int statusCode, double durationMs, long bytesSent, long bytesReceived)
    {
        Interlocked.Increment(ref _totalRequests);
        _statusCodes.AddOrUpdate(statusCode, 1, (_, c) => c + 1);

        Interlocked.Add(ref _totalBytesSent, bytesSent);
        Interlocked.Add(ref _totalBytesReceived, bytesReceived);

        // Min/Max (approximation for concurrent access)
        double oldMin, newMin;
        do { oldMin = _minDuration; newMin = Math.Min(oldMin, durationMs); }
        while (oldMin != newMin && Interlocked.CompareExchange(ref _minDuration, newMin, oldMin) != oldMin);

        double oldMax, newMax;
        do { oldMax = _maxDuration; newMax = Math.Max(oldMax, durationMs); }
        while (oldMax != newMax && Interlocked.CompareExchange(ref _maxDuration, newMax, oldMax) != oldMax);

        var endpointKey = $"{method} {path}";
        var endpoint = _endpoints.GetOrAdd(endpointKey, _ => new EndpointStats());
        endpoint.Record(statusCode, durationMs, bytesSent, bytesReceived);

        return ShouldLog();
    }

    private bool ShouldLog()
    {
        if (_logRateLimit == 0) return false;

        lock (_rateLock)
        {
            var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var elapsed = now - _lastTokenRefill;

            if (elapsed >= 1000)
            {
                _logTokens = _logRateLimit;
                _lastTokenRefill = now;
            }
            else
            {
                var tokensToAdd = (elapsed / 1000.0) * _logRateLimit;
                _logTokens = Math.Min(_logRateLimit, _logTokens + tokensToAdd);
                _lastTokenRefill = now;
            }

            if (_logTokens >= 1)
            {
                _logTokens--;
                return true;
            }
            return false;
        }
    }

    public object GetSnapshot()
    {
        var now = DateTime.UtcNow;
        var uptimeSeconds = (int)(now - _startTime).TotalSeconds;

        var statusCodesObj = new Dictionary<string, long>();
        foreach (var kvp in _statusCodes)
            statusCodesObj[kvp.Key.ToString()] = kvp.Value;

        var endpointsObj = new Dictionary<string, object>();
        foreach (var kvp in _endpoints)
            endpointsObj[kvp.Key] = kvp.Value.GetSnapshot();

        var totalDuration = _endpoints.Values.Sum(e => e.TotalDurationMs);

        return new
        {
            startTime = _startTime.ToString("o"),
            snapshotTime = now.ToString("o"),
            uptimeSeconds,
            totalRequests = Interlocked.Read(ref _totalRequests),
            statusCodes = statusCodesObj,
            endpoints = endpointsObj,
            totals = new
            {
                bytesSent = Interlocked.Read(ref _totalBytesSent),
                bytesReceived = Interlocked.Read(ref _totalBytesReceived),
                avgDurationMs = _totalRequests > 0
                    ? Math.Round(totalDuration / Interlocked.Read(ref _totalRequests))
                    : 0,
                minDurationMs = _minDuration == double.MaxValue ? 0 : Math.Round(_minDuration),
                maxDurationMs = Math.Round(_maxDuration),
            },
        };
    }

    public void Reset()
    {
        _totalRequests = 0;
        _statusCodes.Clear();
        _endpoints.Clear();
        _totalBytesSent = 0;
        _totalBytesReceived = 0;
        _minDuration = double.MaxValue;
        _maxDuration = 0;
    }

    public int GetRateLimit() => _logRateLimit;
    public void SetRateLimit(int limit)
    {
        _logRateLimit = limit;
        _logTokens = limit;
    }

    private class EndpointStats
    {
        private long _count;
        private double _totalDurationMs;
        private double _minDurationMs = double.MaxValue;
        private double _maxDurationMs;
        private readonly List<double> _durations = new();
        private long _bytesSent;
        private long _bytesReceived;
        private readonly ConcurrentDictionary<int, long> _statusCodes = new();
        private readonly object _lock = new();

        public double TotalDurationMs => _totalDurationMs;

        public void Record(int statusCode, double durationMs, long bytesSent, long bytesReceived)
        {
            Interlocked.Increment(ref _count);
            Interlocked.Add(ref _bytesSent, bytesSent);
            Interlocked.Add(ref _bytesReceived, bytesReceived);
            _statusCodes.AddOrUpdate(statusCode, 1, (_, c) => c + 1);

            lock (_lock)
            {
                _totalDurationMs += durationMs;
                _minDurationMs = Math.Min(_minDurationMs, durationMs);
                _maxDurationMs = Math.Max(_maxDurationMs, durationMs);

                if (_durations.Count < MaxDurationsPerEndpoint)
                    _durations.Add(durationMs);
                else
                    _durations[Random.Shared.Next(MaxDurationsPerEndpoint)] = durationMs;
            }
        }

        public object GetSnapshot()
        {
            double[] sorted;
            lock (_lock)
            {
                sorted = _durations.OrderBy(d => d).ToArray();
            }

            var statusCodesObj = new Dictionary<string, long>();
            foreach (var kvp in _statusCodes)
                statusCodesObj[kvp.Key.ToString()] = kvp.Value;

            var count = Interlocked.Read(ref _count);
            return new
            {
                count,
                avgDurationMs = count > 0 ? Math.Round(_totalDurationMs / count) : 0,
                minDurationMs = _minDurationMs == double.MaxValue ? 0 : Math.Round(_minDurationMs),
                maxDurationMs = Math.Round(_maxDurationMs),
                p95DurationMs = Percentile(sorted, 95),
                p99DurationMs = Percentile(sorted, 99),
                bytesSent = Interlocked.Read(ref _bytesSent),
                bytesReceived = Interlocked.Read(ref _bytesReceived),
                statusCodes = statusCodesObj,
            };
        }

        private static double Percentile(double[] sorted, int p)
        {
            if (sorted.Length == 0) return 0;
            var idx = Math.Max(0, (int)Math.Ceiling(p / 100.0 * sorted.Length) - 1);
            return Math.Round(sorted[idx]);
        }
    }
}
