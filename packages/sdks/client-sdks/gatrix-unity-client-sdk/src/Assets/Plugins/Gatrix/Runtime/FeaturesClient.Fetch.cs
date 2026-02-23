// FeaturesClient.Fetch - Flag fetching, storage, and polling
// Handles HTTP flag fetching, storage persistence, and refresh scheduling

using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Threading;
using Cysharp.Threading.Tasks;

namespace Gatrix.Unity.SDK
{
    public partial class FeaturesClient
    {
        // ==================== Fetch ====================

        /// <summary>Fetch flags from server</summary>
        public async UniTask FetchFlagsAsync()
        {
            if (_config.OfflineMode)
            {
                _logger.Warn("fetchFlags called but client is in offline mode, ignoring");
                return;
            }

            if (_isFetchingFlags) return;
            _isFetchingFlags = true;
            _devLog.Log($"fetchFlags: starting fetch. etag={_etag}");

            try
            {
                _emitter.Emit(GatrixEvents.FlagsFetchStart);

                // Cancel previous fetch
                _fetchCts?.Cancel();
                _fetchCts?.Dispose();
                _fetchCts = new CancellationTokenSource();
                var ct = _fetchCts.Token;

                _fetchFlagsCount++;
                _lastFetchTime = DateTime.UtcNow;

                // Build URL: {apiUrl}/client/features/{environment}/eval
                var urlBuilder = new StringBuilder(_config.ApiUrl);
                urlBuilder.Append("/client/features/");
                urlBuilder.Append(Uri.EscapeDataString(_config.Environment));
                urlBuilder.Append("/eval");

                HttpRequestMessage request;
                if (FeaturesConfig.UsePOSTRequests)
                {
                    // POST: context goes in JSON body
                    var url = urlBuilder.ToString();
                    var body = GatrixJson.SerializeEvalRequestBody(_context);
                    request = new HttpRequestMessage(HttpMethod.Post, url)
                    {
                        Content = new StringContent(body, Encoding.UTF8, "application/json")
                    };
                }
                else
                {
                    // GET: context goes in query params
                    urlBuilder.Append('?');
                    AppendContextQueryParams(urlBuilder, _context);
                    request = new HttpRequestMessage(HttpMethod.Get, urlBuilder.ToString());
                }

                // Headers
                request.Headers.TryAddWithoutValidation("X-API-Token", _config.ApiToken);
                request.Headers.TryAddWithoutValidation("X-Application-Name", _config.AppName);
                request.Headers.TryAddWithoutValidation("X-Environment", _config.Environment);
                request.Headers.TryAddWithoutValidation("X-Connection-Id", _connectionId);
                request.Headers.TryAddWithoutValidation("X-SDK-Version", $"{GatrixClient.SdkName}/{GatrixClient.SdkVersion}");
                if (_config.CustomHeaders != null)
                {
                    foreach (var kvp in _config.CustomHeaders)
                    {
                        request.Headers.TryAddWithoutValidation(kvp.Key, kvp.Value);
                    }
                }
                if (!string.IsNullOrEmpty(_etag))
                {
                    request.Headers.TryAddWithoutValidation("If-None-Match", _etag);
                }

                _emitter.Emit(GatrixEvents.FlagsFetch, _etag);

                // Send request with retry
                HttpResponseMessage response = null;
                var retryLimit = FeaturesConfig.FetchRetryLimit;
                var timeout = FeaturesConfig.FetchTimeout * 1000;

                for (int attempt = 0; attempt <= retryLimit; attempt++)
                {
                    try
                    {
                        using (var timeoutCts = new CancellationTokenSource(timeout))
                        using (var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(ct, timeoutCts.Token))
                        {
                            response = await _httpClient.SendAsync(
                                CloneRequest(request), linkedCts.Token);
                        }

                        // Success or client error - don't retry
                        if (response.IsSuccessStatusCode ||
                            response.StatusCode == HttpStatusCode.NotModified ||
                            (int)response.StatusCode < 500)
                        {
                            break;
                        }
                    }
                    catch (OperationCanceledException) when (ct.IsCancellationRequested)
                    {
                        return; // Cancelled
                    }
                    catch (Exception) when (attempt < retryLimit)
                    {
                        // Retry with exponential backoff
                        var delay = Math.Min(1000 * (1 << attempt), 8000);
                        await UniTask.Delay(delay, DelayType.Realtime, cancellationToken: ct);
                    }
                }

                if (response == null) return;

                _devLog.Log($"fetchFlags: response received. status={(int)response.StatusCode}");

                // Check for recovery
                if (_sdkState == SdkState.Error && (int)response.StatusCode < 400)
                {
                    _sdkState = SdkState.Healthy;
                    _recoveryCount++;
                    _lastRecoveryTime = DateTime.UtcNow;
                    _emitter.Emit(GatrixEvents.FlagsRecovered);
                }

                if (response.IsSuccessStatusCode)
                {
                    // Read ETag
                    IEnumerable<string> etagValues;
                    if (response.Headers.TryGetValues("ETag", out etagValues))
                    {
                        var newEtag = "";
                        foreach (var v in etagValues) { newEtag = v; break; }
                        if (newEtag != _etag)
                        {
                            _etag = newEtag;
                            await _storage.SaveAsync(StorageKeyEtag, _etag);
                        }
                    }

                    var json = await response.Content.ReadAsStringAsync();
                    var data = GatrixJson.DeserializeFlagsResponse(json);

                    _devLog.Log($"fetchFlags: parsed response. success={data?.Success}, flagCount={data?.Data?.Flags?.Count ?? 0}");


                    if (data != null && data.Success && data.Data?.Flags != null)
                    {
                        var isInitialFetch = !_fetchedFromServer;
                        await StoreFlagsAsync(data.Data.Flags, isInitialFetch);
                        _updateCount++;
                        _lastUpdateTime = DateTime.UtcNow;

                        if (!_fetchedFromServer)
                        {
                            _fetchedFromServer = true;
                            SetReady();
                        }
                    }

                    // Success: reset failure counter and schedule at normal interval
                    _consecutiveFailures = 0;
                    ScheduleNextRefresh();
                    _emitter.Emit(GatrixEvents.FlagsFetchSuccess);
                }
                else if (response.StatusCode == HttpStatusCode.NotModified)
                {
                    _notModifiedCount++;
                    _devLog.Log($"fetchFlags: 304 Not Modified (etag={_etag})");
                    if (!_fetchedFromServer)
                    {
                        _fetchedFromServer = true;
                        SetReady();
                    }
                    // 304: reset failure counter and schedule at normal interval
                    _consecutiveFailures = 0;
                    ScheduleNextRefresh();
                    _emitter.Emit(GatrixEvents.FlagsFetchSuccess);
                }
                else
                {
                    var statusCode = (int)response.StatusCode;
                    var nonRetryable = FeaturesConfig.NonRetryableStatusCodes ?? new int[] { 401, 403 };
                    var isNonRetryable = Array.IndexOf(nonRetryable, statusCode) >= 0;

                    HandleFetchError(statusCode);
                    _emitter.Emit(GatrixEvents.FlagsFetchError,
                        new ErrorEvent { Code = statusCode });

                    if (isNonRetryable)
                    {
                        // Non-retryable error: stop polling entirely
                        _pollingStopped = true;
                        _logger.Error($"Polling stopped due to non-retryable status code {statusCode}.");
                    }
                    else
                    {
                        // Retryable error: schedule with backoff
                        _consecutiveFailures++;
                        ScheduleNextRefresh();
                    }
                }
            }
            catch (OperationCanceledException)
            {
                _devLog.Log("fetchFlags: cancelled (timeout or shutdown)");
            }
            catch (Exception e)
            {
                _logger.Error($"Failed to fetch flags: {e.Message}");
                _sdkState = SdkState.Error;
                _lastError = e;
                _errorCount++;
                _lastErrorTime = DateTime.UtcNow;
                _emitter.Emit(GatrixEvents.FlagsError,
                    new ErrorEvent { Type = "fetch-flags", Error = e });
                _emitter.Emit(GatrixEvents.FlagsFetchError,
                    new ErrorEvent { Error = e });
                // Network error: schedule with backoff
                _consecutiveFailures++;
                ScheduleNextRefresh();
            }
            finally
            {
                _isFetchingFlags = false;
                _emitter.Emit(GatrixEvents.FlagsFetchEnd);

                // Process accumulated pending invalidation keys
                if (_pendingInvalidationKeys.Count > 0)
                {
                    var pendingKeys = new HashSet<string>(_pendingInvalidationKeys);
                    _pendingInvalidationKeys.Clear();

                    if (pendingKeys.Contains("*"))
                    {
                        // Sentinel: full fetch needed
                        _devLog.Log("Processing pending full invalidation after fetch completed");
                        _etag = "";
                        FetchFlagsAsync().Forget();
                    }
                    else
                    {
                        // Check threshold: if pending keys >= 50% of total flags, do full fetch
                        var totalFlags = _realtimeFlags.Count;
                        if (totalFlags == 0 || pendingKeys.Count >= totalFlags / 2)
                        {
                            _devLog.Log($"Pending keys ({pendingKeys.Count}) exceed threshold, doing full fetch");
                            _etag = "";
                            FetchFlagsAsync().Forget();
                        }
                        else
                        {
                            _devLog.Log($"Processing {pendingKeys.Count} pending partial invalidation keys");
                            FetchPartialFlagsAsync(pendingKeys).Forget();
                        }
                    }
                }
            }
        }

