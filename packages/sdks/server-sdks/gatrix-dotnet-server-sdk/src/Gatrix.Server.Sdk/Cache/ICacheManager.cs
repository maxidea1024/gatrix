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

    /// <summary>Refresh ONLY vars for a specific environment.</summary>
    Task RefreshVarsAsync(string environment, CancellationToken ct = default);

    object GetCacheSummary();
    object GetCacheDetail();

    List<Models.ClientVersion> GetClientVersions(string environment);
    List<Models.Banner> GetBanners(string environment);
    List<Models.ServiceNotice> GetServiceNotices(string environment);
    List<Models.GameWorld> GetGameWorlds(string environment);
    List<Models.VarItem> GetVars(string environment);
    string? GetVarValue(string key, string environment);
    T? GetVarParsedValue<T>(string key, string environment, System.Text.Json.JsonSerializerOptions? options = null);
}
