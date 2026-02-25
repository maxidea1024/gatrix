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

public partial class ClientController : ControllerBase
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

    private IActionResult PerformEvaluation(string environment, Models.ClientContext clientContext, bool isPost)
    {
        var context = new Dictionary<string, string>();
        var flagNames = new List<string>();

        if (isPost)
        {
            // Read body (already buffered by framework)
            using var reader = new StreamReader(Request.Body);
            var body = reader.ReadToEnd();
            if (!string.IsNullOrEmpty(body))
            {
                try
                {
                    var doc = JsonDocument.Parse(body);
                    if (doc.RootElement.TryGetProperty("context", out var ctxEl) &&
                        ctxEl.ValueKind == JsonValueKind.Object)
                    {
                        foreach (var prop in ctxEl.EnumerateObject())
                        {
                            context[prop.Name] = prop.Value.ToString();
                        }
                    }
                    if (doc.RootElement.TryGetProperty("flagNames", out var namesEl) &&
                        namesEl.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var n in namesEl.EnumerateArray())
                        {
                            var name = n.GetString();
                            if (name != null) flagNames.Add(name);
                        }
                    }
                    else if (doc.RootElement.TryGetProperty("keys", out var keysEl) &&
                             keysEl.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var n in keysEl.EnumerateArray())
                        {
                            var name = n.GetString();
                            if (name != null) flagNames.Add(name);
                        }
                    }
                }
                catch { /* ignore parse errors */ }
            }
        }
        else
        {
            // GET: context from header or query
            var contextHeader = Request.Headers["x-gatrix-feature-context"].FirstOrDefault();
            if (!string.IsNullOrEmpty(contextHeader))
            {
                try
                {
                    var json = Encoding.UTF8.GetString(Convert.FromBase64String(contextHeader));
                    var doc = JsonDocument.Parse(json);
                    foreach (var prop in doc.RootElement.EnumerateObject())
                        context[prop.Name] = prop.Value.ToString();
                }
                catch { /* ignore */ }
            }

            if (context.Count == 0 && Request.Query.ContainsKey("context"))
            {
                var contextStr = Request.Query["context"].ToString();
                try
                {
                    var json = Encoding.UTF8.GetString(Convert.FromBase64String(contextStr));
                    var doc = JsonDocument.Parse(json);
                    foreach (var prop in doc.RootElement.EnumerateObject())
                        context[prop.Name] = prop.Value.ToString();
                }
                catch
                {
                    try
                    {
                        var doc = JsonDocument.Parse(contextStr);
                        foreach (var prop in doc.RootElement.EnumerateObject())
                            context[prop.Name] = prop.Value.ToString();
                    }
                    catch { /* ignore */ }
                }
            }

            // Fallback individual params
            if (!context.ContainsKey("userId") && Request.Query.ContainsKey("userId"))
                context["userId"] = Request.Query["userId"]!;
            if (!context.ContainsKey("sessionId") && Request.Query.ContainsKey("sessionId"))
                context["sessionId"] = Request.Query["sessionId"]!;
            if (!context.ContainsKey("remoteAddress") && Request.Query.ContainsKey("remoteAddress"))
                context["remoteAddress"] = Request.Query["remoteAddress"]!;
            if (!context.ContainsKey("appName") && Request.Query.ContainsKey("appName"))
                context["appName"] = Request.Query["appName"]!;

            var flagNamesParam = Request.Query["flagNames"].FirstOrDefault();
            if (!string.IsNullOrEmpty(flagNamesParam))
                flagNames.AddRange(flagNamesParam.Split(','));
        }

        // Default context values
        if (!context.ContainsKey("appName"))
            context["appName"] = clientContext.ApplicationName;
        context["environment"] = environment;

        // Evaluate flags
        var cachedFlags = _flagCache.GetCached(environment);
        var segments = _flagCache.GetSegments();

        // 0. Resolve Context Hash & Cache Key
        var contextHash = Request.Headers["x-gatrix-context-hash"].FirstOrDefault();
        if (string.IsNullOrEmpty(contextHash))
        {
            var stableContext = context.OrderBy(kv => kv.Key).ToDictionary(kv => kv.Key, kv => kv.Value);
            contextHash = Convert.ToHexString(MD5.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(stableContext)))).ToLowerInvariant();
        }

        var flagNamesHash = flagNames.Count > 0
            ? Convert.ToHexString(MD5.HashData(Encoding.UTF8.GetBytes(string.Join(",", flagNames.OrderBy(n => n))))).ToLowerInvariant()
            : "all";

        // Build definitions hash for cache invalidation
        var defsMaterial = string.Join("|", cachedFlags.OrderBy(f => f.Name).Select(f => $"{f.Name}:{f.Version}"))
                           + "||" + string.Join("|", segments.OrderBy(s => s.Key).Select(s => $"{s.Key}:{s.Value.Id}"));
        var defsHash = Convert.ToHexString(MD5.HashData(Encoding.UTF8.GetBytes(defsMaterial))).ToLowerInvariant();

        var evalCacheKey = $"f_eval:{environment}:{contextHash}:{flagNamesHash}:{defsHash}";

        if (_evalCache.TryGetValue(evalCacheKey, out (string ETag, object Response) cached))
        {
            var reqEtag = Request.Headers.IfNoneMatch.FirstOrDefault();
            if (reqEtag == cached.ETag) return StatusCode(304);
            Response.Headers.ETag = cached.ETag;
            return Ok(cached.Response);
        }

        var keysToEvaluate = flagNames.Count > 0
            ? flagNames
            : cachedFlags.Select(f => f.Name).ToList();

        keysToEvaluate.Sort(StringComparer.Ordinal);

        var results = new List<object>();
        foreach (var key in keysToEvaluate)
        {
            var evalCtx = new Gatrix.Server.Sdk.Models.EvaluationContext();
            foreach (var kv in context)
            {
                if (kv.Key.Equals("userId", StringComparison.OrdinalIgnoreCase)) evalCtx.UserId = kv.Value;
                else if (kv.Key.Equals("sessionId", StringComparison.OrdinalIgnoreCase)) evalCtx.SessionId = kv.Value;
                else if (kv.Key.Equals("appName", StringComparison.OrdinalIgnoreCase)) evalCtx.AppName = kv.Value;
                else if (kv.Key.Equals("appVersion", StringComparison.OrdinalIgnoreCase)) evalCtx.AppVersion = kv.Value;
                else if (kv.Key.Equals("remoteAddress", StringComparison.OrdinalIgnoreCase)) evalCtx.RemoteAddress = kv.Value;
                else if (kv.Key.Equals("environment", StringComparison.OrdinalIgnoreCase)) evalCtx.Environment = kv.Value;
                else evalCtx.Properties[kv.Key] = kv.Value;
            }

            var result = _featureFlagService.Evaluate(key, evalCtx, environment);
            var flagDef = cachedFlags.FirstOrDefault(f => f.Name == key);

            var variantName = result.Variant?.Name ?? (result.Enabled ? "$default" : "$disabled");
            var variantEnabled = result.Enabled;
            object? variantValue = result.Variant?.Value;

            // Value type coercion
            var valueType = flagDef?.ValueType ?? "string";
            if (variantValue != null)
            {
                if (valueType == "json" && variantValue is string jsonStr && !string.IsNullOrWhiteSpace(jsonStr))
                {
                    try { variantValue = JsonSerializer.Deserialize<object>(jsonStr); }
                    catch { /* keep as string */ }
                }
                else if (valueType == "number" && variantValue is string numStr)
                {
                    if (double.TryParse(numStr, out var parsed))
                        variantValue = parsed;
                }
            }

            var flagResult = new Dictionary<string, object?>
            {
                ["id"] = result.Id,
                ["name"] = key,
                ["enabled"] = result.Enabled,
                ["variant"] = new Dictionary<string, object?>
                {
                    ["name"] = variantName,
                    ["enabled"] = variantEnabled,
                    ["value"] = variantValue
                },
                ["valueType"] = valueType,
                ["version"] = flagDef?.Version ?? 1,
            };

            if (flagDef?.ImpressionDataEnabled == true)
                flagResult["impressionData"] = true;

            results.Add(flagResult);
        }

        // Sort by id descending
        results = results.OrderByDescending(r =>
            (r as Dictionary<string, object?>)?["id"]?.ToString() ?? "").ToList();

        // Generate ETag
        var etagSource = string.Join("|", results.Select(r =>
        {
            var dict = r as Dictionary<string, object?>;
            if (dict == null) return "";
            var name = dict["name"];
            var version = dict["version"];
            var enabled = dict["enabled"]?.ToString()?.ToLowerInvariant();
            
            var variantPart = "no-variant";
            if (dict["variant"] is Dictionary<string, object?> variantDict)
            {
                variantPart = $"{variantDict["name"]}:{variantDict["enabled"]?.ToString()?.ToLowerInvariant()}";
            }
            
            return $"{name}:{version}:{enabled}:{variantPart}";
        }));
        var etagHash = Convert.ToHexString(MD5.HashData(Encoding.UTF8.GetBytes(contextHash + "|" + etagSource))).ToLowerInvariant();
        var etag = $"\"{etagHash}\"";

        var requestEtag = Request.Headers.IfNoneMatch.FirstOrDefault();
        if (requestEtag == etag)
            return StatusCode(304);

        var responseObj = new
        {
            success = true,
            data = new { flags = results },
            meta = new
            {
                environment,
                evaluatedAt = DateTime.UtcNow.ToString("o"),
            },
        };

        // Cache for 30 seconds
        _evalCache.Set(evalCacheKey, (etag, responseObj), TimeSpan.FromSeconds(30));

        Response.Headers.ETag = etag;

        return Ok(responseObj);
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