        private void HandleFetchError(int statusCode)
        {
            _sdkState = SdkState.Error;
            _lastError = new GatrixException($"HTTP error: {statusCode}");
            _errorCount++;
            _lastErrorTime = DateTime.UtcNow;
            _emitter.Emit(GatrixEvents.FlagsError,
                new ErrorEvent { Type = "HttpError", Code = statusCode });
        }

        private void ScheduleNextRefresh()
        {
            if (_refreshIntervalMs <= 0 || !_started || _pollingStopped) return;

            _pollCts?.Cancel();
            _pollCts?.Dispose();
            _pollCts = new CancellationTokenSource();
            var ct = _pollCts.Token;

            int delayMs = _refreshIntervalMs;

            // Apply exponential backoff on consecutive failures
            if (_consecutiveFailures > 0)
            {
                var featCfg = FeaturesConfig;
                var initialBackoff = featCfg.InitialBackoff * 1000;
                var maxBackoff = featCfg.MaxBackoff * 1000;
                var backoff = (int)Math.Min(
                    initialBackoff * Math.Pow(2, _consecutiveFailures - 1),
                    maxBackoff);
                delayMs = backoff;
                _logger.Warn($"Scheduling retry after {delayMs}ms (consecutive failures: {_consecutiveFailures})");
            }

            _devLog.Log($"ScheduleNextRefresh: delay={delayMs}ms, consecutiveFailures={_consecutiveFailures}, pollingStopped={_pollingStopped}");

            // Use async continuation that returns to the captured SynchronizationContext
            // so that FetchFlagsAsync and all event callbacks run on the main thread.
            ScheduleRefreshAsync(delayMs, ct).Forget();
        }

