// FeaturesClient.Streaming - SSE/WebSocket streaming and reconnection
// Handles real-time flag invalidation via streaming connections

using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Threading;
using Cysharp.Threading.Tasks;

namespace Gatrix.Unity.SDK
{
    public partial class FeaturesClient
    {
        // ==================== Streaming ====================

        /// <summary>
        /// Connect to the streaming endpoint for real-time invalidation signals.
        /// Branches to SSE or WebSocket based on transport configuration.
        /// </summary>
        private void ConnectStreaming()
        {
            if (_streamingState == StreamingConnectionState.Connected ||
                _streamingState == StreamingConnectionState.Connecting)
            {
                return;
            }

            _streamingState = StreamingConnectionState.Connecting;

            // Cancel previous streaming connection
            _streamingCts?.Cancel();
            _streamingCts?.Dispose();
            _streamingCts = new CancellationTokenSource();
            var ct = _streamingCts.Token;

            var transport = FeaturesConfig.Streaming.Transport;
            if (transport == StreamingTransport.WebSocket)
            {
                _devLog.Log("Connecting to WebSocket streaming endpoint...");
                RunWebSocketLoopAsync(ct).Forget();
            }
            else
            {
                _devLog.Log("Connecting to SSE streaming endpoint...");
                var streamUrl = FeaturesConfig.Streaming.Sse.Url
                    ?? $"{_config.ApiUrl}/client/features/{Uri.EscapeDataString(_config.Environment)}/stream/sse";
                RunSseLoopAsync(streamUrl, ct).Forget();
            }
        }

