using Gatrix.Server.Sdk.Cache;
using Microsoft.AspNetCore.Mvc;

namespace Gatrix.Edge.Controllers;

/// <summary>
/// Public API endpoints (no authentication required).
/// Routes: /public/...
/// </summary>
[ApiController]
[Route("public")]
public class PublicController : ControllerBase
{
    private readonly ICacheManager _cacheManager;
    private readonly ILogger<PublicController> _logger;

    public PublicController(ICacheManager cacheManager, ILogger<PublicController> logger)
    {
        _cacheManager = cacheManager;
        _logger = logger;
    }

    /// <summary>
    /// GET /public/{environment}/service-notices
    /// </summary>
    [HttpGet("{environment}/service-notices")]
    public IActionResult GetServiceNotices(string environment,
        [FromQuery] string? platform, [FromQuery] string? fields)
    {
        var envNotices = _cacheManager.GetServiceNotices(environment);

        // Filter by platform
        var filtered = platform != null
            ? envNotices.Where(n => n.Platforms == null || n.Platforms.Count == 0 || n.Platforms.Contains(platform)).ToList()
            : envNotices;

        // If fields=summary, exclude content
        object responseNotices = filtered;
        if (fields == "summary")
        {
            responseNotices = filtered.Select(n => new
            {
                n.Id,
                n.Title,
                n.Category,
                n.Platforms,
                n.CreatedAt,
                n.UpdatedAt,
            }).ToList();
        }

        _logger.LogDebug("Public service notices retrieved: env={Environment}, platform={Platform}, count={Count}",
            environment, platform, filtered.Count);

        // Disable HTTP caching
        Response.Headers.CacheControl = "no-store, no-cache, must-revalidate, proxy-revalidate";
        Response.Headers.Pragma = "no-cache";
        Response.Headers.Expires = "0";
        Response.Headers.Remove("ETag");

        return Ok(new
        {
            success = true,
            data = new { notices = responseNotices, total = filtered.Count },
        });
    }

    /// <summary>
    /// GET /public/{environment}/service-notices/{noticeId}
    /// </summary>
    [HttpGet("{environment}/service-notices/{noticeId:int}")]
    public IActionResult GetServiceNotice(string environment, int noticeId)
    {
        var envNotices = _cacheManager.GetServiceNotices(environment);
        var notice = envNotices.FirstOrDefault(n => n.Id == noticeId);

        if (notice == null)
        {
            return NotFound(new
            {
                success = false,
                error = new { code = "NOT_FOUND", message = "Service notice not found" }
            });
        }

        // Disable HTTP caching
        Response.Headers.CacheControl = "no-store, no-cache, must-revalidate, proxy-revalidate";
        Response.Headers.Pragma = "no-cache";
        Response.Headers.Expires = "0";
        Response.Headers.Remove("ETag");

        return Ok(new { success = true, data = notice });
    }
}
