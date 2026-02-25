using Gatrix.Edge.Services;
using Gatrix.Server.Sdk.Cache;
using Microsoft.AspNetCore.Mvc;

namespace Gatrix.Edge.Controllers;

/// <summary>
/// Internal management endpoints (cache, stats).
/// Routes: /internal/...
/// </summary>
[ApiController]
[Route("internal")]
public partial class InternalController : ControllerBase
{
    private readonly ICacheManager _cacheManager;
    private readonly TokenMirrorService _tokenMirror;
    private readonly RequestStats _requestStats;
    private readonly ILogger<InternalController> _logger;

    public InternalController(
        ICacheManager cacheManager,
        TokenMirrorService tokenMirror,
        RequestStats requestStats,
        ILogger<InternalController> logger)
    {
        _cacheManager = cacheManager;
        _tokenMirror = tokenMirror;
        _requestStats = requestStats;
        _logger = logger;
    }
}
