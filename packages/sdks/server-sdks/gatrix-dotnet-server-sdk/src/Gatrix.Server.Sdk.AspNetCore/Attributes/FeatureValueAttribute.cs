using Gatrix.Server.Sdk.Context;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.DependencyInjection;

namespace Gatrix.Server.Sdk.AspNetCore.Attributes;

/// <summary>
/// Action filter that injects a feature flag's string value into an action parameter.
/// If the flag is not found, the parameter's default value is used.
/// </summary>
/// <example>
/// [HttpGet("api/config")]
/// public IActionResult GetConfig([FeatureValue("ui-theme")] string theme = "default")
/// {
///     return Ok(new { theme });
/// }
/// </example>
[AttributeUsage(AttributeTargets.Parameter)]
public class FeatureValueAttribute : ActionFilterAttribute
{
    private readonly string _flagName;

    public FeatureValueAttribute(string flagName)
    {
        _flagName = flagName;
    }

    public override void OnActionExecuting(ActionExecutingContext context)
    {
        var sdk = context.HttpContext.RequestServices.GetService<IGatrixServerSdk>();
        if (sdk is null) return;

        var ambientCtx = context.HttpContext.RequestServices.GetService<GatrixAmbientContext>();
        var evalCtx = ambientCtx?.CurrentContext;

        var value = sdk.FeatureFlag.StringVariation(_flagName, fallback: string.Empty, context: evalCtx);

        // Find the parameter decorated with this attribute and set its value
        foreach (var param in context.ActionDescriptor.Parameters)
        {
            if (context.ActionArguments.ContainsKey(param.Name))
            {
                // Only override if the flag returned a non-empty value
                if (!string.IsNullOrEmpty(value))
                {
                    context.ActionArguments[param.Name] = value;
                }
            }
        }
    }
}
