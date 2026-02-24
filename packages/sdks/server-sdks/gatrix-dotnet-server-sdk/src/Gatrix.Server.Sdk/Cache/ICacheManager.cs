namespace Gatrix.Server.Sdk.Cache;

/// <summary>
/// Abstraction for cache management — allows background refresh
/// of all service caches and feature flags.
/// </summary>
public interface ICacheManager
{
    /// <summary>Manually trigger a full cache refresh for all enabled services.</summary>
    Task RefreshAsync(CancellationToken ct = default);

    /// <summary>Refresh ONLY feature flags (flags + segments) for a specific environment.</summary>
    Task RefreshFeatureFlagsAsync(string? environment = null, CancellationToken ct = default);
}
