using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using Gatrix.Edge.Options;
using Gatrix.Server.Sdk.Cache;
using Microsoft.Extensions.Options;
using StackExchange.Redis;

namespace Gatrix.Edge.Services;

/// <summary>
/// Manages SSE and WebSocket connections for real-time feature flag change notifications.
/// Subscribes to Redis Pub/Sub 'gatrix-sdk-events' channel.
/// </summary>
public class FlagStreamingService : IHostedService, IDisposable
{
    private readonly ConcurrentDictionary<string, SseClient> _sseClients = new();
    private readonly ConcurrentDictionary<string, WsClient> _wsClients = new();
    private readonly EdgeOptions _options;
    private readonly ICacheManager _cacheManager;
    private readonly ILogger<FlagStreamingService> _logger;

    private ISubscriber? _subscriber;
    private IConnectionMultiplexer? _redisConnection;
    private IDatabase? _redisDb;
    private Timer? _heartbeatTimer;
    private Timer? _cleanupTimer;
    private bool _started;

    private const string SdkEventsChannel = "gatrix-sdk-events";
    private const string RevisionKeyPrefix = "gatrix:streaming:revision:";

    public FlagStreamingService(
        IOptions<EdgeOptions> options,
        ICacheManager cacheManager,
        ILogger<FlagStreamingService> logger)
    {
        _options = options.Value;
        _cacheManager = cacheManager;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        if (_started) return;
        _started = true;

        var configOptions = new ConfigurationOptions
        {
            EndPoints = { { _options.Redis.Host, _options.Redis.Port } },
            DefaultDatabase = _options.Redis.Db,
            AbortOnConnectFail = false,
        };
        if (!string.IsNullOrEmpty(_options.Redis.Password))
            configOptions.Password = _options.Redis.Password;

        // Connect Redis for commands (INCR, GET)
        try
        {
            _redisConnection = await ConnectionMultiplexer.ConnectAsync(configOptions);
            _redisDb = _redisConnection.GetDatabase();

            // Subscribe to events
            _subscriber = _redisConnection.GetSubscriber();
            await _subscriber.SubscribeAsync(RedisChannel.Literal(SdkEventsChannel), (_, message) =>
            {
                OnRedisMessage(message!);
            });

            _logger.LogInformation("FlagStreamingService: Subscribed to Redis channel {Channel}", SdkEventsChannel);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "FlagStreamingService: Failed to connect Redis");
        }

        // Heartbeat every 30 seconds
        _heartbeatTimer = new Timer(_ => SendHeartbeat(), null, 30000, 30000);

        // Cleanup stale connections every 60 seconds
        _cleanupTimer = new Timer(_ => CleanupStaleConnections(), null, 60000, 60000);

