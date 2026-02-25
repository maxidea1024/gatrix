using Gatrix.Edge.Options;
using Gatrix.Edge.Services;
using Gatrix.Server.Sdk.Cache;
using Gatrix.Server.Sdk.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace Gatrix.Edge.Controllers;

/// <summary>
/// Client-facing API endpoints (cached data from SDK).
/// Routes: /api/v1/client/...
/// </summary>
[ApiController]
[Route("api/v1/client")]
public partial class ClientController : GatrixControllerBase
{
    private readonly FlagStreamingService _flagStreaming;
    private readonly EdgeOptions _options;
    private readonly ILogger<ClientController> _logger;
    private readonly ICacheManager _cacheManager;

    public ClientController(
        FlagDefinitionCache flagCache,
        IFeatureFlagService featureFlagService,
        MetricsAggregator metricsAggregator,
        FlagStreamingService flagStreaming,
        IOptions<EdgeOptions> options,
        ILogger<ClientController> logger,
        ICacheManager cacheManager,
        Microsoft.Extensions.Caching.Memory.IMemoryCache evalCache)
        : base(flagCache, featureFlagService, evalCache, metricsAggregator)
    {
        _flagStreaming = flagStreaming;
        _options = options.Value;
        _logger = logger;
        _cacheManager = cacheManager;
    }
}
