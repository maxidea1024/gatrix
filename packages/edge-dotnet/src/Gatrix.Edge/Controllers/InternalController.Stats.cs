using Gatrix.Edge.Services;
using Microsoft.AspNetCore.Mvc;

namespace Gatrix.Edge.Controllers;

public partial class InternalController : ControllerBase
{
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
