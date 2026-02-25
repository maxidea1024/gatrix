using System.Text.Json;
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
public class ServerController : ControllerBase
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

    private IActionResult? ValidateServerAuth(string? environment = null)
    {
        var apiToken = Request.Headers["x-api-token"].FirstOrDefault();
        if (string.IsNullOrEmpty(apiToken))
            return Unauthorized(new { success = false, error = "x-api-token header is required" });

        var validation = _tokenMirror.ValidateToken(apiToken, "server", environment);
        if (!validation.Valid)
            return Unauthorized(new { success = false, error = "Invalid or unauthorized server API token" });

        return null; // auth passed
    }

    /// <summary>
    /// GET /api/v1/server/{env}/features
    /// </summary>
    [HttpGet("{env}/features")]
    public IActionResult GetFeatures(string env)
    {
        var authError = ValidateServerAuth(env);
        if (authError != null) return authError;

        var flags = _flagCache.GetCached(env);
        var segments = _flagCache.GetSegments();

        return Ok(new
        {
            success = true,
            data = new { flags, segments },
            cached = true,
        });
    }

    /// <summary>
    /// GET /api/v1/server/segments
    /// </summary>
    [HttpGet("segments")]
    public IActionResult GetSegments()
    {
        var authError = ValidateServerAuth();
        if (authError != null) return authError;

        var segments = _flagCache.GetSegments();

        return Ok(new
        {
            success = true,
            data = new { segments },
            cached = true,
        });
    }

    /// <summary>
    /// POST /api/v1/server/{env}/features/metrics
    /// </summary>
    [HttpPost("{env}/features/metrics")]
    public async Task<IActionResult> PostMetrics(string env)
    {
        var authError = ValidateServerAuth(env);
        if (authError != null) return authError;

        var appName = Request.Headers["x-application-name"].FirstOrDefault() ?? "unknown";
        var sdkVersion = Request.Headers["x-sdk-version"].FirstOrDefault();

        using var reader = new StreamReader(Request.Body);
        var body = await reader.ReadToEndAsync();

        try
        {
            var doc = JsonDocument.Parse(body);
            if (!doc.RootElement.TryGetProperty("metrics", out var metrics) ||
                metrics.ValueKind != JsonValueKind.Array)
            {
                return BadRequest(new { success = false, error = "metrics must be an array" });
            }

            _metricsAggregator.AddServerMetrics(env, appName, metrics, sdkVersion);
            return Ok(new { success = true, buffered = true });
        }
        catch (JsonException)
        {
            return BadRequest(new { success = false, error = "Invalid JSON" });
        }
    }

    /// <summary>
    /// POST /api/v1/server/{env}/features/unknown
    /// </summary>
    [HttpPost("{env}/features/unknown")]
    public async Task<IActionResult> PostUnknown(string env)
    {
        var authError = ValidateServerAuth(env);
        if (authError != null) return authError;

        var appName = Request.Headers["x-application-name"].FirstOrDefault() ?? "unknown";
        var sdkVersion = Request.Headers["x-sdk-version"].FirstOrDefault();

        using var reader = new StreamReader(Request.Body);
        var body = await reader.ReadToEndAsync();

        try
        {
            var doc = JsonDocument.Parse(body);
            if (!doc.RootElement.TryGetProperty("flagName", out var flagNameEl))
                return BadRequest(new { success = false, error = "flagName is required" });

            var flagName = flagNameEl.GetString() ?? "";
            var count = doc.RootElement.TryGetProperty("count", out var countEl) ? countEl.GetInt32() : 1;

            _metricsAggregator.AddServerUnknownReport(env, appName, flagName, count, sdkVersion);
            return Ok(new { success = true, buffered = true });
        }
        catch (JsonException)
        {
            return BadRequest(new { success = false, error = "Invalid JSON" });
        }
    }
}
