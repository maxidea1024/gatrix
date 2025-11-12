using System.Text.Json;
using Gatrix.ServerSDK.Types;
using Gatrix.ServerSDK.Utils;
using StackExchange.Redis;

namespace Gatrix.ServerSDK.Cache;

/// <summary>
/// Event listener for Redis Pub/Sub
/// </summary>
public class EventListener
{
    private readonly RedisConfig _redisConfig;
    private readonly CacheManager _cacheManager;
    private readonly GatrixLogger _logger;
    private readonly string _channelName = "gatrix:sdk:events";

    private IConnectionMultiplexer? _redis;
    private ISubscriber? _subscriber;
    private bool _isConnected;

    private readonly Dictionary<string, List<Func<SdkEvent, Task>>> _eventListeners = [];

    public EventListener(RedisConfig redisConfig, CacheManager cacheManager, GatrixLogger logger)
    {
        _redisConfig = redisConfig;
        _cacheManager = cacheManager;
        _logger = logger;
    }

    /// <summary>
    /// Initialize event listener
    /// </summary>
    public async Task InitializeAsync()
    {
        _logger.Info("Initializing event listener...");

        try
        {
            var options = ConfigurationOptions.Parse($"{_redisConfig.Host}:{_redisConfig.Port}");
            if (!string.IsNullOrEmpty(_redisConfig.Password))
            {
                options.Password = _redisConfig.Password;
            }
            options.DefaultDatabase = _redisConfig.Db;

            _redis = await ConnectionMultiplexer.ConnectAsync(options);
            _subscriber = _redis.GetSubscriber();

            // Subscribe to events channel
            await _subscriber.SubscribeAsync(RedisChannel.Literal(_channelName), async (channel, message) =>
            {
                if (channel == RedisChannel.Literal(_channelName))
                {
                    try
                    {
                        var @event = JsonSerializer.Deserialize<SdkEvent>(message.ToString());
                        if (@event != null)
                        {
                            _logger.Info("SDK Event received", new { type = @event.Type });
                            await ProcessEventAsync(@event);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.Error("Failed to parse event message", new { error = ex.Message });
                    }
                }
            });

            _isConnected = true;
            _logger.Info("Event listener connected and subscribed");
        }
        catch (Exception ex)
        {
            _logger.Error("Failed to initialize event listener", new { error = ex.Message });
            throw;
        }
    }

    /// <summary>
    /// Process incoming event
    /// </summary>
    private async Task ProcessEventAsync(SdkEvent @event)
    {
        _logger.Debug("Processing event", new { type = @event.Type });

        // Emit to registered listeners
        await EmitEventAsync(@event);
    }

    /// <summary>
    /// Emit event to registered listeners
    /// </summary>
    private async Task EmitEventAsync(SdkEvent @event)
    {
        var listeners = new List<Func<SdkEvent, Task>>();

        if (_eventListeners.TryGetValue(@event.Type, out var typeListeners))
        {
            listeners.AddRange(typeListeners);
        }

        if (_eventListeners.TryGetValue("*", out var wildcardListeners))
        {
            listeners.AddRange(wildcardListeners);
        }

        if (listeners.Count == 0)
            return;

        _logger.Debug("Emitting event to listeners", new { type = @event.Type, listenerCount = listeners.Count });

        foreach (var listener in listeners)
        {
            try
            {
                await listener(@event);
            }
            catch (Exception ex)
            {
                _logger.Error("Event listener error", new { type = @event.Type, error = ex.Message });
            }
        }
    }

    /// <summary>
    /// Register event listener
    /// </summary>
    public void On(string eventType, Func<SdkEvent, Task> callback)
    {
        if (!_eventListeners.ContainsKey(eventType))
        {
            _eventListeners[eventType] = [];
        }

        _eventListeners[eventType].Add(callback);
    }

    /// <summary>
    /// Unregister event listener
    /// </summary>
    public void Off(string eventType, Func<SdkEvent, Task> callback)
    {
        if (_eventListeners.TryGetValue(eventType, out var listeners))
        {
            listeners.Remove(callback);
        }
    }

    /// <summary>
    /// Close event listener
    /// </summary>
    public async Task CloseAsync()
    {
        if (_subscriber != null)
        {
            await _subscriber.UnsubscribeAsync(RedisChannel.Literal(_channelName));
        }

        _redis?.Dispose();
        _logger.Info("Event listener closed");
    }
}