        /// <summary>
        /// SSE streaming loop - runs on background thread, dispatches events to main thread.
        /// </summary>
        private async UniTask RunSseLoopAsync(string streamUrl, CancellationToken ct)
        {
            // Run on thread pool to avoid main thread frame lag
            await UniTask.SwitchToThreadPool();
            try
            {
                var request = new HttpRequestMessage(HttpMethod.Get, streamUrl);
                request.Headers.TryAddWithoutValidation("Accept", "text/event-stream");
                request.Headers.TryAddWithoutValidation("Cache-Control", "no-cache");
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

                using (var response = await _httpClient.SendAsync(
                    request, HttpCompletionOption.ResponseHeadersRead, ct))
                {
                    if (!response.IsSuccessStatusCode)
                    {
                        var errorMessage = $"Streaming connection failed: {(int)response.StatusCode} {response.ReasonPhrase}";
                        _logger.Error(errorMessage);
                        PostToMainThread(() =>
                        {
                            TrackStreamingError(errorMessage);
                            _streamingState = StreamingConnectionState.Reconnecting;
                            _emitter.Emit(GatrixEvents.FlagsStreamingError,
                                new ErrorEvent { Type = "streaming_connect", Error = new GatrixException(errorMessage) });
                            _emitter.Emit(GatrixEvents.FlagsStreamingDisconnected);
                            ScheduleStreamingReconnect();
                        });
                        return;
                    }

                    // Connected successfully
                    PostToMainThread(() =>
                    {
                        // Track recovery if this was a reconnection
                        if (_streamingReconnectCount > 0)
                        {
                            TrackStreamingRecovery();
                        }
                        _streamingState = StreamingConnectionState.Connected;
                        _streamingReconnectAttempt = 0;
                        _devLog.Log($"Streaming connected. URL: {streamUrl}");
                        _emitter.Emit(GatrixEvents.FlagsStreamingConnected);
                    });

                    // Read SSE stream line by line
                    using (var stream = await response.Content.ReadAsStreamAsync())
                    {
                        var buffer = new byte[4096];
                        var lineBuffer = new StringBuilder();
                        string currentEventType = null;
                        var dataBuilder = new StringBuilder();

                        while (!ct.IsCancellationRequested)
                        {
                            var bytesRead = await stream.ReadAsync(buffer, 0, buffer.Length, ct);
                            if (bytesRead == 0)
                            {
                                // Stream closed by server
                                break;
                            }

                            var chunk = System.Text.Encoding.UTF8.GetString(buffer, 0, bytesRead);
                            lineBuffer.Append(chunk);

                            // Process complete lines
                            var text = lineBuffer.ToString();
                            var lastNewline = text.LastIndexOf('\n');
                            if (lastNewline < 0) continue;

                            var completeText = text.Substring(0, lastNewline + 1);
                            lineBuffer.Clear();
                            if (lastNewline + 1 < text.Length)
                            {
                                lineBuffer.Append(text.Substring(lastNewline + 1));
                            }

                            var lines = completeText.Split('\n');
                            foreach (var rawLine in lines)
                            {
                                var line = rawLine.TrimEnd('\r');

                                if (string.IsNullOrEmpty(line))
                                {
                                    // Empty line = event dispatch
                                    if (currentEventType != null || dataBuilder.Length > 0)
                                    {
                                        var eventType = currentEventType ?? "message";
                                        var eventData = dataBuilder.ToString();
                                        PostToMainThread(() => ProcessStreamingEvent(eventType, eventData));
                                        currentEventType = null;
                                        dataBuilder.Clear();
                                    }
                                    continue;
                                }

                                if (line.StartsWith("event:"))
                                {
                                    currentEventType = line.Substring(6).Trim();
                                }
                                else if (line.StartsWith("data:"))
                                {
                                    if (dataBuilder.Length > 0) dataBuilder.Append('\n');
                                    dataBuilder.Append(line.Substring(5).Trim());
                                }
                                // Ignore 'id:', 'retry:', and comment lines starting with ':'
                            }
                        }
                    }
                }

                // Stream ended normally
                if (!ct.IsCancellationRequested && _streamingState != StreamingConnectionState.Disconnected)
                {
                    PostToMainThread(() =>
                    {
                        _devLog.Log("Streaming connection closed by server");
                        _streamingState = StreamingConnectionState.Reconnecting;
                        _emitter.Emit(GatrixEvents.FlagsStreamingDisconnected);
                        ScheduleStreamingReconnect();
                    });
                }
            }
            catch (OperationCanceledException)
            {
                // Intentional disconnect - ignore
            }
            catch (Exception ex)
            {
                if (_streamingState == StreamingConnectionState.Disconnected) return;

                PostToMainThread(() =>
                {
                    TrackStreamingError(ex.Message);
                    _logger.Warn($"Streaming error: {ex.Message}");
                    _emitter.Emit(GatrixEvents.FlagsStreamingError,
                        new ErrorEvent { Type = "streaming", Error = ex });

                    if (_streamingState != StreamingConnectionState.Reconnecting)
                    {
                        _streamingState = StreamingConnectionState.Reconnecting;
                        _emitter.Emit(GatrixEvents.FlagsStreamingDisconnected);
                    }
                    ScheduleStreamingReconnect();
                });
            }
        }

