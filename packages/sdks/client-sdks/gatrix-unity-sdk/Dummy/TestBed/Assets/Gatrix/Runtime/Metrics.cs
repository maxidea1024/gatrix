// Metrics - SDK usage tracking for Gatrix Unity Client SDK
// Thread-safe: bucket access is locked, event emissions dispatched to main thread

using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Metrics payload structure for server submission
    /// </summary>
    internal class MetricsPayload
    {
        public string AppName { get; set; }
        public string InstanceId { get; set; }
        public MetricsBucket Bucket { get; set; }
    }

    /// <summary>
    /// Metrics bucket - tracks flag access counts
    /// </summary>
    internal class MetricsBucket
    {
        public DateTime Start { get; set; }
        public DateTime? Stop { get; set; }
        public Dictionary<string, FlagBucket> Flags { get; set; }
        public Dictionary<string, int> Missing { get; set; }
    }

    /// <summary>
    /// Per-flag metrics bucket
    /// </summary>
    internal class FlagBucket
    {
        public int Yes { get; set; }
        public int No { get; set; }
        public Dictionary<string, int> Variants { get; set; }

        public FlagBucket()
        {
            Variants = new Dictionary<string, int>();
        }
    }

    /// <summary>
    /// Metrics collection and periodic server submission.
    /// Thread-safe: bucket operations are locked since Count() is called
    /// from the main thread while SendMetrics runs on a background continuation.
    /// </summary>
    internal class Metrics
    {
        private readonly string _appName;
        private readonly string _apiUrl;
        private readonly string _apiToken;
        private readonly string _environment;
        private readonly Dictionary<string, string> _customHeaders;
        private readonly bool _disabled;
        private readonly IGatrixLogger _logger;
        private readonly string _connectionId;
        private readonly GatrixEventEmitter _emitter;
        private readonly HttpClient _httpClient;
        private readonly SynchronizationContext _syncContext;

        // Lock protects _bucket read/write from concurrent access
        private readonly object _bucketLock = new object();
        private MetricsBucket _bucket;
        private CancellationTokenSource _cts;
        private bool _started;

        public Metrics(
            string appName,
            string apiUrl,
            string apiToken,
            string environment,
            Dictionary<string, string> customHeaders,
            bool disableMetrics,
            IGatrixLogger logger,
            string connectionId,
            GatrixEventEmitter emitter,
            HttpClient httpClient)
        {
            _appName = appName;
            _apiUrl = apiUrl;
            _apiToken = apiToken;
            _environment = environment;
            _customHeaders = customHeaders;
            _disabled = disableMetrics;
            _logger = logger;
            _connectionId = connectionId ?? "";
            _emitter = emitter;
            _httpClient = httpClient;
            _bucket = CreateEmptyBucket();

            // Capture SynchronizationContext for main thread dispatch
            _syncContext = SynchronizationContext.Current;
        }

        /// <summary>Start metrics collection</summary>
        public void Start(int metricsIntervalMs = 60000, int metricsIntervalInitialMs = 2000)
        {
            if (_disabled)
            {
                LogOnMainThread("Metrics disabled, skipping start");
                return;
            }
            if (_started) return;
            _started = true;

            LogOnMainThread($"Metrics started. interval={metricsIntervalMs}ms, initialDelay={metricsIntervalInitialMs}ms");
            _cts = new CancellationTokenSource();
            _ = RunMetricsLoop(metricsIntervalMs, metricsIntervalInitialMs, _cts.Token);
        }

        /// <summary>Stop metrics collection</summary>
        public void Stop()
        {
            _cts?.Cancel();
            _cts?.Dispose();
            _cts = null;
            _started = false;
        }

        /// <summary>Count flag access (called from main thread)</summary>
        public void Count(string flagName, bool enabled)
        {
            if (_disabled) return;

            lock (_bucketLock)
            {
                var bucket = AssertBucket(flagName);
                if (enabled) bucket.Yes++;
                else bucket.No++;
            }
        }

        /// <summary>Count variant usage (called from main thread)</summary>
        public void CountVariant(string flagName, string variantName)
        {
            if (_disabled) return;

            lock (_bucketLock)
            {
                var bucket = AssertBucket(flagName);
                if (bucket.Variants.TryGetValue(variantName, out var count))
                {
                    bucket.Variants[variantName] = count + 1;
                }
                else
                {
                    bucket.Variants[variantName] = 1;
                }
            }
        }

        /// <summary>Count access to missing flags (called from main thread)</summary>
        public void CountMissing(string flagName)
        {
            if (_disabled) return;

            lock (_bucketLock)
            {
                if (_bucket.Missing.TryGetValue(flagName, out var count))
                {
                    _bucket.Missing[flagName] = count + 1;
                }
                else
                {
                    _bucket.Missing[flagName] = 1;
                }
            }
        }

        /// <summary>Get missing flags record for statistics</summary>
        public Dictionary<string, int> GetMissingFlags()
        {
            lock (_bucketLock)
            {
                return new Dictionary<string, int>(_bucket.Missing);
            }
        }

        /// <summary>Send current metrics to server</summary>
        public async ValueTask SendMetricsAsync()
        {
            if (_disabled) return;

            var payload = GetPayload();
            if (BucketIsEmpty(payload))
            {
                LogOnMainThread("Metrics: bucket empty, skipping send");
                return;
            }

            var flagCount = payload.Bucket.Flags.Count;
            var missingCount = payload.Bucket.Missing.Count;
            LogOnMainThread($"Metrics: sending. flags={flagCount}, missing={missingCount}");

            const int maxRetries = 2;
            var url = $"{_apiUrl}/client/features/{_environment}/metrics";
            var json = GatrixJson.SerializeMetrics(payload);

            for (int attempt = 0; attempt <= maxRetries; attempt++)
            {
                try
                {
                    var content = new StringContent(json, Encoding.UTF8, "application/json");
                    var request = new HttpRequestMessage(HttpMethod.Post, url)
                    {
                        Content = content
                    };
                    request.Headers.TryAddWithoutValidation("X-API-Token", _apiToken);
                    request.Headers.TryAddWithoutValidation("X-Application-Name", _appName);
                    request.Headers.TryAddWithoutValidation("X-Connection-Id", _connectionId);
                    request.Headers.TryAddWithoutValidation("X-SDK-Version", $"{GatrixClient.SdkName}/{GatrixClient.SdkVersion}");
                    if (_customHeaders != null)
                    {
                        foreach (var kvp in _customHeaders)
                        {
                            request.Headers.TryAddWithoutValidation(kvp.Key, kvp.Value);
                        }
                    }

                    var response = await _httpClient.SendAsync(request);
                    var statusCode = (int)response.StatusCode;

                    if (statusCode < 400)
                    {
                        _logger?.Debug("Metrics sent successfully");
                        EmitOnMainThread(GatrixEvents.FlagsMetricsSent, payload);
                        return;
                    }

                    // Retry on retryable status codes
                    bool retryable = statusCode == 408 || statusCode == 429 || statusCode >= 500;
                    if (retryable && attempt < maxRetries)
                    {
                        var delay = (int)Math.Pow(2, attempt + 1) * 1000;
                        await Task.Delay(delay);
                        continue;
                    }

                    var body = await response.Content.ReadAsStringAsync();
                    throw new Exception($"HTTP {statusCode}: {body}");
                }
                catch (Exception e)
                {
                    if (attempt >= maxRetries)
                    {
                        var errorMsg = $"Failed to send metrics after {maxRetries + 1} attempts: {e.Message}";
                        // Log on main thread to ensure visibility in Unity console
                        if (_syncContext != null)
                        {
                            _syncContext.Post(_ => _logger?.Error(errorMsg), null);
                        }
                        else
                        {
                            _logger?.Error(errorMsg);
                        }
                        EmitOnMainThread(GatrixEvents.FlagsMetricsError, e);
                    }
                    else
                    {
                        var delay = (int)Math.Pow(2, attempt + 1) * 1000;
                        await Task.Delay(delay);
                    }
                }
            }
        }

        // ==================== Private ====================

        private async ValueTask RunMetricsLoop(int intervalMs, int initialDelayMs, CancellationToken ct)
        {
            try
            {
                if (initialDelayMs > 0)
                {
                    await Task.Delay(initialDelayMs, ct);
                }

                while (!ct.IsCancellationRequested)
                {
                    await SendMetricsAsync();
                    await Task.Delay(intervalMs, ct);
                }
            }
            catch (OperationCanceledException)
            {
                // Expected on stop
            }
        }

        /// <summary>
        /// Emit event on the main thread to prevent Unity API calls from background threads
        /// </summary>
        private void EmitOnMainThread(string eventName, object data = null)
        {
            if (_syncContext != null && SynchronizationContext.Current != _syncContext)
            {
                _syncContext.Post(_ =>
                {
                    _emitter?.Emit(eventName, data);
                }, null);
            }
            else
            {
                _emitter?.Emit(eventName, data);
            }
        }

        /// <summary>
        /// Log debug message on the main thread to ensure visibility in Unity console
        /// </summary>
        private void LogOnMainThread(string message)
        {
            if (_syncContext != null && SynchronizationContext.Current != _syncContext)
            {
                _syncContext.Post(_ => _logger?.Debug(message), null);
            }
            else
            {
                _logger?.Debug(message);
            }
        }

        private MetricsBucket CreateEmptyBucket()
        {
            return new MetricsBucket
            {
                Start = DateTime.UtcNow,
                Stop = null,
                Flags = new Dictionary<string, FlagBucket>(),
                Missing = new Dictionary<string, int>()
            };
        }

        private FlagBucket AssertBucket(string flagName)
        {
            // Caller must hold _bucketLock
            if (!_bucket.Flags.TryGetValue(flagName, out var bucket))
            {
                bucket = new FlagBucket();
                _bucket.Flags[flagName] = bucket;
            }
            return bucket;
        }

        private bool BucketIsEmpty(MetricsPayload payload)
        {
            return payload.Bucket.Flags.Count == 0 && payload.Bucket.Missing.Count == 0;
        }

        private MetricsPayload GetPayload()
        {
            lock (_bucketLock)
            {
                var bucket = _bucket;
                bucket.Stop = DateTime.UtcNow;
                _bucket = CreateEmptyBucket();

                return new MetricsPayload
                {
                    Bucket = bucket,
                    AppName = _appName,
                    InstanceId = _connectionId
                };
            }
        }
    }
}
