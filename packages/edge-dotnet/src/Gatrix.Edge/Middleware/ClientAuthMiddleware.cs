using Gatrix.Edge.Models;
using Gatrix.Edge.Services;

namespace Gatrix.Edge.Middleware;

/// <summary>
/// Client authentication middleware.
/// Validates API token and resolves environment from token.
/// Applied via UseWhen() on routes that require client auth.
/// </summary>
public class ClientAuthMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ClientAuthMiddleware> _logger;

    private const string UnsecuredClientToken = "gatrix-unsecured-client-api-token";
    private const string UnsecuredServerToken = "gatrix-unsecured-server-api-token";
    private const string UnsecuredEdgeToken = "gatrix-unsecured-edge-api-token";

    public ClientAuthMiddleware(RequestDelegate next, ILogger<ClientAuthMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, TokenMirrorService tokenMirror, TokenUsageTracker usageTracker)
    {
        // Extract token from multiple sources
        string? apiToken = context.Request.Headers["x-api-token"].FirstOrDefault();

        if (string.IsNullOrEmpty(apiToken))
        {
            var authHeader = context.Request.Headers.Authorization.FirstOrDefault();
            if (authHeader?.StartsWith("Bearer ") == true)
                apiToken = authHeader[7..];
        }

        if (string.IsNullOrEmpty(apiToken))
            apiToken = context.Request.Query["token"].FirstOrDefault()
                    ?? context.Request.Query["apiToken"].FirstOrDefault();

        // Application name
        var applicationName = context.Request.Headers["x-application-name"].FirstOrDefault()
                           ?? context.Request.Query["appName"].FirstOrDefault()
                           ?? context.Request.Query["applicationName"].FirstOrDefault();

        var clientVersion = context.Request.Headers["x-client-version"].FirstOrDefault();
        var platform = context.Request.Headers["x-platform"].FirstOrDefault();

        // Validate required params
        if (string.IsNullOrEmpty(apiToken))
        {
            _logger.LogWarning("Missing API token in client request: {Url}", context.Request.Path);
            context.Response.StatusCode = 401;
            await context.Response.WriteAsJsonAsync(new
            {
                success = false,
                error = new { code = "MISSING_API_TOKEN", message = "x-api-token header or token query parameter is required" }
            });
            return;
        }

        if (string.IsNullOrEmpty(applicationName))
        {
            _logger.LogWarning("Missing application name in client request: {Url}", context.Request.Path);
            context.Response.StatusCode = 401;
            await context.Response.WriteAsJsonAsync(new
            {
                success = false,
                error = new { code = "MISSING_APPLICATION_NAME", message = "x-application-name header or appName query parameter is required" }
            });
            return;
        }

        // Handle unsecured tokens — use 'development' as default environment
        if (apiToken == UnsecuredClientToken || apiToken == UnsecuredServerToken || apiToken == UnsecuredEdgeToken)
        {
            context.Items["ClientContext"] = new ClientContext
            {
                ApiToken = apiToken,
                ApplicationName = applicationName,
                Environment = "development",
                ClientVersion = clientVersion,
                Platform = platform,
                TokenName = "Unsecured Testing Token",
            };
            _logger.LogDebug("Authenticated with unsecured token: {Token}", apiToken);
            await _next(context);
            return;
        }

        // Validate API token — environment is resolved from token, not URL
        var validation = tokenMirror.ValidateToken(apiToken, "client");

        if (!validation.Valid)
        {
            var errorMap = new Dictionary<string, (string Code, string Message)>
            {
                ["not_found"] = ("INVALID_TOKEN", "Invalid API token"),
                ["expired"] = ("TOKEN_EXPIRED", "API token has expired"),
                ["invalid_type"] = ("INVALID_TOKEN_TYPE", "Token is not authorized for client API access"),
                ["invalid_environment"] = ("INVALID_ENVIRONMENT", "Token is not authorized for this environment"),
            };

            var (code, message) = errorMap.GetValueOrDefault(validation.Reason ?? "not_found",
                ("INVALID_TOKEN", "Invalid API token"));

            _logger.LogWarning("Client auth failed: reason={Reason}, app={App}",
                validation.Reason, applicationName);

            context.Response.StatusCode = 401;
            await context.Response.WriteAsJsonAsync(new
            {
                success = false,
                error = new { code, message }
            });
            return;
        }

        // Resolve environment from token
        var token = validation.Token!;
        string environmentId;

        if (token.AllowAllEnvironments || (token.Environments.Count == 1 && token.Environments[0] == "*"))
        {
            // Token has access to all environments — cannot determine which one
            _logger.LogWarning("Token has access to all environments, cannot resolve: {TokenName}", token.TokenName);
            context.Response.StatusCode = 400;
            await context.Response.WriteAsJsonAsync(new
            {
                success = false,
                error = new { code = "AMBIGUOUS_ENVIRONMENT", message = "Token has access to all environments. Use an environment-specific token." }
            });
            return;
        }
        else if (token.Environments.Count == 1)
        {
            environmentId = token.Environments[0];
        }
        else
        {
            // Multi-environment token
            _logger.LogWarning("Token has access to multiple environments: {TokenName}", token.TokenName);
            context.Response.StatusCode = 400;
            await context.Response.WriteAsJsonAsync(new
            {
                success = false,
                error = new { code = "AMBIGUOUS_ENVIRONMENT", message = "Token has access to multiple environments. Use an environment-specific token." }
            });
            return;
        }

        // Record token usage
        if (token.Id > 0)
        {
            usageTracker.RecordUsage(token.Id);
        }

        context.Items["ClientContext"] = new ClientContext
        {
            ApiToken = apiToken,
            ApplicationName = applicationName,
            Environment = environmentId,
            ClientVersion = clientVersion,
            Platform = platform,
            TokenName = token.TokenName,
        };

        _logger.LogDebug("Client authenticated: app={App}, env={Environment}", applicationName, environmentId);

        await _next(context);
    }
}

/// <summary>
/// Extension to get ClientContext from HttpContext.
/// </summary>
public static class ClientContextExtensions
{
    public static ClientContext? GetClientContext(this HttpContext context)
        => context.Items.TryGetValue("ClientContext", out var ctx) ? ctx as ClientContext : null;
}
