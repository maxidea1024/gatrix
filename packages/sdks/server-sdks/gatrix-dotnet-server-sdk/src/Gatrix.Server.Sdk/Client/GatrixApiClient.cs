using System.Linq;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Gatrix.Server.Sdk.Models;
using Gatrix.Server.Sdk.Options;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Gatrix.Server.Sdk.Client;

/// <summary>
/// Centralized HTTP client for Gatrix API communication.
/// Uses IHttpClientFactory for connection management and implements
/// exponential backoff retry for transient failures.
/// </summary>
public class GatrixApiClient
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly GatrixSdkOptions _options;
    private readonly ILogger<GatrixApiClient> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    public const string HttpClientName = "GatrixApiClient";

    public GatrixApiClient(
        IHttpClientFactory httpClientFactory,
        IOptions<GatrixSdkOptions> options,
        ILogger<GatrixApiClient> logger)
    {
        _httpClientFactory = httpClientFactory;
        _options = options.Value;
        _logger = logger;
    }

    // ── Public API ────────────────────────────────────────────────────

    public async Task<ApiResponse<T>> GetAsync<T>(string path, string? etag = null, CancellationToken ct = default)
    {
        return await ExecuteWithRetryAsync<T>(HttpMethod.Get, path, content: null, etag: etag, ct: ct);
    }

    public async Task<ApiResponse<T>> PostAsync<T>(string path, object? body = null, CancellationToken ct = default)
    {
        var content = body is not null
            ? JsonContent.Create(body, options: JsonOptions)
            : null;

        return await ExecuteWithRetryAsync<T>(HttpMethod.Post, path, content: content, etag: null, ct: ct);
    }

    // ── Internal ──────────────────────────────────────────────────────

    private async Task<ApiResponse<T>> ExecuteWithRetryAsync<T>(
        HttpMethod method, string path, HttpContent? content, string? etag, CancellationToken ct)
    {
        var retry = _options.Retry;
        var maxAttempts = retry.Enabled ? retry.MaxRetries + 1 : 1;
        var delay = retry.RetryDelayMs;

        for (var attempt = 1; attempt <= maxAttempts; attempt++)
        {
            using var client = _httpClientFactory.CreateClient(HttpClientName);
            using var request = new HttpRequestMessage(method, path);

            // Attach standard headers
            request.Headers.Add("X-API-Token", _options.ApiToken);
            request.Headers.Add("X-Application-Name", _options.ApplicationName);
            request.Headers.Add("X-SDK-Version", SdkInfo.FullName);

            if (!string.IsNullOrEmpty(etag) && method == HttpMethod.Get)
            {
                request.Headers.Add("If-None-Match", etag);
            }

            if (content is not null)
            {
                // Clone content for retry (HttpContent can only be sent once)
                var json = await content.ReadAsStringAsync(ct);
                request.Content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");
            }

            try
            {
                var response = await client.SendAsync(request, ct);
                var statusCode = (int)response.StatusCode;

                // Handle 304 Not Modified
                if (response.StatusCode == HttpStatusCode.NotModified)
                {
                    return new ApiResponse<T>
                    {
                        Success = true,
                        NotModified = true,
                        Etag = etag
                    };
                }

                if (response.IsSuccessStatusCode)
                {
                    var body = await response.Content.ReadFromJsonAsync<ApiResponse<T>>(JsonOptions, ct);
                    if (body != null)
                    {
                        // Extract ETag from headers
                        if (response.Headers.TryGetValues("ETag", out var etagValues))
                        {
                            body.Etag = etagValues.FirstOrDefault();
                        }
                        return body;
                    }
                    return new ApiResponse<T> { Success = false, Error = new ApiError { Message = "Empty response body" } };
                }

                // Non-retryable status codes → fail immediately
                if (!retry.Enabled || !IsRetryableStatusCode(statusCode))
                {
                    _logger.LogWarning("Non-retryable HTTP {StatusCode} from {Method} {Path}", statusCode, method, path);
                    return new ApiResponse<T>
                    {
                        Success = false,
                        Error = new ApiError { Message = $"HTTP {statusCode}", StatusCode = statusCode },
                    };
                }

                _logger.LogWarning("Retryable HTTP {StatusCode} from {Method} {Path} (attempt {Attempt}/{Max})",
                    statusCode, method, path, attempt, maxAttempts);
            }
            catch (TaskCanceledException) when (ct.IsCancellationRequested)
            {
                throw; // Propagate cancellation
            }
            catch (Exception ex) when (attempt < maxAttempts)
            {
                _logger.LogWarning(ex, "Request failed {Method} {Path} (attempt {Attempt}/{Max})",
                    method, path, attempt, maxAttempts);
            }

            // Exponential backoff
            if (attempt < maxAttempts)
            {
                _logger.LogDebug("Waiting {Delay}ms before retry", delay);
                await Task.Delay(delay, ct);
                delay = Math.Min(delay * retry.RetryDelayMultiplier, retry.MaxRetryDelayMs);
            }
        }

        // All retries exhausted
        return new ApiResponse<T>
        {
            Success = false,
            Error = new ApiError { Message = $"All {maxAttempts} attempts failed for {method} {path}" },
        };
    }

    private bool IsRetryableStatusCode(int statusCode)
    {
        return _options.Retry.RetryableStatusCodes.Contains(statusCode);
    }
}
