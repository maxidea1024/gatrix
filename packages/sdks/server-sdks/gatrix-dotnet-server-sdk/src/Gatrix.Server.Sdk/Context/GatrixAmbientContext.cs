using Gatrix.Server.Sdk.Models;

namespace Gatrix.Server.Sdk.Context;

/// <summary>
/// Scoped ambient context for Gatrix evaluation.
/// In ASP.NET Core, registered as Scoped so each HTTP request gets its own instance.
/// Middleware populates this from HttpContext (Claims, Headers, etc.).
/// </summary>
public class GatrixAmbientContext
{
    public EvaluationContext CurrentContext { get; set; } = new();
}
