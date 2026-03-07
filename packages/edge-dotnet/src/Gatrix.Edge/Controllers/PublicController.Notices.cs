using Gatrix.Edge.Middleware;
using Gatrix.Server.Sdk.Cache;
using Microsoft.AspNetCore.Mvc;

namespace Gatrix.Edge.Controllers;

public partial class PublicController : ControllerBase
{
    /// <summary>
    /// GET /public/service-notices
    /// Environment resolved from token.
    /// </summary>
    [HttpGet("service-notices")]
    public IActionResult GetServiceNotices([FromQuery] string? platform, [FromQuery] string? fields)
    {
        var ctx = HttpContext.GetClientContext()!;
        var environmentId = ctx.Environment;
        var envNotices = _cacheManager.GetServiceNotices(environmentId);

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
            environmentId, platform, filtered.Count);

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
    /// GET /public/service-notices/{noticeId}
    /// </summary>
    [HttpGet("service-notices/{noticeId:int}")]
    public IActionResult GetServiceNotice(int noticeId)
    {
        var ctx = HttpContext.GetClientContext()!;
        var environmentId = ctx.Environment;
        var envNotices = _cacheManager.GetServiceNotices(environmentId);
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
