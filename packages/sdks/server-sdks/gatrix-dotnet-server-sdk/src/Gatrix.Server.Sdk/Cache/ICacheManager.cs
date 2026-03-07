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
    Task RefreshFeatureFlagsAsync(string? environmentId = null, CancellationToken ct = default);

    /// <summary>Refresh ONLY vars for a specific environment.</summary>
    Task RefreshVarsAsync(string environmentId, CancellationToken ct = default);

    object GetCacheSummary();
    object GetCacheDetail();

    List<Models.ClientVersion> GetClientVersions(string environmentId);
    List<Models.Banner> GetBanners(string environmentId);
    List<Models.ServiceNotice> GetServiceNotices(string environmentId);
    List<Models.GameWorld> GetGameWorlds(string environmentId);
    List<Models.VarItem> GetVars(string environmentId);
    string? GetVarValue(string key, string environmentId);
    T? GetVarParsedValue<T>(string key, string environmentId, System.Text.Json.JsonSerializerOptions? options = null);
}
