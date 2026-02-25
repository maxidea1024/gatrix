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
public class InternalController : ControllerBase
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

    /// <summary>
    /// GET /internal/health
    /// </summary>
    [HttpGet("health")]
    public IActionResult GetHealth()
    {
        var isTokenMirrorReady = _tokenMirror.IsInitialized;
        var isReady = isTokenMirrorReady;

        return StatusCode(isReady ? 200 : 503, new
        {
            status = isReady ? "healthy" : "initializing",
            timestamp = DateTime.UtcNow.ToString("o"),
            version = "1.0.0",
            tokenMirror = isTokenMirrorReady ? "ready" : "initializing",
            tokenCount = _tokenMirror.GetTokenCount(),
        });
    }

    /// <summary>
    /// GET /internal/cache/summary
    /// </summary>
    [HttpGet("cache/summary")]
    public IActionResult GetCacheSummary()
    {
        var summary = _cacheManager.GetCacheSummary();

        return Ok(new
        {
            status = "ready",
            timestamp = DateTime.UtcNow.ToString("o"),
            summary,
        });
    }

    /// <summary>
    /// GET /internal/cache
    /// </summary>
    [HttpGet("cache")]
    public IActionResult GetCache()
    {
        var summary = _cacheManager.GetCacheSummary();
        var detail = _cacheManager.GetCacheDetail();

        return Ok(new
        {
            status = "ready",
            timestamp = DateTime.UtcNow.ToString("o"),
            summary,
            detail,
        });
    }

    /// <summary>
    /// POST /internal/cache/refresh
    /// </summary>
    [HttpPost("cache/refresh")]
    public async Task<IActionResult> RefreshCache()
    {
        try
        {
            await _cacheManager.RefreshAsync();
            var summary = _cacheManager.GetCacheSummary();

            return Ok(new
            {
                status = "ready",
                timestamp = DateTime.UtcNow.ToString("o"),
                summary,
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                status = "error",
                message = ex.Message,
                timestamp = DateTime.UtcNow.ToString("o"),
            });
        }
    }

    // ========================================================================
    // Request Statistics
    // ========================================================================

    /// <summary>
    /// GET /internal/stats/requests
    /// </summary>
    [HttpGet("stats/requests")]
    public IActionResult GetRequestStats()
    {
        return Ok(new
        {
            success = true,
            data = _requestStats.GetSnapshot(),
            rateLimit = _requestStats.GetRateLimit(),
        });
    }

    /// <summary>
    /// POST /internal/stats/requests/reset
    /// </summary>
    [HttpPost("stats/requests/reset")]
    public IActionResult ResetRequestStats()
    {
        _requestStats.Reset();
        return Ok(new
        {
            success = true,
            message = "Request statistics reset",
            timestamp = DateTime.UtcNow.ToString("o"),
        });
    }

    /// <summary>
    /// GET /internal/stats/rate-limit
    /// </summary>
    [HttpGet("stats/rate-limit")]
    public IActionResult GetRateLimit()
    {
        return Ok(new
        {
            success = true,
            rateLimit = _requestStats.GetRateLimit(),
            description = "Maximum request logs per second (0 = disabled)",
        });
    }

    /// <summary>
    /// POST /internal/stats/rate-limit
    /// </summary>
    [HttpPost("stats/rate-limit")]
    public IActionResult SetRateLimit([FromBody] RateLimitRequest body)
    {
        if (body.Limit < 0)
            return BadRequest(new { success = false, error = "Invalid limit. Must be a non-negative number." });

        _requestStats.SetRateLimit(body.Limit);
        return Ok(new
        {
            success = true,
            rateLimit = body.Limit,
            message = body.Limit == 0 ? "Request logging disabled" : $"Rate limit set to {body.Limit}/second",
        });
    }

    public class RateLimitRequest
    {
        public int Limit { get; set; }
    }
}
