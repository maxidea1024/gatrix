using Gatrix.Server.Sdk.Models;

namespace Gatrix.Server.Sdk.Cache;

public partial class CacheManager
{
    // ── Data accessors ────────────────────────────────────────────────

    public List<Models.ClientVersion> GetClientVersions(string environmentId) => _clientVersion.GetAll(environmentId);
    public List<Models.Banner> GetBanners(string environmentId) => _banner.GetCached(environmentId);
    public List<Models.ServiceNotice> GetServiceNotices(string environmentId) => _serviceNotice.GetCached(environmentId);
    public List<Models.GameWorld> GetGameWorlds(string environmentId) => _gameWorld.GetCached(environmentId);
    public List<Models.VarItem> GetVars(string environmentId) => _vars.GetCached(environmentId);
    public string? GetVarValue(string key, string environmentId) => _vars.GetValue(key, environmentId);
    public T? GetVarParsedValue<T>(string key, string environmentId, System.Text.Json.JsonSerializerOptions? options = null) => 
        _vars.GetParsedValue<T>(key, environmentId, options);
}
