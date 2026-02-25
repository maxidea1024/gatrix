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

/// <summary>
/// Client-facing API endpoints (cached data from SDK).
/// Routes: /api/v1/client/...
/// </summary>
[ApiController]
[Route("api/v1/client")]
public class ClientController : ControllerBase
{
    private readonly FlagDefinitionCache _flagCache;
    private readonly IFeatureFlagService _featureFlagService;
    private readonly MetricsAggregator _metricsAggregator;
    private readonly FlagStreamingService _flagStreaming;
    private readonly EdgeOptions _options;
    private readonly ILogger<ClientController> _logger;
    private readonly ICacheManager _cacheManager;

    public ClientController(
        FlagDefinitionCache flagCache,
        IFeatureFlagService featureFlagService,
        MetricsAggregator metricsAggregator,
        FlagStreamingService flagStreaming,
        IOptions<EdgeOptions> options,
        ILogger<ClientController> logger,
        ICacheManager cacheManager)
    {
        _flagCache = flagCache;
        _featureFlagService = featureFlagService;
        _metricsAggregator = metricsAggregator;
        _flagStreaming = flagStreaming;
        _options = options.Value;
        _logger = logger;
        _cacheManager = cacheManager;
    }

    // ========================================================================
    // Public Routes (No Authentication Required)
    // ========================================================================

    /// <summary>
    /// GET /api/v1/client/{environment}/client-version
    /// </summary>
    [HttpGet("{environment}/client-version")]
    public IActionResult GetClientVersion(string environment,
        [FromQuery] string? platform, [FromQuery] string? version,
        [FromQuery] string? status, [FromQuery] string? lang)
    {
        if (string.IsNullOrEmpty(platform))
            return BadRequest(new { success = false, message = "platform is a required query parameter" });

        var appName = Request.Headers["x-application-name"].FirstOrDefault();
        var apiToken = Request.Headers["x-api-token"].FirstOrDefault();

        if (string.IsNullOrEmpty(appName) || string.IsNullOrEmpty(apiToken))
            return BadRequest(new { success = false, message = "X-Application-Name and X-API-Token headers are required" });

        // Validate status
        var validStatuses = new[] { "ONLINE", "OFFLINE", "MAINTENANCE", "UPDATE_REQUIRED" };
        string? statusFilter = null;
        if (!string.IsNullOrEmpty(status))
        {
            var upper = status.ToUpperInvariant();
            if (!validStatuses.Contains(upper))
                return BadRequest(new { success = false, message = $"Invalid status. Valid values are: {string.Join(", ", validStatuses)}" });
            statusFilter = upper;
        }

        // Get from cache
        var envVersions = _cacheManager.GetClientVersions(environment);
        var platformVersions = envVersions
            .Where(v => v.Platform == platform || v.Platform == "all")
            .ToList();

        var isLatest = string.IsNullOrEmpty(version) || version.Equals("latest", StringComparison.OrdinalIgnoreCase);

        Gatrix.Server.Sdk.Models.ClientVersion? record = null;
        if (isLatest)
        {
            var candidates = statusFilter != null
                ? platformVersions.Where(v => v.ClientStatus == statusFilter)
                : platformVersions;
            record = candidates.OrderByDescending(v => v.Version, StringComparer.OrdinalIgnoreCase).FirstOrDefault();
        }
        else
        {
            record = platformVersions.FirstOrDefault(v => v.Version == version);
        }

        if (record == null)
        {
            return NotFound(new
            {
                success = false,
                message = isLatest
                    ? $"No client version found for platform: {platform}{(statusFilter != null ? $" with status: {statusFilter}" : "")}"
                    : "Client version not found",
            });
        }

        // Build response
        var clientData = new Dictionary<string, object?>
        {
            ["platform"] = record.Platform,
            ["clientVersion"] = record.Version,
            ["status"] = record.ClientStatus,
            ["gameServerAddress"] = record.GameServerAddress,
            ["patchAddress"] = record.PatchAddress,
            ["guestModeAllowed"] = record.ClientStatus == "MAINTENANCE" ? false : record.GuestModeAllowed,
            ["externalClickLink"] = record.ExternalClickLink,
            ["meta"] = record.CustomPayload ?? new Dictionary<string, object>(),
        };

        if (record.ClientStatus == "MAINTENANCE")
        {
            var maintenanceMsg = record.MaintenanceMessage;
            if (record.MaintenanceLocales?.Count > 0)
            {
                if (!string.IsNullOrEmpty(lang))
                {
                    var localeMsg = record.MaintenanceLocales.FirstOrDefault(m => m.Lang == lang);
                    if (localeMsg != null) maintenanceMsg = localeMsg.Message;
                }
                if (string.IsNullOrEmpty(maintenanceMsg) && record.MaintenanceLocales.Count > 0)
                    maintenanceMsg = record.MaintenanceLocales[0].Message;
            }
            clientData["maintenanceMessage"] = maintenanceMsg ?? "";
        }

        return Ok(new { success = true, data = clientData, cached = true });
    }

