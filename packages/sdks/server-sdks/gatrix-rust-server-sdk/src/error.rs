// Gatrix Rust Server SDK
// Error types for the SDK

use thiserror::Error;

/// Error codes for SDK errors
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ErrorCode {
    InvalidConfig,
    InvalidParameters,
    NetworkError,
    ApiError,
    CacheError,
    NotInitialized,
}

impl std::fmt::Display for ErrorCode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ErrorCode::InvalidConfig => write!(f, "INVALID_CONFIG"),
            ErrorCode::InvalidParameters => write!(f, "INVALID_PARAMETERS"),
            ErrorCode::NetworkError => write!(f, "NETWORK_ERROR"),
            ErrorCode::ApiError => write!(f, "API_ERROR"),
            ErrorCode::CacheError => write!(f, "CACHE_ERROR"),
            ErrorCode::NotInitialized => write!(f, "NOT_INITIALIZED"),
        }
    }
}

/// Main SDK error type
#[derive(Debug, Error)]
#[error("[{code}] {message}")]
pub struct GatrixError {
    pub code: ErrorCode,
    pub message: String,
}

impl GatrixError {
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    pub fn invalid_config(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::InvalidConfig, message)
    }

    pub fn invalid_parameters(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::InvalidParameters, message)
    }

    pub fn not_initialized(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::NotInitialized, message)
    }
}

/// Feature flag specific error codes
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FeatureFlagErrorCode {
    FlagNotFound,
    NoValue,
    InvalidValueType,
}

impl std::fmt::Display for FeatureFlagErrorCode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            FeatureFlagErrorCode::FlagNotFound => write!(f, "FLAG_NOT_FOUND"),
            FeatureFlagErrorCode::NoValue => write!(f, "NO_VALUE"),
            FeatureFlagErrorCode::InvalidValueType => write!(f, "INVALID_VALUE_TYPE"),
        }
    }
}

/// Feature flag evaluation error
#[derive(Debug, Error)]
#[error("[{code}] {message}")]
pub struct FeatureFlagError {
    pub code: FeatureFlagErrorCode,
    pub message: String,
}

impl FeatureFlagError {
    pub fn new(code: FeatureFlagErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    pub fn flag_not_found(flag_name: &str) -> Self {
        Self::new(
            FeatureFlagErrorCode::FlagNotFound,
            format!("Flag '{}' not found", flag_name),
        )
    }

    pub fn no_value(flag_name: &str) -> Self {
        Self::new(
            FeatureFlagErrorCode::NoValue,
            format!("Flag '{}' has no value", flag_name),
        )
    }

    pub fn invalid_value_type(flag_name: &str, expected: &str, actual: &str) -> Self {
        Self::new(
            FeatureFlagErrorCode::InvalidValueType,
            format!(
                "Flag '{}': expected valueType '{}', got '{}'",
                flag_name, expected, actual
            ),
        )
    }
}

/// General SDK result type
pub type GatrixResult<T> = Result<T, GatrixError>;
