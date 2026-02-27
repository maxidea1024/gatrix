namespace Gatrix.Server.Sdk.Models;

/// <summary>
/// Generic API response wrapper matching the Gatrix backend format.
/// </summary>
public class ApiResponse<T>
{
    public bool Success { get; set; }
    public T? Data { get; set; }
    public ApiError? Error { get; set; }
    public string? Etag { get; set; }
    public bool NotModified { get; set; }
}

public class ApiError
{
    public string? Message { get; set; }
    public int? StatusCode { get; set; }
}

/// <summary>
/// Response shape for GET /api/v1/server/:env/features
/// </summary>
public class FeatureFlagsApiResponse
{
    public List<FeatureFlag> Flags { get; set; } = [];
    public List<FeatureSegment> Segments { get; set; } = [];
}

/// <summary>
/// Response shape for GET /api/v1/server/:env/features/:flagName
/// </summary>
public class SingleFlagApiResponse
{
    public FeatureFlag? Flag { get; set; }
}

/// <summary>
/// Response shape for GET /api/v1/server/internal/environments
/// </summary>
public class EnvironmentListResponse
{
    public List<EnvironmentInfo> Environments { get; set; } = [];
}

public class EnvironmentInfo
{
    public int Id { get; set; }
    public string Environment { get; set; } = string.Empty;
    public string? Description { get; set; }
}
