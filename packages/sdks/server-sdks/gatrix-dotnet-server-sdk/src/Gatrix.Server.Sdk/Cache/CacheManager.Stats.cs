namespace Gatrix.Server.Sdk.Cache;

public partial class CacheManager
{
    public object GetCacheSummary()
    {
        var env = _options.Environment;
        return new
        {
            flags = _flagCache.FlagCount,
            segments = _flagCache.GetSegments().Count,
            gameWorlds = _options.IsMultiEnvironmentMode ? -1 : _gameWorld.GetCached(env).Count,
            clientVersions = _options.IsMultiEnvironmentMode ? -1 : _clientVersion.GetAll(env).Count,
            banners = _options.IsMultiEnvironmentMode ? -1 : _banner.GetCached(env).Count,
            serviceNotices = _options.IsMultiEnvironmentMode ? -1 : _serviceNotice.GetCached(env).Count,
            storeProducts = _options.IsMultiEnvironmentMode ? -1 : _storeProduct.GetCached(env).Count,
            vars = _options.IsMultiEnvironmentMode ? -1 : _vars.GetCached(env).Count
        };
    }

    public object GetCacheDetail()
    {
        return new { summary = GetCacheSummary() };
    }
}