        /// <summary>
        /// WebSocket streaming loop - uses IGatrixWebSocket abstraction for cross-platform support.
        /// On WebGL uses JS interop, on other platforms uses System.Net.WebSockets.
        /// </summary>
        private async UniTask RunWebSocketLoopAsync(CancellationToken ct)
        {
            // Run on thread pool to avoid main thread frame lag
            await UniTask.SwitchToThreadPool();
            IGatrixWebSocket ws = null;
            CancellationTokenSource linkedPingCts = null;
            try
            {
                // Build WebSocket URL
                var wsConfig = FeaturesConfig.Streaming.WebSocket;
                string baseUrl;
                if (!string.IsNullOrEmpty(wsConfig.Url))
                {
                    baseUrl = wsConfig.Url;
                }
                else
                {
                    // Convert http(s):// to ws(s)://
                    baseUrl = _config.ApiUrl.Replace("https://", "wss://").Replace("http://", "ws://");
                    baseUrl = $"{baseUrl}/client/features/{Uri.EscapeDataString(_config.Environment)}/stream/ws";
                }

                // Add auth as query parameter (WebSocket can't send custom headers in browser)
                var uriBuilder = new UriBuilder(baseUrl);
                var existingQuery = uriBuilder.Query.TrimStart('?');
                var separator = string.IsNullOrEmpty(existingQuery) ? "" : "&";
                uriBuilder.Query = $"{existingQuery}{separator}x-api-token={Uri.EscapeDataString(_config.ApiToken)}";

                // Create platform-appropriate WebSocket
                ws = GatrixWebSocketFactory.Create();
                ws.SetRequestHeader("X-API-Token", _config.ApiToken);
                ws.SetRequestHeader("X-Application-Name", _config.AppName);
                ws.SetRequestHeader("X-Environment", _config.Environment);
                ws.SetRequestHeader("X-Connection-Id", _connectionId);
                ws.SetRequestHeader("X-SDK-Version",
                    $"{GatrixClient.SdkName}/{GatrixClient.SdkVersion}");
                if (_config.CustomHeaders != null)
                {
                    foreach (var kvp in _config.CustomHeaders)
                    {
                        ws.SetRequestHeader(kvp.Key, kvp.Value);
                    }
                }

                // Store reference for cleanup
                _gatrixWs = ws;

                await ws.ConnectAsync(uriBuilder.Uri, ct);

                // Mark connected immediately after successful handshake (same as SSE pattern).
                // The PollEvent Open event is kept as a safety net for WebGL where
                // ConnectAsync returns immediately and connection is truly async.
                PostToMainThread(() =>
                {
                    // Track recovery if this was a reconnection
                    if (_streamingReconnectCount > 0)
                    {
                        TrackStreamingRecovery();
                    }
                    _streamingState = StreamingConnectionState.Connected;
                    _streamingReconnectAttempt = 0;
                    _devLog.Log($"WebSocket streaming connected. URL: {baseUrl}");
                    _emitter.Emit(GatrixEvents.FlagsStreamingConnected);
                });

                // Start ping loop
                _wsPingCts?.Cancel();
                _wsPingCts?.Dispose();
                _wsPingCts = new CancellationTokenSource();
                linkedPingCts = CancellationTokenSource.CreateLinkedTokenSource(ct, _wsPingCts.Token);
                RunWebSocketPingLoopAsync(ws, linkedPingCts.Token).Forget();

                // Event polling loop
                bool connected = true;
                while (!ct.IsCancellationRequested && ws.State != WsState.Closed)
                {
                    var evt = ws.PollEvent();
                    if (evt == null)
                    {
                        // No event pending - yield and wait
                        await UniTask.Delay(50, DelayType.Realtime, cancellationToken: ct);
                        continue;
                    }

                    switch (evt.Value.Type)
                    {
                        case WsEventType.Open:
                            // Already handled above after ConnectAsync.
                            // This handles the WebGL case where Open arrives via PollEvent.
                            if (!connected)
                            {
                                connected = true;
                                PostToMainThread(() =>
                                {
                                    _streamingState = StreamingConnectionState.Connected;
                                    _streamingReconnectAttempt = 0;
                                    _devLog.Log($"WebSocket streaming connected (via event). URL: {baseUrl}");
                                    _emitter.Emit(GatrixEvents.FlagsStreamingConnected);
                                });
                            }
                            break;

                        case WsEventType.Message:
                            ProcessWebSocketMessage(evt.Value.Data);
                            break;

                        case WsEventType.Error:
                            var errorMsg = evt.Value.Data;
                            PostToMainThread(() =>
                            {
                                TrackStreamingError(errorMsg);
                                _logger.Warn($"WebSocket error: {errorMsg}");
                            });
                            break;

                        case WsEventType.Close:
                            if (!ct.IsCancellationRequested &&
                                _streamingState != StreamingConnectionState.Disconnected)
                            {
                                PostToMainThread(() =>
                                {
                                    _devLog.Log("WebSocket connection closed by server");
                                    _streamingState = StreamingConnectionState.Reconnecting;
                                    _emitter.Emit(GatrixEvents.FlagsStreamingDisconnected);
                                    ScheduleStreamingReconnect();
                                });
                            }
                            return; // Exit loop
                    }
                }

                // Connection ended without explicit close event
                if (!ct.IsCancellationRequested && connected &&
                    _streamingState != StreamingConnectionState.Disconnected)
                {
                    PostToMainThread(() =>
                    {
                        _devLog.Log("WebSocket connection ended");
                        _streamingState = StreamingConnectionState.Reconnecting;
                        _emitter.Emit(GatrixEvents.FlagsStreamingDisconnected);
                        ScheduleStreamingReconnect();
                    });
                }
            }
            catch (OperationCanceledException)
            {
                // Intentional disconnect - ignore
            }
            catch (Exception ex)
            {
                if (_streamingState == StreamingConnectionState.Disconnected) return;

                PostToMainThread(() =>
                {
                    TrackStreamingError(ex.Message);
                    _logger.Warn($"WebSocket streaming error: {ex.Message}");
                    _emitter.Emit(GatrixEvents.FlagsStreamingError,
                        new ErrorEvent { Type = "websocket_streaming", Error = ex });

                    if (_streamingState != StreamingConnectionState.Reconnecting)
                    {
                        _streamingState = StreamingConnectionState.Reconnecting;
                        _emitter.Emit(GatrixEvents.FlagsStreamingDisconnected);
                    }
                    ScheduleStreamingReconnect();
                });
            }
            finally
            {
                linkedPingCts?.Dispose();
                ws?.Dispose();
                if (_gatrixWs == ws) _gatrixWs = null;
            }
        }

