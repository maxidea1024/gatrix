using Gatrix.Server.Sdk.AspNetCore.Middleware;
using Microsoft.AspNetCore.Builder;

namespace Gatrix.Server.Sdk.AspNetCore.Extensions;

/// <summary>
/// Extension methods for IApplicationBuilder to add Gatrix middleware.
/// </summary>
public static class ApplicationBuilderExtensions
{
    /// <summary>
    /// Add Gatrix context extraction middleware.
    /// Call before any middleware or controllers that use feature flags.
    /// </summary>
    /// <example>
    /// app.UseGatrixContext();
    /// </example>
    public static IApplicationBuilder UseGatrixContext(this IApplicationBuilder app)
    {
        return app.UseMiddleware<GatrixContextMiddleware>();
    }
}
