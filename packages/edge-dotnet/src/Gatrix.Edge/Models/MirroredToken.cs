namespace Gatrix.Edge.Models;

/// <summary>
/// Token mirrored from backend for local validation.
/// </summary>
public class MirroredToken
{
    public int Id { get; set; }
    public string TokenName { get; set; } = string.Empty;
    public string TokenValue { get; set; } = string.Empty;
    public string TokenType { get; set; } = "client"; // "client" | "server" | "edge" | "all"
    public bool AllowAllEnvironments { get; set; }
    public List<string> Environments { get; set; } = new();
    public string? ExpiresAt { get; set; }
    public string CreatedAt { get; set; } = string.Empty;
    public string UpdatedAt { get; set; } = string.Empty;
}

/// <summary>
/// Result of token validation.
/// </summary>
public class TokenValidationResult
{
    public bool Valid { get; set; }
    public MirroredToken? Token { get; set; }
    public string? Reason { get; set; } // "not_found" | "expired" | "invalid_type" | "invalid_environment"
}

/// <summary>
/// Backend response for token list endpoint.
/// </summary>
public class TokenListResponse
{
    public List<MirroredToken> Tokens { get; set; } = new();
}
