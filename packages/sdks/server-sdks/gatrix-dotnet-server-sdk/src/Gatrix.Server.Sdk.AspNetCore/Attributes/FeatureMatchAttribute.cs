using Gatrix.Server.Sdk.Context;
using Gatrix.Server.Sdk.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.DependencyInjection;

namespace Gatrix.Server.Sdk.AspNetCore.Attributes;

/// <summary>
/// Action filter that only allows requests when a flag's variant matches.
/// Returns 404 if the variant doesn't match or flag is disabled.
/// </summary>
/// <example>
/// [FeatureMatch("checkout-flow", "v2")]
/// [HttpPost("api/checkout")]
/// public IActionResult CheckoutV2() { ... }
/// </example>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
public class FeatureMatchAttribute : ActionFilterAttribute
{
    private readonly string _flagName;
    private readonly string _variantName;

    public FeatureMatchAttribute(string flagName, string variantName)
    {
        _flagName = flagName;
        _variantName = variantName;
    }

    public override void OnActionExecuting(ActionExecutingContext context)
    {
        var sdk = context.HttpContext.RequestServices.GetService<IGatrixServerSdk>();
        if (sdk is null)
        {
            context.Result = new NotFoundResult();
            return;
        }

        var ambientCtx = context.HttpContext.RequestServices.GetService<GatrixAmbientContext>();
        var evalCtx = ambientCtx?.CurrentContext;

        var result = sdk.FeatureFlag.Evaluate(_flagName, evalCtx);

        if (!result.Enabled || result.Variant.Name != _variantName)
        {
            context.Result = new NotFoundResult();
        }
    }
}