        private async UniTask ScheduleRefreshAsync(int delayMs, CancellationToken ct)
        {
            try
            {
                await UniTask.Delay(delayMs, DelayType.Realtime, cancellationToken: ct);
                if (ct.IsCancellationRequested) return;

                // Ensure we're back on the main thread for the fetch
                if (_syncContext != null && SynchronizationContext.Current != _syncContext)
                {
                    await UniTask.SwitchToMainThread(ct);
                }
                await FetchFlagsAsync();
            }
            catch (OperationCanceledException)
            {
                // Expected on stop
            }
        }

        private async UniTask StoreFlagsAsync(List<EvaluatedFlag> flags, bool forceSync = false)
        {
            var oldFlags = new Dictionary<string, EvaluatedFlag>(_realtimeFlags);
            SetFlags(flags, forceSync);

            var flagsJson = GatrixJson.SerializeFlags(flags);
            await _storage.SaveAsync(StorageKeyFlags, flagsJson);

            // Always invoke realtime watch callbacks when flags change from server
            EmitRealtimeFlagChanges(oldFlags, _realtimeFlags);
            InvokeWatchCallbacks(_watchCallbacks, oldFlags, _realtimeFlags, forceRealtime: true);

            // Invoke synced watch callbacks only in non-explicit mode (immediate sync)
            if (!FeaturesConfig.ExplicitSyncMode || forceSync)
            {
                InvokeWatchCallbacks(_syncedWatchCallbacks, oldFlags, _realtimeFlags, forceRealtime: false);
            }

            _sdkState = SdkState.Healthy;

            if (!FeaturesConfig.ExplicitSyncMode || forceSync)
            {
                _emitter.Emit(GatrixEvents.FlagsChange, flags);
            }
        }

