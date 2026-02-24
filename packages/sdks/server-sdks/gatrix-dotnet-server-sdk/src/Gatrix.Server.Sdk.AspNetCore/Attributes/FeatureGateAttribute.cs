using Gatrix.Server.Sdk.Context;
using Gatrix.Server.Sdk.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.DependencyInjection;

namespace Gatrix.Server.Sdk.AspNetCore.Attributes;

/// <summary>
/// Action filter that gates access based on a feature flag.
/// Returns 404 if the flag is disabled or not found.
/// </summary>
/// <example>
/// [FeatureGate("premium-tier")]
/// [HttpGet("api/premium")]
/// public IActionResult GetPremium() { ... }
/// </example>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
public class FeatureGateAttribute : ActionFilterAttribute
{
    private readonly string _flagName;

    public FeatureGateAttribute(string flagName)
    {
        _flagName = flagName;
    }

    public override void OnActionExecuting(ActionExecutingContext context)
    {
        var sdk = context.HttpContext.RequestServices.GetService<IGatrixServerSdk>();
        if (sdk is null)
        {
            // SDK not configured — deny by default for safety
            context.Result = new NotFoundResult();
            return;
        }

        var ambientCtx = context.HttpContext.RequestServices.GetService<GatrixAmbientContext>();
        var evalCtx = ambientCtx?.CurrentContext;

        if (!sdk.FeatureFlag.IsEnabled(_flagName, evalCtx))
        {
            context.Result = new NotFoundResult();
        }
    }
}