    /// <summary>
    /// GET /api/v1/client/{environment}/game-worlds
    /// </summary>
    [HttpGet("{environment}/game-worlds")]
    public IActionResult GetGameWorlds(string environment)
    {
        var envWorlds = _cacheManager.GetGameWorlds(environment);
        var visibleWorlds = envWorlds.Where(w => !w.IsMaintenance).ToList();

        var clientData = new
        {
            worlds = visibleWorlds.Select(w => new
            {
                w.Id,
                w.WorldId,
                w.Name,
                description = "",
                w.DisplayOrder,
                meta = w.CustomPayload ?? new Dictionary<string, object>(),
                w.CreatedAt,
                updatedAt = w.CreatedAt,
            }),
            total = visibleWorlds.Count,
            timestamp = DateTime.UtcNow.ToString("o"),
        };

        return Ok(new { success = true, data = clientData, cached = true });
    }

    /// <summary>
    /// GET /api/v1/client/cache-stats
    /// </summary>
    [HttpGet("cache-stats")]
    public IActionResult GetCacheStats()
    {
        return Ok(new
        {
            success = true,
            data = new
            {
                cache = new { initialized = true, type = "edge-sdk-cache" },
                queue = new { pending = 0 },
                pubsub = new { connected = true, timestamp = DateTime.UtcNow.ToString("o") },
            },
        });
    }

    // ========================================================================
    // Authenticated Routes (Require ClientAuth)
    // ========================================================================

    /// <summary>
    /// GET /api/v1/client/{environment}/test
    /// </summary>
    [HttpGet("{environment}/test")]
    [ServiceFilter(typeof(ClientAuthMiddleware), IsReusable = false)]
    public IActionResult TestAuth(string environment)
    {
        var ctx = HttpContext.GetClientContext()!;
        return Ok(new
        {
            success = true,
            message = "Client SDK authentication successful",
            data = new
            {
                tokenId = "edge-token",
                tokenName = ctx.ApplicationName,
                tokenType = "client",
                environment = ctx.Environment,
                timestamp = DateTime.UtcNow.ToString("o"),
            },
        });
    }

    /// <summary>
    /// GET /api/v1/client/{environment}/banners
    /// </summary>
    [HttpGet("{environment}/banners")]
    public IActionResult GetBanners(string environment)
    {
        var ctx = HttpContext.GetClientContext();
        var env = ctx?.Environment ?? environment;

        var envBanners = _cacheManager.GetBanners(env);
        var clientBanners = envBanners.Select(b => new
        {
            b.BannerId,
            b.Name,
            b.Width,
            b.Height,
            b.PlaybackSpeed,
            b.Sequences,
            b.Metadata,
            b.Version,
        });

        return Ok(new
        {
            success = true,
            data = new
            {
                banners = clientBanners,
                timestamp = DateTime.UtcNow.ToString("o"),
            },
        });
    }

    /// <summary>
    /// GET /api/v1/client/{environment}/banners/{bannerId}
    /// </summary>
    [HttpGet("{environment}/banners/{bannerId}")]
    public IActionResult GetBanner(string environment, string bannerId)
    {
        var ctx = HttpContext.GetClientContext();
        var env = ctx?.Environment ?? environment;

        var envBanners = _cacheManager.GetBanners(env);
        var banner = envBanners.FirstOrDefault(b => b.BannerId == bannerId);

        if (banner == null)
            return NotFound(new { success = false, error = new { code = "NOT_FOUND", message = "Banner not found" } });

        return Ok(new
        {
            success = true,
            data = new
            {
                banner = new
                {
                    banner.BannerId,
                    banner.Name,
                    banner.Width,
                    banner.Height,
                    banner.PlaybackSpeed,
                    banner.Sequences,
                    banner.Metadata,
                    banner.Version,
                },
                timestamp = DateTime.UtcNow.ToString("o"),
            },
        });
    }

