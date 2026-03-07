namespace Gatrix.Server.Sdk.Cache;

public partial class CacheManager
{
    public object GetCacheSummary()
    {
        return new
        {
            flags = _flagCache.FlagCount,
            segments = _flagCache.GetSegments().Count,
        };
    }

    public object GetCacheDetail()
    {
        return new { summary = GetCacheSummary() };
    }
}
