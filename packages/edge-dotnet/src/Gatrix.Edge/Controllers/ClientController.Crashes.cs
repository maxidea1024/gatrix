using System.Text;
using System.Text.Json;
using Gatrix.Edge.Middleware;
using Microsoft.AspNetCore.Mvc;

namespace Gatrix.Edge.Controllers;

public partial class ClientController : ControllerBase
{
    // =============================
    // Crash Reporting Routes
    // =============================

    /// <summary>
    /// POST /api/v1/client/{environment}/crashes/upload — Proxy to backend
    /// </summary>
    [HttpPost("{environment}/crashes/upload")]
    public async Task<IActionResult> UploadCrash(string environment)
    {
        var ctx = HttpContext.GetClientContext();
        var env = ctx?.Environment ?? environment;

        var clientIp = Request.Headers["X-Forwarded-For"].FirstOrDefault()
                    ?? HttpContext.Connection.RemoteIpAddress?.ToString()
                    ?? "unknown";
        var userAgent = Request.Headers.UserAgent.FirstOrDefault() ?? "unknown";

        try
        {
            using var reader = new StreamReader(Request.Body);
            var body = await reader.ReadToEndAsync();

            var httpClient = HttpContext.RequestServices.GetRequiredService<IHttpClientFactory>()
                .CreateClient("GatrixBackend");

            var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/client/crashes/upload")
            {
                Content = new StringContent(body, Encoding.UTF8, "application/json")
            };
            request.Headers.Add("x-api-token", _options.ApiToken);
            request.Headers.Add("x-application-name", _options.ApplicationName);
            request.Headers.Add("x-environment", env);
            request.Headers.Add("x-forwarded-for", clientIp);
            request.Headers.Add("user-agent", userAgent);

            var response = await httpClient.SendAsync(request);
            var responseBody = await response.Content.ReadAsStringAsync();

            return StatusCode((int)response.StatusCode, JsonSerializer.Deserialize<object>(responseBody));
        }
        catch (HttpRequestException)
        {
            return StatusCode(503, new
            {
                success = false,
                error = new { code = "SERVICE_UNAVAILABLE", message = "Failed to connect to backend server" }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error in crash upload proxy");
            return StatusCode(500, new
            {
                success = false,
                error = new { code = "INTERNAL_SERVER_ERROR", message = "Failed to process crash upload" }
            });
        }
    }
}
