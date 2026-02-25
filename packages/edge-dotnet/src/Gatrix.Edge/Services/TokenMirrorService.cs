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

    public TokenMirrorService(
        IOptions<EdgeOptions> options,
        IHttpClientFactory httpClientFactory,
        ILogger<TokenMirrorService> logger)
    {
        _options = options.Value;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("[TokenMirror] Initializing token mirror service...");

        await FetchAllTokensAsync(cancellationToken);
        await SubscribeToEventsAsync();

        _initialized = true;
        _logger.LogInformation("[TokenMirror] Initialized with {Count} tokens", _tokensByValue.Count);
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

    /// <summary>
    /// Fetch all tokens from backend.
    /// </summary>
    public async Task FetchAllTokensAsync(CancellationToken ct = default)
    {
        try
        {
            var client = _httpClientFactory.CreateClient("GatrixBackend");
            var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/server/internal/tokens");
            request.Headers.Add("x-api-token", _options.ApiToken);
            request.Headers.Add("x-application-name", _options.ApplicationName);

            var response = await client.SendAsync(request, ct);
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
                    _tokensByValue.Clear();
                    _tokensById.Clear();

                    foreach (var token in tokens)
                    {
                        _tokensByValue[token.TokenValue] = token;
                        _tokensById[token.Id] = token;
                    }

                    _logger.LogInformation("[TokenMirror] Fetched {Count} tokens from backend", tokens.Count);
                }
            }
            else
            {
                _logger.LogError("[TokenMirror] Invalid response from backend");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[TokenMirror] Failed to fetch tokens");
            throw;
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
    public TokenValidationResult ValidateToken(string tokenValue, string requiredType, string? environment = null)
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
        if (environment != null && !token.AllowAllEnvironments)
        {
            if (!token.Environments.Contains(environment) && !token.Environments.Contains("*"))
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
