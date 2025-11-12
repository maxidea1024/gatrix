using System.Net;
using System.Text.Json;
using Gatrix.ServerSDK.Types;
using Gatrix.ServerSDK.Utils;
using Microsoft.Extensions.Logging;

namespace Gatrix.ServerSDK.Client;

/// <summary>
/// HTTP client for Gatrix API with retry logic
/// </summary>
public class ApiClient
{
    private readonly HttpClient _httpClient;
    private readonly GatrixLogger _logger;
    private readonly RetryConfig _retryConfig;

    public ApiClient(HttpClient httpClient, GatrixLogger logger, RetryConfig retryConfig)
    {
        _httpClient = httpClient;
        _logger = logger;
        _retryConfig = retryConfig;
    }

    /// <summary>
    /// Check if error is retryable
    /// </summary>
    private bool IsRetryableError(HttpStatusCode statusCode)
    {
        return _retryConfig.RetryableStatusCodes.Contains((int)statusCode);
    }

    /// <summary>
    /// Calculate retry delay with exponential backoff
    /// </summary>
    private int CalculateRetryDelay(int attempt)
    {
        var delay = _retryConfig.RetryDelay * (int)Math.Pow(_retryConfig.RetryDelayMultiplier, attempt);
        return Math.Min(delay, _retryConfig.MaxRetryDelay);
    }

    /// <summary>
    /// Execute request with retry logic
    /// </summary>
    private async Task<T> ExecuteWithRetryAsync<T>(
        Func<Task<HttpResponseMessage>> requestFunc,
        string method,
        string url)
    {
        if (!_retryConfig.Enabled)
        {
            var response = await requestFunc();
            response.EnsureSuccessStatusCode();
            var json = await response.Content.ReadAsStringAsync();
            return JsonSerializer.Deserialize<T>(json) ?? throw new InvalidOperationException("Failed to deserialize response");
        }

        var isInfiniteRetry = _retryConfig.MaxRetries == -1;
        var maxAttempts = isInfiniteRetry ? int.MaxValue : _retryConfig.MaxRetries;
        HttpResponseMessage? lastResponse = null;

        for (int attempt = 0; attempt <= maxAttempts; attempt++)
        {
            try
            {
                var response = await requestFunc();

                if (response.IsSuccessStatusCode)
                {
                    var json = await response.Content.ReadAsStringAsync();
                    return JsonSerializer.Deserialize<T>(json) ?? throw new InvalidOperationException("Failed to deserialize response");
                }

                if (!IsRetryableError(response.StatusCode) || attempt == maxAttempts)
                {
                    response.EnsureSuccessStatusCode();
                }

                lastResponse = response;
                var delay = CalculateRetryDelay(attempt);

                _logger.Warn("Request failed, retrying...", new
                {
                    method,
                    url,
                    attempt = attempt + 1,
                    maxRetries = isInfiniteRetry ? "infinite" : (object)_retryConfig.MaxRetries,
                    retryDelay = delay,
                    statusCode = (int)response.StatusCode
                });

                await Task.Delay(delay);
            }
            catch (HttpRequestException ex)
            {
                if (attempt == maxAttempts)
                    throw;

                var delay = CalculateRetryDelay(attempt);
                _logger.Warn("Request failed, retrying...", new
                {
                    method,
                    url,
                    attempt = attempt + 1,
                    maxRetries = isInfiniteRetry ? "infinite" : (object)_retryConfig.MaxRetries,
                    retryDelay = delay,
                    error = ex.Message
                });

                await Task.Delay(delay);
            }
        }

        throw new HttpRequestException("Max retries exceeded");
    }

    /// <summary>
    /// GET request
    /// </summary>
    public async Task<T> GetAsync<T>(string endpoint)
    {
        var url = endpoint;
        return await ExecuteWithRetryAsync<T>(
            () => _httpClient.GetAsync(url),
            "GET",
            url
        );
    }

    /// <summary>
    /// POST request
    /// </summary>
    public async Task<T> PostAsync<T>(string endpoint, object? data = null)
    {
        var url = endpoint;
        return await ExecuteWithRetryAsync<T>(
            async () =>
            {
                var content = data != null
                    ? new StringContent(System.Text.Json.JsonSerializer.Serialize(data), System.Text.Encoding.UTF8, "application/json")
                    : null;
                return await _httpClient.PostAsync(url, content);
            },
            "POST",
            url
        );
    }

    /// <summary>
    /// PUT request
    /// </summary>
    public async Task<T> PutAsync<T>(string endpoint, object? data = null)
    {
        var url = endpoint;
        return await ExecuteWithRetryAsync<T>(
            async () =>
            {
                var content = data != null
                    ? new StringContent(System.Text.Json.JsonSerializer.Serialize(data), System.Text.Encoding.UTF8, "application/json")
                    : null;
                return await _httpClient.PutAsync(url, content);
            },
            "PUT",
            url
        );
    }

    /// <summary>
    /// DELETE request
    /// </summary>
    public async Task<T> DeleteAsync<T>(string endpoint)
    {
        var url = endpoint;
        return await ExecuteWithRetryAsync<T>(
            () => _httpClient.DeleteAsync(url),
            "DELETE",
            url
        );
    }
}

