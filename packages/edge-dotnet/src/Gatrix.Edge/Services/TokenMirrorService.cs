using System.Collections.Concurrent;
using System.Net.Http.Json;
using System.Text.Json;
using Gatrix.Edge.Models;
using Gatrix.Edge.Options;
using Microsoft.Extensions.Options;
using StackExchange.Redis;

namespace Gatrix.Edge.Services;

/// <summary>
/// Mirrors all API tokens from backend to Edge memory.
/// Uses Redis Pub/Sub for real-time token change notifications.
/// </summary>
public class TokenMirrorService : IHostedService, IDisposable
{
    private readonly ConcurrentDictionary<string, MirroredToken> _tokensByValue = new();
    private readonly ConcurrentDictionary<int, MirroredToken> _tokensById = new();
    private readonly EdgeOptions _options;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<TokenMirrorService> _logger;
    private ISubscriber? _subscriber;
    private IConnectionMultiplexer? _redis;
    private bool _initialized;
    private const string ChannelName = "gatrix-sdk-events";
    private readonly string _cacheFilePath;

    public TokenMirrorService(
        IOptions<EdgeOptions> options,
        IHttpClientFactory httpClientFactory,
        ILogger<TokenMirrorService> logger)
    {
        _options = options.Value;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        
        // Setup cache file path (matches SDK convention)
        var cacheDir = Path.Combine(Directory.GetCurrentDirectory(), ".gatrix_cache");
        if (!Directory.Exists(cacheDir)) Directory.CreateDirectory(cacheDir);
        _cacheFilePath = Path.Combine(cacheDir, "edge_tokens.json");
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("[TokenMirror] Initializing token mirror service...");

        // 1. Try to load from local cache first
        await LoadFromCacheAsync(cancellationToken);

        // 2. Fetch from backend in background
        _ = FetchAllTokensAsync(cancellationToken);

        await SubscribeToEventsAsync();

        _initialized = true;
        _logger.LogInformation("[TokenMirror] Initialized (local count: {Count})", _tokensByValue.Count);
    }

