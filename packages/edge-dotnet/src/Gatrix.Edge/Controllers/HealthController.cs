using Gatrix.Edge.Services;
using Microsoft.AspNetCore.Mvc;

namespace Gatrix.Edge.Controllers;

/// <summary>
/// Health check endpoints.
/// </summary>
[ApiController]
[Route("health")]
public partial class HealthController : ControllerBase
{
    private readonly TokenMirrorService _tokenMirror;

    public HealthController(TokenMirrorService tokenMirror)
    {
        _tokenMirror = tokenMirror;
    }
}
