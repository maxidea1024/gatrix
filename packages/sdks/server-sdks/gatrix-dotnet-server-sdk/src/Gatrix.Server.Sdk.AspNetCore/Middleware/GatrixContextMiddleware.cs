using Gatrix.Server.Sdk.Context;
using Gatrix.Server.Sdk.Models;
using Microsoft.AspNetCore.Http;

namespace Gatrix.Server.Sdk.AspNetCore.Middleware;

/// <summary>
/// Middleware that populates GatrixAmbientContext from HttpContext.
/// Extracts UserId from Claims and copies all claims into Properties.
/// </summary>
public class GatrixContextMiddleware
{
    private readonly RequestDelegate _next;

    public GatrixContextMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext httpContext, GatrixAmbientContext ambientContext)
    {
        // Extract user context from Claims
        if (httpContext.User?.Identity?.IsAuthenticated == true)
        {
            ambientContext.CurrentContext.UserId = httpContext.User.Identity.Name;

            foreach (var claim in httpContext.User.Claims)
            {
                ambientContext.CurrentContext.Properties[claim.Type] = claim.Value;
            }
        }

        // Extract remote address
        ambientContext.CurrentContext.RemoteAddress = httpContext.Connection.RemoteIpAddress?.ToString();

        // Set current time
        ambientContext.CurrentContext.CurrentTime = DateTime.UtcNow;

        await _next(httpContext);
    }
}