        /// <summary>
        /// Process a single WebSocket JSON message.
        /// </summary>
        private void ProcessWebSocketMessage(string message)
        {
            try
            {
                var index = 0;
                var parsed = GatrixJson.ParseJsonValue(message, ref index)
                    as Dictionary<string, object>;

                if (parsed != null &&
                    parsed.TryGetValue("type", out var typeObj) &&
                    typeObj is string eventType)
                {
                    // Handle pong locally
                    if (eventType == "pong") return;

                    string eventData = "";
                    if (parsed.TryGetValue("data", out var dataObj) && dataObj != null)
                    {
                        eventData = GatrixJson.Serialize(dataObj);
                    }

                    PostToMainThread(() => ProcessStreamingEvent(eventType, eventData));
                }
            }
            catch (Exception e)
            {
                _logger.Warn($"Failed to parse WebSocket message: {e.Message}");
            }
        }

        /// <summary>
        /// WebSocket ping loop - sends periodic pings to keep connection alive.
        /// </summary>
        private async UniTask RunWebSocketPingLoopAsync(IGatrixWebSocket ws, CancellationToken ct)
        {
            var pingIntervalMs = FeaturesConfig.Streaming.WebSocket.PingInterval * 1000;
            const string pingMessage = "{\"type\":\"ping\"}";

            // Run on thread pool to avoid main thread frame lag
            await UniTask.SwitchToThreadPool();
            try
            {
                while (!ct.IsCancellationRequested && ws.State == WsState.Open)
                {
                    await UniTask.Delay(pingIntervalMs, DelayType.Realtime, cancellationToken: ct);
                    if (ct.IsCancellationRequested) break;

                    if (ws.State == WsState.Open)
                    {
                        await ws.SendAsync(pingMessage, ct);
                    }
                }
            }
            catch (OperationCanceledException)
            {
                // Expected on disconnect
            }
            catch (Exception ex)
            {
                _logger.Warn($"WebSocket ping error: {ex.Message}");
            }
        }