    /// <summary>
    /// GET /api/v1/client/{environment}/client-versions
    /// </summary>
    [HttpGet("{environment}/client-versions")]
    public IActionResult GetClientVersions(string environment)
    {
        var ctx = HttpContext.GetClientContext();
        var env = ctx?.Environment ?? environment;

        var envVersions = _cacheManager.GetClientVersions(env);

        // Optionally filter by platform
        var platform = ctx?.Platform;
        var filtered = platform != null
            ? envVersions.Where(v => v.Platform == platform || v.Platform == "all").ToList()
            : envVersions;

        return Ok(new
        {
            success = true,
            data = new { versions = filtered, total = filtered.Count },
        });
    }

    /// <summary>
    /// GET /api/v1/client/{environment}/service-notices
    /// </summary>
    [HttpGet("{environment}/service-notices")]
    public IActionResult GetServiceNotices(string environment)
    {
        var ctx = HttpContext.GetClientContext();
        var env = ctx?.Environment ?? environment;

        var envNotices = _cacheManager.GetServiceNotices(env);

        // Optionally filter by platform
        var platform = ctx?.Platform;
        var filtered = platform != null
            ? envNotices.Where(n => n.Platforms == null || n.Platforms.Count == 0 || n.Platforms.Contains(platform)).ToList()
            : envNotices;

        return Ok(new
        {
            success = true,
            data = new { notices = filtered, total = filtered.Count },
        });
    }

    /// <summary>
    /// POST /api/v1/client/{environment}/crashes/upload — Proxy to backend
    /// </summary>
    [HttpPost("{environment}/crashes/upload")]
    public async Task<IActionResult> UploadCrash(string environment)
    {
        var ctx = HttpContext.GetClientContext();
        var env = ctx?.Environment ?? environment;

        var clientIp = Request.Headers["X-Forwarded-For"].FirstOrDefault()
                    ?? HttpContext.Connection.RemoteIpAddress?.ToString()
                    ?? "unknown";
        var userAgent = Request.Headers.UserAgent.FirstOrDefault() ?? "unknown";

        try
        {
            using var reader = new StreamReader(Request.Body);
            var body = await reader.ReadToEndAsync();

            var httpClient = HttpContext.RequestServices.GetRequiredService<IHttpClientFactory>()
                .CreateClient("GatrixBackend");

            var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/client/crashes/upload")
            {
                Content = new StringContent(body, Encoding.UTF8, "application/json")
            };
            request.Headers.Add("x-api-token", _options.ApiToken);
            request.Headers.Add("x-application-name", _options.ApplicationName);
            request.Headers.Add("x-environment", env);
            request.Headers.Add("x-forwarded-for", clientIp);
            request.Headers.Add("user-agent", userAgent);

            var response = await httpClient.SendAsync(request);
            var responseBody = await response.Content.ReadAsStringAsync();

            return StatusCode((int)response.StatusCode, JsonSerializer.Deserialize<object>(responseBody));
        }
        catch (HttpRequestException)
        {
            return StatusCode(503, new
            {
                success = false,
                error = new { code = "SERVICE_UNAVAILABLE", message = "Failed to connect to backend server" }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error in crash upload proxy");
            return StatusCode(500, new
            {
                success = false,
                error = new { code = "INTERNAL_SERVER_ERROR", message = "Failed to process crash upload" }
            });
        }
    }

    // ========================================================================
    // Feature Flag Routes
    // ========================================================================

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
                ["variant"] = new { name = variantName, enabled = variantEnabled, value = variantValue },
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
            return $"{dict?["name"]}:{dict?["version"]}:{dict?["enabled"]}";
        }));
        var etagHash = Convert.ToHexString(MD5.HashData(Encoding.UTF8.GetBytes(etagSource))).ToLowerInvariant();
        var etag = $"\"{etagHash}\"";

        // Check If-None-Match
        var requestEtag = Request.Headers.IfNoneMatch.FirstOrDefault();
        if (requestEtag == etag)
            return StatusCode(304);

        Response.Headers.ETag = etag;

        return Ok(new
        {
            success = true,
            data = new { flags = results },
            meta = new
            {
                environment,
                evaluatedAt = DateTime.UtcNow.ToString("o"),
            },
        });
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
                return BadRequest(new { success = false, error = "bucket is required" });

            var sdkVersion = Request.Headers["x-sdk-version"].FirstOrDefault();
            if (string.IsNullOrEmpty(sdkVersion) && doc.RootElement.TryGetProperty("sdkVersion", out var sv))
                sdkVersion = sv.GetString();

            _metricsAggregator.AddClientMetrics(ctx.Environment, ctx.ApplicationName, bucket, sdkVersion);
            return Ok(new { success = true, buffered = true });
        }
        catch (JsonException)
        {
            return BadRequest(new { success = false, error = "Invalid JSON" });
        }
    }
}
