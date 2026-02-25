using Gatrix.Server.Sdk.Models;

namespace Gatrix.Server.Sdk.Cache;

public partial class CacheManager
{
    // ── Data accessors ────────────────────────────────────────────────

    public List<Models.ClientVersion> GetClientVersions(string environment) => _clientVersion.GetAll(environment);
    public List<Models.Banner> GetBanners(string environment) => _banner.GetCached(environment);
    public List<Models.ServiceNotice> GetServiceNotices(string environment) => _serviceNotice.GetCached(environment);
    public List<Models.GameWorld> GetGameWorlds(string environment) => _gameWorld.GetCached(environment);
    public List<Models.VarItem> GetVars(string environment) => _vars.GetCached(environment);
    public string? GetVarValue(string key, string environment) => _vars.GetValue(key, environment);
    public T? GetVarParsedValue<T>(string key, string environment, System.Text.Json.JsonSerializerOptions? options = null) => 
        _vars.GetParsedValue<T>(key, environment, options);
}
