namespace Gatrix.Edge.Models;

/// <summary>
/// Client request context set by authentication middleware.
/// Stored in HttpContext.Items["ClientContext"].
/// </summary>
public class ClientContext
{
    public string ApiToken { get; set; } = string.Empty;
    public string ApplicationName { get; set; } = string.Empty;

    /// <summary>
    /// Environment identifier (environmentName value).
    /// </summary>
    public string Environment { get; set; } = string.Empty;

    public string? ClientVersion { get; set; }
    public string? Platform { get; set; }
    public string? TokenName { get; set; }
}
