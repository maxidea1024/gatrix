using Gatrix.Edge.Services;
using Gatrix.Server.Sdk.Cache;
using Gatrix.Server.Sdk.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;

namespace Gatrix.Edge.Controllers;

/// <summary>
/// Server SDK API endpoints.
/// Routes: /api/v1/server/...
/// </summary>
[ApiController]
[Route("api/v1/server")]
public partial class ServerController : GatrixControllerBase
{
    private readonly TokenMirrorService _tokenMirror;
    private readonly ILogger<ServerController> _logger;

    public ServerController(
        FlagDefinitionCache flagCache,
        IFeatureFlagService featureFlagService,
        MetricsAggregator metricsAggregator,
        TokenMirrorService tokenMirror,
        ILogger<ServerController> logger,
        IMemoryCache evalCache)
        : base(flagCache, featureFlagService, evalCache, metricsAggregator)
    {
        _tokenMirror = tokenMirror;
        _logger = logger;
    }
}
