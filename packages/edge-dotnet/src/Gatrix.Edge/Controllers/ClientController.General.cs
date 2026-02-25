using System.Text.Json;
using Gatrix.Edge.Middleware;
using Microsoft.AspNetCore.Mvc;

namespace Gatrix.Edge.Controllers;

public partial class ClientController : ControllerBase
{
    // =============================
    // General Public & Meta Routes
    // =============================

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
}
