using Gatrix.Server.Sdk.Cache;
using Microsoft.AspNetCore.Mvc;

namespace Gatrix.Edge.Controllers;

public partial class InternalController : ControllerBase
{
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
}
