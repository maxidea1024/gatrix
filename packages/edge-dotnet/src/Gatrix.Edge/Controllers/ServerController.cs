using Gatrix.Edge.Services;
using Gatrix.Server.Sdk.Cache;
using Microsoft.AspNetCore.Mvc;

namespace Gatrix.Edge.Controllers;

/// <summary>
/// Server SDK API endpoints.
/// Routes: /api/v1/server/...
/// </summary>
[ApiController]
[Route("api/v1/server")]
public partial class ServerController : ControllerBase
{
    private readonly FlagDefinitionCache _flagCache;
    private readonly MetricsAggregator _metricsAggregator;
    private readonly TokenMirrorService _tokenMirror;
    private readonly ILogger<ServerController> _logger;

    public ServerController(
        FlagDefinitionCache flagCache,
        MetricsAggregator metricsAggregator,
        TokenMirrorService tokenMirror,
        ILogger<ServerController> logger)
    {
        _flagCache = flagCache;
        _metricsAggregator = metricsAggregator;
        _tokenMirror = tokenMirror;
        _logger = logger;
    }
}
