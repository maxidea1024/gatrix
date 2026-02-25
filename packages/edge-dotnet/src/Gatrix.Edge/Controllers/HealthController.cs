using Gatrix.Edge.Services;
using Microsoft.AspNetCore.Mvc;

namespace Gatrix.Edge.Controllers;

/// <summary>
/// Health check endpoints.
/// </summary>
[ApiController]
[Route("health")]
public class HealthController : ControllerBase
{
    private readonly TokenMirrorService _tokenMirror;

    public HealthController(TokenMirrorService tokenMirror)
    {
        _tokenMirror = tokenMirror;
    }

    /// <summary>
    /// GET /health
    /// </summary>
    [HttpGet]
    public IActionResult GetHealth()
    {
        var isTokenMirrorReady = _tokenMirror.IsInitialized;
        // SDK readiness is inferred from CacheManager being started (it's an IHostedService)
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
    /// GET /health/ready
    /// </summary>
    [HttpGet("ready")]
    public IActionResult GetReady()
    {
        var isReady = _tokenMirror.IsInitialized;

        if (isReady)
            return Ok(new { status = "ready", timestamp = DateTime.UtcNow.ToString("o") });

        return StatusCode(503, new
        {
            status = "not_ready",
            message = "Services not initialized",
            timestamp = DateTime.UtcNow.ToString("o"),
        });
    }

    /// <summary>
    /// GET /health/live
    /// </summary>
    [HttpGet("live")]
    public IActionResult GetLive()
    {
        return Ok(new { status = "alive", timestamp = DateTime.UtcNow.ToString("o") });
    }
}
