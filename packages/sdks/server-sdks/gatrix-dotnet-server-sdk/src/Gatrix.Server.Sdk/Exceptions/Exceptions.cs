namespace Gatrix.Server.Sdk.Exceptions;

/// <summary>
/// Thrown when SDK configuration is invalid.
/// </summary>
public class GatrixConfigurationException : Exception
{
    public GatrixConfigurationException(string message) : base(message) { }
    public GatrixConfigurationException(string message, Exception innerException) : base(message, innerException) { }
}

/// <summary>
/// Thrown by *OrThrow methods when a flag is not found or has no value.
/// </summary>
public class FeatureFlagException : Exception
{
    public string FlagName { get; }
    public string? Environment { get; }
    public FeatureFlagErrorCode ErrorCode { get; }

    public FeatureFlagException(FeatureFlagErrorCode errorCode, string message, string flagName, string? environmentId = null)
        : base(message)
    {
        ErrorCode = errorCode;
        FlagName = flagName;
        Environment = environmentId;
    }
}

public enum FeatureFlagErrorCode
{
    FlagNotFound,
    NoValue,
    InvalidValueType,
}