        /// <summary>
        /// Fetch only specific flag keys from the server (partial fetch).
        /// Does NOT send or update ETag — the existing ETag remains intact
        /// for the next full polling cycle.
        /// </summary>
        private async UniTask FetchPartialFlagsAsync(HashSet<string> flagKeys)
        {
            if (_config.OfflineMode || flagKeys.Count == 0)
            {
                return;
            }

            if (_isFetchingFlags) return;
            _isFetchingFlags = true;

            var keysStr = string.Join(",", flagKeys);
            _devLog.Log($"fetchPartialFlags: starting partial fetch for keys=[{keysStr}]");

            try
            {
                _emitter.Emit(GatrixEvents.FlagsFetchStart);
                _fetchFlagsCount++;
                _lastFetchTime = DateTime.UtcNow;

                // Build URL with flagNames parameter
                var urlBuilder = new StringBuilder(_config.ApiUrl);
                urlBuilder.Append("/client/features/");
                urlBuilder.Append(Uri.EscapeDataString(_config.Environment));
                urlBuilder.Append("/eval");

                HttpRequestMessage request;
                if (FeaturesConfig.UsePOSTRequests)
                {
                    // POST: context and flagNames in JSON body
                    var url = urlBuilder.ToString();
                    var body = GatrixJson.SerializeEvalRequestBody(_context, flagKeys);
                    request = new HttpRequestMessage(HttpMethod.Post, url)
                    {
                        Content = new StringContent(body, Encoding.UTF8, "application/json")
                    };
                }
                else
                {
                    // GET: context and flagNames in query params
                    urlBuilder.Append('?');
                    AppendContextQueryParams(urlBuilder, _context);
                    urlBuilder.Append("&flagNames=");
                    urlBuilder.Append(Uri.EscapeDataString(keysStr));
                    request = new HttpRequestMessage(HttpMethod.Get, urlBuilder.ToString());
                }

                // Headers — NO If-None-Match (intentionally skip ETag for partial fetch)
                request.Headers.TryAddWithoutValidation("X-API-Token", _config.ApiToken);
                request.Headers.TryAddWithoutValidation("X-Application-Name", _config.AppName);
                request.Headers.TryAddWithoutValidation("X-Environment", _config.Environment);
                request.Headers.TryAddWithoutValidation("X-Connection-Id", _connectionId);
                request.Headers.TryAddWithoutValidation("X-SDK-Version", $"{GatrixClient.SdkName}/{GatrixClient.SdkVersion}");
                if (_config.CustomHeaders != null)
                {
                    foreach (var kvp in _config.CustomHeaders)
                    {
                        request.Headers.TryAddWithoutValidation(kvp.Key, kvp.Value);
                    }
                }

                _emitter.Emit(GatrixEvents.FlagsFetch, "partial");

                // Cancel previous fetch
                _fetchCts?.Cancel();
                _fetchCts?.Dispose();
                _fetchCts = new CancellationTokenSource();
                var ct = _fetchCts.Token;

                var timeout = FeaturesConfig.FetchTimeout * 1000;
                HttpResponseMessage response = null;

                using (var timeoutCts = new CancellationTokenSource(timeout))
                using (var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(ct, timeoutCts.Token))
                {
                    response = await _httpClient.SendAsync(request, linkedCts.Token);
                }

                if (response == null) return;

                _devLog.Log($"fetchPartialFlags: response received. status={(int)response.StatusCode}");

                if (response.IsSuccessStatusCode)
                {
                    // Intentionally ignore ETag from partial response
                    var json = await response.Content.ReadAsStringAsync();
                    var data = GatrixJson.DeserializeFlagsResponse(json);

                    if (data != null && data.Success && data.Data?.Flags != null)
                    {
                        await MergePartialFlagsAsync(data.Data.Flags, flagKeys);
                        _updateCount++;
                        _lastUpdateTime = DateTime.UtcNow;
                    }

                    _consecutiveFailures = 0;
                    _emitter.Emit(GatrixEvents.FlagsFetchSuccess);
                }
                else
                {
                    _devLog.Log($"fetchPartialFlags: error {(int)response.StatusCode}, falling back to full fetch");
                    // On partial fetch failure, fall back to full fetch
                    _etag = "";
                    _isFetchingFlags = false;
                    FetchFlagsAsync().Forget();
                    return;
                }
            }
            catch (OperationCanceledException)
            {
                _devLog.Log("fetchPartialFlags: cancelled");
            }
            catch (Exception e)
            {
                _logger.Error($"Failed to fetch partial flags: {e.Message}");
                // On error, fall back to full fetch on next cycle
            }
            finally
            {
                _isFetchingFlags = false;
                _emitter.Emit(GatrixEvents.FlagsFetchEnd);

                // Process accumulated pending invalidation keys
                if (_pendingInvalidationKeys.Count > 0)
                {
                    var pendingKeys = new HashSet<string>(_pendingInvalidationKeys);
                    _pendingInvalidationKeys.Clear();

                    if (pendingKeys.Contains("*"))
                    {
                        _etag = "";
                        FetchFlagsAsync().Forget();
                    }
                    else
                    {
                        var totalFlags = _realtimeFlags.Count;
                        if (totalFlags == 0 || pendingKeys.Count >= totalFlags / 2)
                        {
                            _etag = "";
                            FetchFlagsAsync().Forget();
                        }
                        else
                        {
                            FetchPartialFlagsAsync(pendingKeys).Forget();
                        }
                    }
                }
            }
        }

