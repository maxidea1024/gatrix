using Gatrix.Server.Sdk.Cache;
using Microsoft.AspNetCore.Mvc;

namespace Gatrix.Edge.Controllers;

/// <summary>
/// Public API endpoints (no authentication required).
/// Routes: /public/...
/// </summary>
[ApiController]
[Route("public")]
public partial class PublicController : ControllerBase
{
    private readonly ICacheManager _cacheManager;
    private readonly ILogger<PublicController> _logger;

    public PublicController(ICacheManager cacheManager, ILogger<PublicController> logger)
    {
        _cacheManager = cacheManager;
        _logger = logger;
    }
}