        _logger.LogInformation("FlagStreamingService started (SSE + WebSocket)");
    }

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        _heartbeatTimer?.Change(Timeout.Infinite, 0);
        _cleanupTimer?.Change(Timeout.Infinite, 0);

        // Disconnect all SSE clients
        foreach (var id in _sseClients.Keys.ToArray())
            RemoveSseClient(id);

        // Disconnect all WS clients
        foreach (var id in _wsClients.Keys.ToArray())
            await RemoveWsClientAsync(id);

        if (_subscriber != null)
        {
            try { await _subscriber.UnsubscribeAsync(RedisChannel.Literal(SdkEventsChannel)); } catch { /* cleanup */ }
        }
        if (_redisConnection != null)
        {
            try { await _redisConnection.CloseAsync(); } catch { /* cleanup */ }
        }

        _started = false;
        _logger.LogInformation("FlagStreamingService stopped");
    }

    /// <summary>
    /// Add a new SSE client.
    /// </summary>
    public async Task AddSseClientAsync(string clientId, string environmentId, HttpResponse response)
    {
        response.ContentType = "text/event-stream";
        response.Headers.CacheControl = "no-cache";
        response.Headers.Connection = "keep-alive";
        response.Headers["X-Accel-Buffering"] = "no";

        var client = new SseClient
        {
            Id = clientId,
            Environment = environmentId,
            Response = response,
            ConnectedAt = DateTime.UtcNow,
            LastEventTime = DateTime.UtcNow,
        };

        _sseClients[clientId] = client;

        // Send connected event
        var revision = await GetGlobalRevisionAsync(environmentId);
        await WriteSseEventAsync(clientId, "connected", new { globalRevision = revision });

        _logger.LogDebug("SSE client connected: {ClientId} for env: {Environment}", clientId, environmentId);
    }

    /// <summary>
    /// Add a new WebSocket client.
    /// </summary>
    public async Task AddWsClientAsync(string clientId, string environmentId, WebSocket ws)
    {
        var client = new WsClient
        {
            Id = clientId,
            Environment = environmentId,
            Socket = ws,
            ConnectedAt = DateTime.UtcNow,
            LastEventTime = DateTime.UtcNow,
        };

        _wsClients[clientId] = client;

        // Send connected event
        var revision = await GetGlobalRevisionAsync(environmentId);
        await WriteWsEventAsync(clientId, "connected", new { globalRevision = revision });

        _logger.LogDebug("WebSocket client connected: {ClientId} for env: {Environment}", clientId, environmentId);

        // Start reading messages (handle ping/pong)
        _ = ReadWsMessagesAsync(clientId, ws);
    }

    public void RemoveSseClient(string clientId)
    {
        if (_sseClients.TryRemove(clientId, out _))
        {
            _logger.LogDebug("SSE client disconnected: {ClientId}", clientId);
        }
    }

    public async Task RemoveWsClientAsync(string clientId)
    {
        if (_wsClients.TryRemove(clientId, out var client))
        {
            try
            {
                if (client.Socket.State == WebSocketState.Open)
                    await client.Socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Server closing", CancellationToken.None);
            }
            catch { /* may already be closed */ }
            _logger.LogDebug("WebSocket client disconnected: {ClientId}", clientId);
        }
    }

    private void OnRedisMessage(string message)
    {
        try
        {
            var doc = JsonDocument.Parse(message);
            var root = doc.RootElement;

            if (!root.TryGetProperty("type", out var typeEl) || typeEl.GetString() != "feature_flag.changed")
                return;

            if (!root.TryGetProperty("data", out var data) ||
                !data.TryGetProperty("environment", out var envEl))
                return;

            var environmentId = envEl.GetString()!;
            var changedKeys = new List<string>();
            if (data.TryGetProperty("changedKeys", out var keysEl) && keysEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var k in keysEl.EnumerateArray())
                {
                    var key = k.GetString();
                    if (key != null) changedKeys.Add(key);
                }
            }

            // Refresh cache then notify clients
            _ = RefreshCacheThenNotifyAsync(environmentId, changedKeys);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "FlagStreamingService: Failed to parse Redis event");
        }
    }

    private async Task RefreshCacheThenNotifyAsync(string environmentId, List<string> changedKeys)
    {
        try
        {
            await _cacheManager.RefreshFeatureFlagsAsync(environmentId);
            _logger.LogDebug("FlagStreamingService: Cache refreshed for env={Environment}", environmentId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "FlagStreamingService: Failed to refresh cache before notify");
        }

        await NotifyClientsAsync(environmentId, changedKeys);
    }

    private async Task NotifyClientsAsync(string environmentId, List<string> changedKeys)
    {
        var newRevision = await IncrementGlobalRevisionAsync(environmentId);
        var payload = new { globalRevision = newRevision, changedKeys, timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() };

        var notified = 0;

        // SSE clients
        foreach (var (id, client) in _sseClients)
        {
            if (client.Environment == environmentId)
            {
                await WriteSseEventAsync(id, "flags_changed", payload);
                notified++;
            }
        }

        // WS clients
        foreach (var (id, client) in _wsClients)
        {
            if (client.Environment == environmentId)
            {
                await WriteWsEventAsync(id, "flags_changed", payload);
                notified++;
            }
        }

        if (notified > 0)
        {
            _logger.LogDebug("FlagStreamingService: Notified {Count} clients for env={Environment}, rev={Revision}",
                notified, environmentId, newRevision);
        }
    }

    private async Task WriteSseEventAsync(string clientId, string eventType, object data)
    {
        if (!_sseClients.TryGetValue(clientId, out var client)) return;

        try
        {
            var json = JsonSerializer.Serialize(data);
            var message = $"event: {eventType}\ndata: {json}\n\n";
            var bytes = Encoding.UTF8.GetBytes(message);
            await client.Response.Body.WriteAsync(bytes);
            await client.Response.Body.FlushAsync();
            client.LastEventTime = DateTime.UtcNow;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to send SSE event to {ClientId}", clientId);
            RemoveSseClient(clientId);
        }
    }

    private async Task WriteWsEventAsync(string clientId, string eventType, object data)
    {
        if (!_wsClients.TryGetValue(clientId, out var client) ||
            client.Socket.State != WebSocketState.Open)
            return;

        try
        {
            var json = JsonSerializer.Serialize(new { type = eventType, data });
            var bytes = Encoding.UTF8.GetBytes(json);
            await client.Socket.SendAsync(bytes, WebSocketMessageType.Text, true, CancellationToken.None);
            client.LastEventTime = DateTime.UtcNow;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to send WS event to {ClientId}", clientId);
            await RemoveWsClientAsync(clientId);
        }
    }

    private async Task ReadWsMessagesAsync(string clientId, WebSocket ws)
    {
        var buffer = new byte[1024];
        try
        {
            while (ws.State == WebSocketState.Open)
            {
                var result = await ws.ReceiveAsync(buffer, CancellationToken.None);
                if (result.MessageType == WebSocketMessageType.Close)
                    break;

                if (result.MessageType == WebSocketMessageType.Text)
                {
                    var msg = Encoding.UTF8.GetString(buffer, 0, result.Count);
                    try
                    {
                        var doc = JsonDocument.Parse(msg);
                        if (doc.RootElement.TryGetProperty("type", out var typeEl) &&
                            typeEl.GetString() == "ping")
                        {
                            await WriteWsEventAsync(clientId, "pong", new { timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() });
                        }
                    }
                    catch { /* ignore malformed */ }
                }
            }
        }
        catch { /* connection may be closed */ }
        finally
        {
            await RemoveWsClientAsync(clientId);
        }
    }

    private void SendHeartbeat()
    {
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        foreach (var (id, _) in _sseClients)
        {
            _ = WriteSseEventAsync(id, "heartbeat", new { timestamp });
        }

        foreach (var (id, client) in _wsClients)
        {
            if (client.Socket.State == WebSocketState.Open)
            {
                _ = WriteWsEventAsync(id, "heartbeat", new { timestamp });
            }
        }
    }

    private void CleanupStaleConnections()
    {
        foreach (var (id, _) in _sseClients)
        {
            // SSE connections are tracked by response; remove if no longer writable
            // We rely on exception-based cleanup in WriteSseEventAsync
        }

        foreach (var (id, client) in _wsClients)
        {
            if (client.Socket.State == WebSocketState.Closed ||
                client.Socket.State == WebSocketState.Aborted)
            {
                _ = RemoveWsClientAsync(id);
            }
        }
    }

    private async Task<long> GetGlobalRevisionAsync(string environmentId)
    {
        if (_redisDb == null) return 0;
        try
        {
            var val = await _redisDb.StringGetAsync($"{RevisionKeyPrefix}{environmentId}");
            return val.HasValue && long.TryParse(val, out var rev) ? rev : 0;
        }
        catch { return 0; }
    }

    private async Task<long> IncrementGlobalRevisionAsync(string environmentId)
    {
        if (_redisDb == null) return 0;
        try { return await _redisDb.StringIncrementAsync($"{RevisionKeyPrefix}{environmentId}"); }
        catch { return 0; }
    }

    public object GetStats()
    {
        var byEnv = new Dictionary<string, int>();
        foreach (var (_, client) in _sseClients)
        {
            byEnv.TryGetValue(client.Environment, out var c);
            byEnv[client.Environment] = c + 1;
        }
        foreach (var (_, client) in _wsClients)
        {
            byEnv.TryGetValue(client.Environment, out var c);
            byEnv[client.Environment] = c + 1;
        }

        return new
        {
            totalClients = _sseClients.Count + _wsClients.Count,
            sseClients = _sseClients.Count,
            wsClients = _wsClients.Count,
            clientsByEnvironment = byEnv,
        };
    }

    public void Dispose()
    {
        _heartbeatTimer?.Dispose();
        _cleanupTimer?.Dispose();
        _redisConnection?.Dispose();
        GC.SuppressFinalize(this);
    }

    // Nested types

    private class SseClient
    {
        public string Id { get; set; } = "";
        public string Environment { get; set; } = "";
        public HttpResponse Response { get; set; } = null!;
        public DateTime ConnectedAt { get; set; }
        public DateTime LastEventTime { get; set; }
    }

    private class WsClient
    {
        public string Id { get; set; } = "";
        public string Environment { get; set; } = "";
        public WebSocket Socket { get; set; } = null!;
        public DateTime ConnectedAt { get; set; }
        public DateTime LastEventTime { get; set; }
    }
}