    private async Task LoadFromCacheAsync(CancellationToken ct)
    {
        try
        {
            if (File.Exists(_cacheFilePath))
            {
                var json = await File.ReadAllTextAsync(_cacheFilePath, ct);
                var tokens = JsonSerializer.Deserialize<List<MirroredToken>>(json,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                if (tokens != null)
                {
                    UpdateInternalMaps(tokens);
                    _logger.LogInformation("[TokenMirror] Loaded {Count} tokens from local cache", tokens.Count);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[TokenMirror] Failed to load tokens from local cache");
        }
    }

    private async Task SaveToCacheAsync(List<MirroredToken> tokens, CancellationToken ct)
    {
        try
        {
            var json = JsonSerializer.Serialize(tokens, new JsonSerializerOptions { WriteIndented = true });
            await File.WriteAllTextAsync(_cacheFilePath, json, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[TokenMirror] Failed to save tokens to local cache");
        }
    }

    private void UpdateInternalMaps(List<MirroredToken> tokens)
    {
        _tokensByValue.Clear();
        _tokensById.Clear();

        foreach (var token in tokens)
        {
            _tokensByValue[token.TokenValue] = token;
            _tokensById[token.Id] = token;
        }
    }

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        if (_subscriber != null)
        {
            await _subscriber.UnsubscribeAsync(RedisChannel.Literal(ChannelName));
        }
        if (_redis != null)
        {
            await _redis.CloseAsync();
            _redis.Dispose();
        }
        _tokensByValue.Clear();
        _tokensById.Clear();
        _initialized = false;
        _logger.LogInformation("[TokenMirror] Shutdown complete");
    }

    public async Task FetchAllTokensAsync(CancellationToken ct = default)
    {
        try
        {
            var client = _httpClientFactory.CreateClient("GatrixBackend");
            var response = await client.GetAsync("/api/v1/server/internal/tokens", ct);
            response.EnsureSuccessStatusCode();

            var json = await response.Content.ReadAsStringAsync(ct);
            var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            if (root.TryGetProperty("success", out var success) && success.GetBoolean() &&
                root.TryGetProperty("data", out var data) &&
                data.TryGetProperty("tokens", out var tokensElement))
            {
                var tokens = JsonSerializer.Deserialize<List<MirroredToken>>(
                    tokensElement.GetRawText(),
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                if (tokens != null)
                {
                    UpdateInternalMaps(tokens);
                    _logger.LogInformation("[TokenMirror] Fetched {Count} tokens from backend", tokens.Count);

                    // Persist to local cache
                    await SaveToCacheAsync(tokens, ct);
                }
            }
            else
            {
                _logger.LogError("[TokenMirror] Invalid response from backend");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[TokenMirror] Failed to fetch tokens from backend. Using current cache (if any).");
            // Non-critical if we already have local cache
        }
    }

    private async Task SubscribeToEventsAsync()
    {
        try
        {
            var configOptions = new ConfigurationOptions
            {
                EndPoints = { { _options.Redis.Host, _options.Redis.Port } },
                DefaultDatabase = _options.Redis.Db,
                AbortOnConnectFail = false,
            };
            if (!string.IsNullOrEmpty(_options.Redis.Password))
            {
                configOptions.Password = _options.Redis.Password;
            }

            _redis = await ConnectionMultiplexer.ConnectAsync(configOptions);
            _subscriber = _redis.GetSubscriber();

            await _subscriber.SubscribeAsync(RedisChannel.Literal(ChannelName), (channel, message) =>
            {
                HandleEvent(message!);
            });

            _logger.LogInformation("[TokenMirror] Subscribed to Redis channel: {Channel}", ChannelName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[TokenMirror] Failed to subscribe to events");
            // Continue without real-time updates
        }
    }

    private void HandleEvent(string message)
    {
        try
        {
            var doc = JsonDocument.Parse(message);
            var root = doc.RootElement;

            if (!root.TryGetProperty("type", out var typeEl))
                return;

            var type = typeEl.GetString();
            if (type == null || !type.StartsWith("api_token."))
                return;

            _logger.LogInformation("[TokenMirror] Received event: {Type}", type);

            // Refetch all tokens on any token change
            _ = FetchAllTokensAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[TokenMirror] Failed to parse event");
        }
    }

    /// <summary>
    /// Validate a token locally.
    /// </summary>
    public TokenValidationResult ValidateToken(string tokenValue, string requiredType, string? environmentId = null)
    {
        // Check unsecured client token
        if (tokenValue == _options.UnsecuredClientToken)
        {
            _logger.LogDebug("Unsecured client token used for testing");
            return new TokenValidationResult
            {
                Valid = true,
                Token = new MirroredToken
                {
                    Id = 0,
                    TokenName = "Unsecured Client Token (Testing)",
                    TokenValue = _options.UnsecuredClientToken,
                    TokenType = "all",
                    AllowAllEnvironments = true,
                    Environments = new List<string> { "*" },
                    CreatedAt = DateTime.UtcNow.ToString("o"),
                    UpdatedAt = DateTime.UtcNow.ToString("o"),
                }
            };
        }

        if (!_tokensByValue.TryGetValue(tokenValue, out var token))
        {
            return new TokenValidationResult { Valid = false, Reason = "not_found" };
        }

        // Check expiration
        if (!string.IsNullOrEmpty(token.ExpiresAt))
        {
            if (DateTime.TryParse(token.ExpiresAt, out var expiresAt) && expiresAt < DateTime.UtcNow)
            {
                return new TokenValidationResult { Valid = false, Token = token, Reason = "expired" };
            }
        }

        // Check token type
        if (token.TokenType != "all" && token.TokenType != requiredType)
        {
            return new TokenValidationResult { Valid = false, Token = token, Reason = "invalid_type" };
        }

        // Check environment access
        if (environmentId != null && !token.AllowAllEnvironments)
        {
            if (!token.Environments.Contains(environmentId) && !token.Environments.Contains("*"))
            {
                return new TokenValidationResult { Valid = false, Token = token, Reason = "invalid_environment" };
            }
        }

        return new TokenValidationResult { Valid = true, Token = token };
    }

    public MirroredToken? GetToken(string tokenValue) =>
        _tokensByValue.TryGetValue(tokenValue, out var t) ? t : null;

    public MirroredToken? GetTokenById(int id) =>
        _tokensById.TryGetValue(id, out var t) ? t : null;

    public int GetTokenCount() => _tokensByValue.Count;
    public bool IsInitialized => _initialized;

    public void Dispose()
    {
        _redis?.Dispose();
        GC.SuppressFinalize(this);
    }
}
