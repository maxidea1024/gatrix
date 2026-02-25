using Gatrix.Server.Sdk.Models;

namespace Gatrix.Server.Sdk.Cache;

public partial class CacheManager
{
    // ── Data accessors ────────────────────────────────────────────────

    public List<Models.ClientVersion> GetClientVersions(string environment) => _clientVersion.GetAll(environment);
    public List<Models.Banner> GetBanners(string environment) => _banner.GetAll(environment);
    public List<Models.ServiceNotice> GetServiceNotices(string environment) => _serviceNotice.GetAll(environment);
    public List<Models.GameWorld> GetGameWorlds(string environment) => _gameWorld.GetAll(environment);
}
