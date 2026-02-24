namespace Gatrix.Server.Sdk.Options;

/// <summary>
/// Root configuration for the Gatrix Server SDK.
/// Mirrors the Node.js GatrixSDKConfig interface.
/// Bind via IOptions{GatrixSdkOptions} or configure in AddGatrixServerSdk().
/// </summary>
public class GatrixSdkOptions
{
    public const string SectionName = "Gatrix";

    // ── Required ──────────────────────────────────────────────────────
    public string ApiUrl { get; set; } = string.Empty;
    public string ApiToken { get; set; } = string.Empty;
    public string ApplicationName { get; set; } = string.Empty;
    public string Service { get; set; } = string.Empty;
    public string Group { get; set; } = string.Empty;
    public string Environment { get; set; } = "development";

    /// <summary>
    /// Multi-environment mode (for Edge server).
    /// - null or empty: single-environment mode (uses Environment property)
    /// - ["*"]: wildcard mode — dynamically fetch all active environments from backend
    /// - ["env1", "env2", ...]: explicit list of environments to cache
    /// </summary>
    public List<string>? Environments { get; set; }

    // ── Optional ──────────────────────────────────────────────────────
    public string? WorldId { get; set; }
    public string? Version { get; set; }
    public string? CommitHash { get; set; }
    public string? GitBranch { get; set; }

    // ── Nested options ────────────────────────────────────────────────
    public RedisOptions? Redis { get; set; }
    public CacheOptions Cache { get; set; } = new();
    public RetryOptions Retry { get; set; } = new();
    public FeaturesOptions Features { get; set; } = new();

    // ── Multi-environment helpers ────────────────────────────────────

    /// <summary>True when Environments is set to ["*"] or a non-empty list.</summary>
    public bool IsMultiEnvironmentMode =>
        Environments is { Count: > 0 };

    /// <summary>True when Environments contains "*" (wildcard mode).</summary>
    public bool IsWildcardMode =>
        Environments is { Count: > 0 } && Environments.Contains("*");
}

/// <summary>
/// Redis configuration for event-based cache refresh via Pub/Sub.
/// </summary>
public class RedisOptions
{
    public string Host { get; set; } = "localhost";
    public int Port { get; set; } = 6379;
    public string? Password { get; set; }
    public int Db { get; set; } = 0;
}

/// <summary>
/// Cache refresh configuration.
/// </summary>
public class CacheOptions
{
    public bool Enabled { get; set; } = true;

    /// <summary>Cache TTL in seconds (used for polling interval). Default: 300.</summary>
    public int Ttl { get; set; } = 300;

    /// <summary>"polling" | "event" | "manual". Default: "polling".</summary>
    public string RefreshMethod { get; set; } = "polling";

    /// <summary>Skip waiting for backend readiness during initialization.</summary>
    public bool SkipBackendReady { get; set; } = false;
}

/// <summary>
/// HTTP retry configuration with exponential backoff.
/// </summary>
public class RetryOptions
{
    public bool Enabled { get; set; } = true;
    public int MaxRetries { get; set; } = 10;
    public int RetryDelayMs { get; set; } = 2000;
    public int RetryDelayMultiplier { get; set; } = 2;
    public int MaxRetryDelayMs { get; set; } = 10_000;
    public int[] RetryableStatusCodes { get; set; } = [408, 429, 500, 502, 503, 504];
}

/// <summary>
/// Selective feature toggles. Controls which services are cached.
/// Existing features default to true for backward compatibility.
/// New features (Edge server) default to false.
/// </summary>
public class FeaturesOptions
{
    // Existing features — default true
    public bool GameWorld { get; set; } = true;
    public bool PopupNotice { get; set; } = true;
    public bool Survey { get; set; } = true;
    public bool Whitelist { get; set; } = true;
    public bool ServiceMaintenance { get; set; } = true;

    // Newer features — default false
    public bool ClientVersion { get; set; } = false;
    public bool ServiceNotice { get; set; } = false;
    public bool Banner { get; set; } = false;
    public bool StoreProduct { get; set; } = false;
    public bool FeatureFlag { get; set; } = false;

    /// <summary>
    /// Static evaluation context applied to all feature flag evaluations.
    /// Useful for setting server-wide properties (e.g., service name, region).
    /// Can also be set programmatically via FeatureFlagService.SetStaticContext().
    /// </summary>
    public Dictionary<string, string>? StaticContext { get; set; }
}