        /// <summary>
        /// Process a single SSE event on the main thread.
        /// </summary>
        private void ProcessStreamingEvent(string eventType, string eventData)
        {
            _lastStreamingEventTime = DateTime.UtcNow;
            _streamingEventCount++;

            switch (eventType)
            {
                case "connected":
                    try
                    {
                        var index = 0;
                        var parsed = GatrixJson.ParseJsonValue(eventData, ref index)
                            as Dictionary<string, object>;
                        if (parsed != null && parsed.TryGetValue("globalRevision", out var revObj))
                        {
                            long serverRevision = 0;
                            if (revObj is int ri) serverRevision = ri;
                            else if (revObj is long rl) serverRevision = rl;
                            else if (revObj is double rd) serverRevision = (long)rd;

                            _devLog.Log($"Streaming 'connected' event: globalRevision={serverRevision}");
                            _emitter.Emit(GatrixEvents.FlagsStreamingConnected,
                                new StreamingConnectedEvent { GlobalRevision = serverRevision });

                            // Gap recovery: check if we missed any changes
                            if (serverRevision > _localGlobalRevision && _localGlobalRevision > 0)
                            {
                                _devLog.Log($"Gap detected: server={serverRevision}, local={_localGlobalRevision}. Triggering recovery.");
                                FetchFlagsAsync().Forget();
                            }
                            else if (_localGlobalRevision == 0)
                            {
                                // First connection, record initial revision
                                _localGlobalRevision = serverRevision;
                            }
                        }
                    }
                    catch (Exception e)
                    {
                        _logger.Warn($"Failed to parse streaming connected event: {e.Message}");
                    }
                    break;

                case "flags_changed":
                    try
                    {
                        var index = 0;
                        var parsed = GatrixJson.ParseJsonValue(eventData, ref index)
                            as Dictionary<string, object>;
                        if (parsed != null)
                        {
                            long serverRevision = 0;
                            if (parsed.TryGetValue("globalRevision", out var revObj))
                            {
                                if (revObj is int ri) serverRevision = ri;
                                else if (revObj is long rl) serverRevision = rl;
                                else if (revObj is double rd) serverRevision = (long)rd;
                            }

                            var changedKeys = new List<string>();
                            if (parsed.TryGetValue("changedKeys", out var keysObj) && keysObj is List<object> keysList)
                            {
                                foreach (var k in keysList)
                                {
                                    if (k != null) changedKeys.Add(k.ToString());
                                }
                            }

                            _devLog.Log($"Streaming 'flags_changed': globalRevision={serverRevision}, changedKeys=[{string.Join(",", changedKeys)}]");

                            // Only process if server revision is ahead
                            if (serverRevision > _localGlobalRevision)
                            {
                                _localGlobalRevision = serverRevision;
                                _emitter.Emit(GatrixEvents.FlagsInvalidated,
                                    new FlagsChangedEvent
                                    {
                                        GlobalRevision = serverRevision,
                                        ChangedKeys = changedKeys
                                    });
                                HandleStreamingInvalidation(changedKeys);
                            }
                            else
                            {
                                _devLog.Log($"Ignoring stale event: server={serverRevision} <= local={_localGlobalRevision}");
                            }
                        }
                    }
                    catch (Exception e)
                    {
                        _logger.Warn($"Failed to parse flags_changed event: {e.Message}");
                    }
                    break;

                case "heartbeat":
                    _devLog.Log("Streaming heartbeat received");
                    break;

                default:
                    _devLog.Log($"Unknown streaming event: {eventType}");
                    break;
            }
        }

        /// <summary>
        /// Disconnect from the streaming endpoint (SSE or WebSocket).
        /// </summary>
        private void DisconnectStreaming()
        {
            _devLog.Log("Disconnecting streaming");
            _streamingState = StreamingConnectionState.Disconnected;

            _streamingReconnectCts?.Cancel();
            _streamingReconnectCts?.Dispose();
            _streamingReconnectCts = null;

            _streamingCts?.Cancel();
            _streamingCts?.Dispose();
            _streamingCts = null;

            // WebSocket cleanup
            _wsPingCts?.Cancel();
            _wsPingCts?.Dispose();
            _wsPingCts = null;

            if (_gatrixWs != null)
            {
                try
                {
                    if (_gatrixWs.State == WsState.Open ||
                        _gatrixWs.State == WsState.Closing)
                    {
                        _gatrixWs.CloseAsync(CancellationToken.None).Forget();
                    }
                }
                catch { /* Ignore close errors */ }
                _gatrixWs.Dispose();
                _gatrixWs = null;
            }
        }

