// Error types for Gatrix Unity Client SDK

using System;
using System.Collections.Generic;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Error codes for GatrixFeatureError
    /// </summary>
    public enum GatrixFeatureErrorCode
    {
        /// <summary>Flag not found in cache</summary>
        FlagNotFound,
        /// <summary>Flag is disabled</summary>
        FlagDisabled,
        /// <summary>Variant type mismatch</summary>
        TypeMismatch,
        /// <summary>No payload available</summary>
        NoPayload,
        /// <summary>No data available (offline mode without cache/bootstrap)</summary>
        NoDataAvailable,
        /// <summary>Network error</summary>
        NetworkError,
        /// <summary>Invalid configuration</summary>
        InvalidConfig,
        /// <summary>Parse error (JSON parsing failed)</summary>
        ParseError
    }

    /// <summary>
    /// Base error class for all Gatrix SDK errors
    /// </summary>
    public class GatrixException : Exception
    {
        public GatrixException(string message) : base(message) { }
        public GatrixException(string message, Exception innerException) : base(message, innerException) { }
    }

    /// <summary>
    /// Custom error class for Gatrix Feature SDK
    /// </summary>
    public class GatrixFeatureException : GatrixException
    {
        public GatrixFeatureErrorCode Code { get; }
        public string FlagName { get; }
        public Dictionary<string, object> Details { get; }

        public GatrixFeatureException(
            GatrixFeatureErrorCode code,
            string message,
            string flagName = null,
            Dictionary<string, object> details = null,
            Exception innerException = null
        ) : base(message, innerException)
        {
            Code = code;
            FlagName = flagName;
            Details = details;
        }

        /// <summary>Create a flag not found error</summary>
        public static GatrixFeatureException FlagNotFoundError(string flagName)
        {
            return new GatrixFeatureException(
                GatrixFeatureErrorCode.FlagNotFound,
                $"Flag \"{flagName}\" not found",
                flagName
            );
        }

        /// <summary>Create a flag disabled error</summary>
        public static GatrixFeatureException FlagDisabledError(string flagName)
        {
            return new GatrixFeatureException(
                GatrixFeatureErrorCode.FlagDisabled,
                $"Flag \"{flagName}\" is disabled",
                flagName
            );
        }

        /// <summary>Create a type mismatch error</summary>
        public static GatrixFeatureException TypeMismatchError(string flagName, string expected, string actual)
        {
            return new GatrixFeatureException(
                GatrixFeatureErrorCode.TypeMismatch,
                $"Flag \"{flagName}\" type mismatch: expected {expected}, got {actual}",
                flagName,
                new Dictionary<string, object> { { "expected", expected }, { "actual", actual } }
            );
        }

        /// <summary>Create a no data available error</summary>
        public static GatrixFeatureException NoDataAvailableError()
        {
            return new GatrixFeatureException(
                GatrixFeatureErrorCode.NoDataAvailable,
                "No flag data available (offline mode requires bootstrap or cached data)"
            );
        }

        /// <summary>Create a no payload error</summary>
        public static GatrixFeatureException NoPayloadError(string flagName)
        {
            return new GatrixFeatureException(
                GatrixFeatureErrorCode.NoPayload,
                $"Flag \"{flagName}\" has no payload",
                flagName
            );
        }

        /// <summary>Create a parse error</summary>
        public static GatrixFeatureException ParseErrorFor(string flagName, Exception cause = null)
        {
            return new GatrixFeatureException(
                GatrixFeatureErrorCode.ParseError,
                $"Failed to parse payload for flag \"{flagName}\"",
                flagName,
                innerException: cause
            );
        }
    }
}
