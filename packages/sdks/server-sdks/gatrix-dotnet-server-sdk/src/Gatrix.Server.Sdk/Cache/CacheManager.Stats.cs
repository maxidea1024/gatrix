namespace Gatrix.Server.Sdk.Cache;

public partial class CacheManager
{
    public object GetCacheSummary()
    {
        return new
        {
            flags = _flagCache.FlagCount,
            segments = _flagCache.GetSegments().Count,
            gameWorlds = _options.IsMultiEnvironmentMode ? -1 : _gameWorld.GetAll(_options.Environment).Count,
            clientVersions = _options.IsMultiEnvironmentMode ? -1 : _clientVersion.GetAll(_options.Environment).Count,
            banners = _options.IsMultiEnvironmentMode ? -1 : _banner.GetAll(_options.Environment).Count,
            serviceNotices = _options.IsMultiEnvironmentMode ? -1 : _serviceNotice.GetAll(_options.Environment).Count,
            storeProducts = _options.IsMultiEnvironmentMode ? -1 : _storeProduct.GetAll(_options.Environment).Count
        };
    }

    public object GetCacheDetail()
    {
        return new { summary = GetCacheSummary() };
    }
}