        /// <summary>
        /// Schedule streaming reconnection with exponential backoff + jitter.
        /// </summary>
        private void ScheduleStreamingReconnect()
        {
            if (_streamingState == StreamingConnectionState.Disconnected || !_started)
            {
                return;
            }

            // Cancel any existing reconnect timer
            _streamingReconnectCts?.Cancel();
            _streamingReconnectCts?.Dispose();
            _streamingReconnectCts = new CancellationTokenSource();

            _streamingReconnectAttempt++;
            _streamingReconnectCount++;

            int baseMs, maxMs;
            if (FeaturesConfig.Streaming.Transport == StreamingTransport.WebSocket)
            {
                baseMs = FeaturesConfig.Streaming.WebSocket.ReconnectBase * 1000;
                maxMs = FeaturesConfig.Streaming.WebSocket.ReconnectMax * 1000;
            }
            else
            {
                baseMs = FeaturesConfig.Streaming.Sse.ReconnectBase * 1000;
                maxMs = FeaturesConfig.Streaming.Sse.ReconnectMax * 1000;
            }

            // Exponential backoff: base * 2^(attempt-1), capped at max
            var exponentialDelay = (int)Math.Min(
                baseMs * Math.Pow(2, _streamingReconnectAttempt - 1),
                maxMs);
            // Add jitter (0 - 1000ms)
            var jitter = UnityEngine.Random.Range(0, 1000);
            var delayMs = exponentialDelay + jitter;

            _devLog.Log($"Scheduling streaming reconnect: attempt={_streamingReconnectAttempt}, delay={delayMs}ms");

            _emitter.Emit(GatrixEvents.FlagsStreamingReconnecting,
                _streamingReconnectAttempt, delayMs);

            // Transition to degraded after several failed attempts
            if (_streamingReconnectAttempt >= 5 && _streamingState != StreamingConnectionState.Degraded)
            {
                _streamingState = StreamingConnectionState.Degraded;
                _logger.Warn("Streaming degraded: falling back to polling-only mode");
            }

            var reconnectCt = _streamingReconnectCts.Token;
            ScheduleStreamingReconnectAsync(delayMs, reconnectCt).Forget();
        }

        private async UniTask ScheduleStreamingReconnectAsync(int delayMs, CancellationToken ct)
        {
            try
            {
                await UniTask.Delay(delayMs, DelayType.Realtime, cancellationToken: ct);
                if (ct.IsCancellationRequested) return;

                PostToMainThread(() =>
                {
                    // Abort previous connection before creating new one
                    _streamingCts?.Cancel();
                    _streamingCts?.Dispose();
                    _streamingCts = null;
                    ConnectStreaming();
                });
            }
            catch (OperationCanceledException)
            {
                // Expected on disconnect
            }
        }

        /// <summary>
        /// Handle streaming invalidation signal.
        /// Uses partial fetch for small change sets, falls back to full fetch when
        /// the number of changed keys exceeds half the cached flag count.
        /// </summary>
        private void HandleStreamingInvalidation(List<string> changedKeys)
        {
            // Threshold: if changed keys >= 50% of total flags, do full fetch
            var totalFlags = _realtimeFlags.Count;
            if (changedKeys.Count == 0 || totalFlags == 0 || changedKeys.Count >= totalFlags / 2)
            {
                // Full fetch: clear ETag so server returns fresh data
                _etag = "";
                if (!_isFetchingFlags)
                {
                    FetchFlagsAsync().Forget();
                }
                else
                {
                    // Mark all keys as pending (null signals full fetch needed)
                    _pendingInvalidationKeys.Clear();
                    _pendingInvalidationKeys.Add("*"); // Sentinel for full fetch
                    _devLog.Log("Fetch in progress, marking pending full invalidation");
                }
                return;
            }

            // Partial fetch: request only changed keys, keep ETag intact
            if (!_isFetchingFlags)
            {
                FetchPartialFlagsAsync(new HashSet<string>(changedKeys)).Forget();
            }
            else
            {
                foreach (var key in changedKeys)
                {
                    _pendingInvalidationKeys.Add(key);
                }
                _devLog.Log($"Fetch in progress, queued {changedKeys.Count} pending keys for re-fetch after completion");
            }
        }

        /// <summary>Track a streaming error occurrence</summary>
        private void TrackStreamingError(string errorMessage)
        {
            _streamingErrorCount++;
            _lastStreamingErrorTime = DateTime.UtcNow;
            _lastStreamingError = errorMessage;
        }

        /// <summary>Track a streaming recovery (successful reconnection)</summary>
        private void TrackStreamingRecovery()
        {
            _streamingRecoveryCount++;
            _lastStreamingRecoveryTime = DateTime.UtcNow;
        }
    }
}
