using Microsoft.Extensions.Logging;

namespace Gatrix.ServerSDK.Types;

/// <summary>
/// Redis configuration for event handling
/// </summary>
public class RedisConfig
{
    /// <summary>
    /// Redis host address
    /// </summary>
    public required string Host { get; set; }

    /// <summary>
    /// Redis port number
    /// </summary>
    public int Port { get; set; } = 6379;

    /// <summary>
    /// Redis password (optional)
    /// </summary>
    public string? Password { get; set; }

    /// <summary>
    /// Redis database number (optional)
    /// </summary>
    public int Db { get; set; } = 0;
}

/// <summary>
/// Cache refresh methods
/// </summary>
public enum CacheRefreshMethod
{
    /// <summary>
    /// Periodic polling (default)
    /// </summary>
    Polling,

    /// <summary>
    /// Real-time event-based refresh via Redis PubSub
    /// </summary>
    Event,

    /// <summary>
    /// Manual refresh only
    /// </summary>
    Manual
}

/// <summary>
/// Cache configuration
/// </summary>
public class CacheConfig
{
    /// <summary>
    /// Enable caching (default: true)
    /// </summary>
    public bool Enabled { get; set; } = true;

    /// <summary>
    /// Cache TTL in seconds (default: 300)
    /// </summary>
    public int Ttl { get; set; } = 300;

    /// <summary>
    /// Cache refresh method (default: Polling)
    /// </summary>
    public CacheRefreshMethod RefreshMethod { get; set; } = CacheRefreshMethod.Polling;
}

/// <summary>
/// Logger configuration
/// </summary>
public class LoggerConfig
{
    /// <summary>
    /// Log level
    /// </summary>
    public LogLevel Level { get; set; } = LogLevel.Information;

    /// <summary>
    /// Time offset in hours (e.g., 9 for +09:00). Default: 0 (UTC)
    /// </summary>
    public int TimeOffset { get; set; } = 0;

    /// <summary>
    /// Timestamp format
    /// </summary>
    public TimestampFormat TimestampFormat { get; set; } = TimestampFormat.Iso8601;
}

/// <summary>
/// Timestamp format options
/// </summary>
public enum TimestampFormat
{
    /// <summary>
    /// ISO 8601 format (e.g., 2025-11-12T10:48:10.454Z)
    /// </summary>
    Iso8601,

    /// <summary>
    /// Local time format (e.g., 2025-11-12 10:48:10.454)
    /// </summary>
    Local
}

/// <summary>
/// HTTP retry configuration
/// </summary>
public class RetryConfig
{
    /// <summary>
    /// Enable retry (default: true)
    /// </summary>
    public bool Enabled { get; set; } = true;

    /// <summary>
    /// Max retry attempts. -1 for infinite retries (default: 10)
    /// </summary>
    public int MaxRetries { get; set; } = 10;

    /// <summary>
    /// Initial retry delay in milliseconds (default: 2000)
    /// </summary>
    public int RetryDelay { get; set; } = 2000;

    /// <summary>
    /// Delay multiplier for exponential backoff (default: 2)
    /// </summary>
    public int RetryDelayMultiplier { get; set; } = 2;

    /// <summary>
    /// Max retry delay in milliseconds (default: 10000)
    /// </summary>
    public int MaxRetryDelay { get; set; } = 10000;

    /// <summary>
    /// HTTP status codes to retry
    /// </summary>
    public int[] RetryableStatusCodes { get; set; } = [408, 429, 500, 502, 503, 504];
}

/// <summary>
/// Main SDK configuration
/// </summary>
public class GatrixSDKConfig
{
    /// <summary>
    /// Gatrix backend URL (required)
    /// </summary>
    public required string GatrixUrl { get; set; }

    /// <summary>
    /// Server API Token (required)
    /// </summary>
    public required string ApiToken { get; set; }

    /// <summary>
    /// Application name (required)
    /// </summary>
    public required string ApplicationName { get; set; }

    /// <summary>
    /// Redis configuration (optional, required for event-based refresh)
    /// </summary>
    public RedisConfig? Redis { get; set; }

    /// <summary>
    /// Cache configuration (optional)
    /// </summary>
    public CacheConfig Cache { get; set; } = new();

    /// <summary>
    /// Logger configuration (optional)
    /// </summary>
    public LoggerConfig Logger { get; set; } = new();

    /// <summary>
    /// HTTP retry configuration (optional)
    /// </summary>
    public RetryConfig Retry { get; set; } = new();
}