        /// <summary>
        /// Merge partial flag updates into existing cache, persist to storage,
        /// and emit change events.
        /// </summary>
        private async UniTask MergePartialFlagsAsync(List<EvaluatedFlag> flags, HashSet<string> requestedKeys)
        {
            var oldFlags = new Dictionary<string, EvaluatedFlag>(_realtimeFlags);
            MergeFlags(flags, requestedKeys);

            // Persist the full merged flag set
            var allFlags = new List<EvaluatedFlag>(_realtimeFlags.Count);
            foreach (var kvp in _realtimeFlags)
            {
                allFlags.Add(kvp.Value);
            }
            var flagsJson = GatrixJson.SerializeFlags(allFlags);
            await _storage.SaveAsync(StorageKeyFlags, flagsJson);

            // Emit change events
            EmitRealtimeFlagChanges(oldFlags, _realtimeFlags);
            InvokeWatchCallbacks(_watchCallbacks, oldFlags, _realtimeFlags, forceRealtime: true);

            if (!FeaturesConfig.ExplicitSyncMode)
            {
                InvokeWatchCallbacks(_syncedWatchCallbacks, oldFlags, _realtimeFlags, forceRealtime: false);
            }

            _sdkState = SdkState.Healthy;

            if (!FeaturesConfig.ExplicitSyncMode)
            {
                _emitter.Emit(GatrixEvents.FlagsChange, allFlags);
            }
        }

        private async UniTask<string> ResolveSessionIdAsync()
        {
            if (!string.IsNullOrEmpty(_context.SessionId))
                return _context.SessionId;

            var sessionId = await _storage.GetAsync(StorageKeySession);
            if (string.IsNullOrEmpty(sessionId))
            {
                sessionId = UnityEngine.Random.Range(0, 1000000000).ToString();
                await _storage.SaveAsync(StorageKeySession, sessionId);
            }
            return sessionId;
        }
    }
}
