using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Gatrix.Edge.Models;
using Gatrix.Edge.Services;
using Gatrix.Server.Sdk.Cache;
using Gatrix.Server.Sdk.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;

namespace Gatrix.Edge.Controllers;

/// <summary>
/// Common base class for controllers that need feature evaluation capabilities.
/// </summary>
public abstract class GatrixControllerBase : ControllerBase
{
    protected readonly FlagDefinitionCache _flagCache;
    protected readonly IFeatureFlagService _featureFlagService;
    protected readonly IMemoryCache _evalCache;
    protected readonly MetricsAggregator _metricsAggregator;

    protected GatrixControllerBase(
        FlagDefinitionCache flagCache,
        IFeatureFlagService featureFlagService,
        IMemoryCache evalCache,
        MetricsAggregator metricsAggregator)
    {
        _flagCache = flagCache;
        _featureFlagService = featureFlagService;
        _evalCache = evalCache;
        _metricsAggregator = metricsAggregator;
    }

    protected IActionResult PerformEvaluation(string environmentId, ClientContext clientContext, bool isPost)
    {
        var context = new Dictionary<string, string>();
        var flagNames = new List<string>();

        if (isPost)
        {
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
                            context[prop.Name] = prop.Value.ToString();
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
                catch { }
            }
        }
        else
        {
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
                catch { }
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
                    catch { }
                }
            }

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

        if (!context.ContainsKey("appName"))
            context["appName"] = clientContext.ApplicationName;
        context["environment"] = environmentId;

        var cachedFlags = _flagCache.GetCached(environmentId);
        var segments = _flagCache.GetSegments();

        var contextHash = Request.Headers["x-gatrix-context-hash"].FirstOrDefault();
        if (string.IsNullOrEmpty(contextHash))
        {
            var stableContext = context.OrderBy(kv => kv.Key).ToDictionary(kv => kv.Key, kv => kv.Value);
            contextHash = Convert.ToHexString(MD5.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(stableContext)))).ToLowerInvariant();
        }

        var flagNamesHash = flagNames.Count > 0
            ? Convert.ToHexString(MD5.HashData(Encoding.UTF8.GetBytes(string.Join(",", flagNames.OrderBy(n => n))))).ToLowerInvariant()
            : "all";

        var defsMaterial = string.Join("|", cachedFlags.OrderBy(f => f.Name).Select(f => $"{f.Name}:{f.Version}"))
                           + "||" + string.Join("|", segments.OrderBy(s => s.Key).Select(s => $"{s.Key}:{s.Value.Id}"));
        var defsHash = Convert.ToHexString(MD5.HashData(Encoding.UTF8.GetBytes(defsMaterial))).ToLowerInvariant();

        var cachePrefix = this is ClientController ? "c" : "s";
        var evalCacheKey = $"{cachePrefix}_eval:{environmentId}:{contextHash}:{flagNamesHash}:{defsHash}";

        if (_evalCache.TryGetValue(evalCacheKey, out (string ETag, object Response) cached))
        {
            var reqEtag = Request.Headers.IfNoneMatch.FirstOrDefault();
            if (reqEtag == cached.ETag) return StatusCode(304);
            Response.Headers.ETag = cached.ETag;
            return Ok(cached.Response);
        }

        var keysToEvaluate = flagNames.Count > 0 ? flagNames : cachedFlags.Select(f => f.Name).ToList();
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

            var result = _featureFlagService.Evaluate(key, evalCtx, environmentId);
            var flagDef = cachedFlags.FirstOrDefault(f => f.Name == key);

            var variantName = result.Variant?.Name ?? (result.Enabled ? "$default" : "$disabled");
            var variantEnabled = result.Enabled;
            object? variantValue = result.Variant?.Value;

            var valueType = flagDef?.ValueType ?? "string";
            if (variantValue != null)
            {
                if (valueType == "json" && variantValue is string jsonStr && !string.IsNullOrWhiteSpace(jsonStr))
                {
                    try { variantValue = JsonSerializer.Deserialize<object>(jsonStr); } catch { }
                }
                else if (valueType == "number" && variantValue is string numStr)
                {
                    if (double.TryParse(numStr, out var parsed)) variantValue = parsed;
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

            if (flagDef?.ImpressionDataEnabled == true) flagResult["impressionData"] = true;
            results.Add(flagResult);
        }

        results = results.OrderByDescending(r => (r as Dictionary<string, object?>)?["id"]?.ToString() ?? "").ToList();

        var etagSource = string.Join("|", results.Select(r =>
        {
            var dict = r as Dictionary<string, object?>;
            if (dict == null) return "";
            var name = dict["name"];
            var version = dict["version"];
            var enabled = dict["enabled"]?.ToString()?.ToLowerInvariant();
            var variantPart = "no-variant";
            if (dict["variant"] is Dictionary<string, object?> variantDict)
                variantPart = $"{variantDict["name"]}:{variantDict["enabled"]?.ToString()?.ToLowerInvariant()}";
            return $"{name}:{version}:{enabled}:{variantPart}";
        }));
        var etagHash = Convert.ToHexString(MD5.HashData(Encoding.UTF8.GetBytes(contextHash + "|" + etagSource))).ToLowerInvariant();
        var etag = $"\"{etagHash}\"";

        var requestEtag = Request.Headers.IfNoneMatch.FirstOrDefault();
        if (requestEtag == etag) return StatusCode(304);

        var responseObj = new
        {
            success = true,
            data = new { flags = results },
            meta = new { environment = environmentId, evaluatedAt = DateTime.UtcNow.ToString("o") },
        };

        _evalCache.Set(evalCacheKey, (etag, responseObj), TimeSpan.FromSeconds(30));
        Response.Headers.ETag = etag;
        return Ok(responseObj);
    }
}
