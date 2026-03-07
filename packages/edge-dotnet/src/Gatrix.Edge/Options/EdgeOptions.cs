namespace Gatrix.Edge.Options;

/// <summary>
/// Root configuration for Edge server.
/// Bound from appsettings.json "Edge" section or environment variables.
/// </summary>
public class EdgeOptions
{
    public const string SectionName = "Edge";

    // Server configuration
    public int Port { get; set; } = 3400;
    public int InternalPort { get; set; } = 3410;

    // Backend API configuration
    public string GatrixUrl { get; set; } = "http://localhost:3400";

    // Edge bypass token — allows access to all environments and internal APIs
    public string ApiToken { get; set; } = "gatrix-edge-internal-bypass-token";
    public string ApplicationName { get; set; } = "edge-server";

    public string Service { get; set; } = "edge";
    public string Group { get; set; } = "gatrix";

    // Redis configuration
    public EdgeRedisOptions Redis { get; set; } = new();

    // Cache configuration
    public EdgeCacheOptions Cache { get; set; } = new();

    // Logging
    public string LogLevel { get; set; } = "Information";

    // Unsecured client token for testing
    public string UnsecuredClientToken { get; set; } = "gatrix-unsecured-edge-api-token";

    // Token usage reporting interval in ms
    public int TokenUsageReportIntervalMs { get; set; } = 60000;

    // Metrics aggregator flush interval in ms
    public int MetricsFlushIntervalMs { get; set; } = 30000;

    // Request logging rate limit (per second, 0 = disabled)
    public int RequestLogRateLimit { get; set; } = 100;

    // Force HTTPS headers
    public bool ForceHttps { get; set; } = true;
}

public class EdgeRedisOptions
{
    public string Host { get; set; } = "localhost";
    public int Port { get; set; } = 6379;
    public string? Password { get; set; }
    public int Db { get; set; } = 0;
}

public class EdgeCacheOptions
{
    public int PollingIntervalMs { get; set; } = 30000;
    public string SyncMethod { get; set; } = "polling";
}
