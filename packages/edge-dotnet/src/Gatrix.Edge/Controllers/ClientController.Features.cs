using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Gatrix.Edge.Middleware;
using Gatrix.Edge.Options;
using Gatrix.Edge.Services;
using Gatrix.Server.Sdk.Cache;
using Gatrix.Server.Sdk.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace Gatrix.Edge.Controllers;

public partial class ClientController : GatrixControllerBase
{
    // ===================================
    // Feature Flag Routes & Evaluation
    // ===================================

    /// <summary>
    /// POST /api/v1/client/features/{environment}/eval
    /// </summary>
    [HttpPost("features/{environment}/eval")]
    public IActionResult EvalFlagsPost(string environment)
    {
        var ctx = HttpContext.GetClientContext()!;
        return PerformEvaluation(environment, ctx, isPost: true);
    }

    /// <summary>
    /// GET /api/v1/client/features/{environment}/eval
    /// </summary>
    [HttpGet("features/{environment}/eval")]
    public IActionResult EvalFlagsGet(string environment)
    {
        var ctx = HttpContext.GetClientContext()!;
        return PerformEvaluation(environment, ctx, isPost: false);
    }


    /// <summary>
    /// GET /api/v1/client/features/{environment}/stream/sse — SSE streaming
    /// </summary>
    [HttpGet("features/{environment}/stream/sse")]
    public async Task StreamFlags(string environment)
    {
        var ctx = HttpContext.GetClientContext()!;
        var clientId = $"edge-flag-stream-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}-{Guid.NewGuid():N}"[..40];

        await _flagStreaming.AddSseClientAsync(clientId, ctx.Environment, Response);

        // Keep connection alive until client disconnects
        var tcs = new TaskCompletionSource();
        HttpContext.RequestAborted.Register(() =>
        {
            _flagStreaming.RemoveSseClient(clientId);
            tcs.TrySetResult();
        });
        await tcs.Task;
    }

    /// <summary>
    /// POST /api/v1/client/features/{environment}/metrics — Buffered metrics
    /// </summary>
    [HttpPost("features/{environment}/metrics")]
    public async Task<IActionResult> PostMetrics(string environment)
    {
        var ctx = HttpContext.GetClientContext()!;

        using var reader = new StreamReader(Request.Body);
        var body = await reader.ReadToEndAsync();

        try
        {
            var doc = JsonDocument.Parse(body);
            if (!doc.RootElement.TryGetProperty("bucket", out var bucket))
            {
                return BadRequest(new { success = false, error = "bucket is required" });
            }

            var sdkVersion = Request.Headers["x-sdk-version"].FirstOrDefault();
            if (string.IsNullOrEmpty(sdkVersion) && doc.RootElement.TryGetProperty("sdkVersion", out var sv))
            {
                sdkVersion = sv.GetString();
            }

            _metricsAggregator.AddClientMetrics(ctx.Environment, ctx.ApplicationName, bucket, sdkVersion);
            return Ok(new { success = true, buffered = true });
        }
        catch (JsonException)
        {
            return BadRequest(new { success = false, error = "Invalid JSON" });
        }
    }
}
