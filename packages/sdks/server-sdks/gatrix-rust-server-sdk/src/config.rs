// Gatrix Rust Server SDK
// Configuration types

use std::collections::HashMap;

/// Redis configuration for PubSub events
#[derive(Debug, Clone)]
pub struct RedisConfig {
    pub host: String,
    pub port: u16,
    pub password: Option<String>,
    pub db: Option<i64>,
}

/// Cache refresh method
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RefreshMethod {
    Polling,
    Event,
    Manual,
}

impl Default for RefreshMethod {
    fn default() -> Self {
        RefreshMethod::Polling
    }
}

/// Cache configuration
#[derive(Debug, Clone)]
pub struct CacheConfig {
    pub enabled: bool,
    /// Cache TTL in seconds (default: 300)
    pub ttl: u64,
    pub refresh_method: RefreshMethod,
}

impl Default for CacheConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            ttl: 300,
            refresh_method: RefreshMethod::Polling,
        }
    }
}

/// Logger level
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LogLevel {
    Debug,
    Info,
    Warn,
    Error,
}

impl Default for LogLevel {
    fn default() -> Self {
        LogLevel::Info
    }
}

/// Logger configuration
#[derive(Debug, Clone)]
pub struct LoggerConfig {
    pub level: LogLevel,
}

impl Default for LoggerConfig {
    fn default() -> Self {
        Self {
            level: LogLevel::Info,
        }
    }
}

/// HTTP retry configuration
#[derive(Debug, Clone)]
pub struct RetryConfig {
    pub enabled: bool,
    pub max_retries: i32,
    pub retry_delay: u64,
    pub retry_delay_multiplier: f64,
    pub max_retry_delay: u64,
    pub retryable_status_codes: Vec<u16>,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            max_retries: 10,
            retry_delay: 2000,
            retry_delay_multiplier: 2.0,
            max_retry_delay: 10000,
            retryable_status_codes: vec![408, 429, 500, 502, 503, 504],
        }
    }
}

/// Metrics configuration
#[derive(Debug, Clone)]
pub struct MetricsConfig {
    pub enabled: bool,
    pub server_enabled: bool,
    pub port: u16,
}

impl Default for MetricsConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            server_enabled: false,
            port: 9337,
        }
    }
}

/// Service metadata configuration
#[derive(Debug, Clone, Default)]
pub struct MetaConfig {
    pub service: Option<String>,
    pub group: Option<String>,
    pub version: Option<String>,
    pub commit_hash: Option<String>,
    pub git_branch: Option<String>,
}

/// Feature toggles — which services to enable (opt-in)
#[derive(Debug, Clone)]
pub struct UsesConfig {
    pub game_world: bool,
    pub popup_notice: bool,
    pub survey: bool,
    pub whitelist: bool,
    pub service_maintenance: bool,
    pub client_version: bool,
    pub service_notice: bool,
    pub banner: bool,
    pub store_product: bool,
    pub feature_flag: bool,
    pub vars: bool,
}

impl Default for UsesConfig {
    fn default() -> Self {
        Self {
            game_world: false,
            popup_notice: false,
            survey: false,
            whitelist: false,
            service_maintenance: false,
            client_version: false,
            service_notice: false,
            banner: false,
            store_product: false,
            feature_flag: false,
            vars: false,
        }
    }
}

/// Feature flag specific configuration
#[derive(Debug, Clone)]
pub struct FeatureFlagConfig {
    /// When true, disabled flags are fetched without strategies/variants to reduce bandwidth
    pub compact: bool,
}

impl Default for FeatureFlagConfig {
    fn default() -> Self {
        Self { compact: true }
    }
}

/// Environment token mapping for multi-environment mode
#[derive(Debug, Clone)]
pub struct EnvironmentToken {
    pub environment_id: String,
    pub token: String,
}

/// Environment provider trait for multi-environment support
pub trait EnvironmentProvider: Send + Sync {
    fn get_environment_tokens(&self) -> Vec<EnvironmentToken>;
}

/// Main SDK configuration
#[derive(Debug, Clone)]
pub struct GatrixSDKConfig {
    // Required
    pub api_url: String,
    pub api_token: String,
    pub app_name: String,

    // Optional
    pub meta: Option<MetaConfig>,
    pub world_id: Option<String>,
    pub redis: Option<RedisConfig>,
    pub cache: CacheConfig,
    pub logger: LoggerConfig,
    pub retry: RetryConfig,
    pub metrics: MetricsConfig,
    pub uses: UsesConfig,
    pub feature_flags: FeatureFlagConfig,
    /// Additional custom properties
    pub custom: HashMap<String, String>,
}

impl GatrixSDKConfig {
    /// Create a new configuration with required fields only
    pub fn new(api_url: impl Into<String>, api_token: impl Into<String>, app_name: impl Into<String>) -> Self {
        Self {
            api_url: api_url.into(),
            api_token: api_token.into(),
            app_name: app_name.into(),
            meta: None,
            world_id: None,
            redis: None,
            cache: CacheConfig::default(),
            logger: LoggerConfig::default(),
            retry: RetryConfig::default(),
            metrics: MetricsConfig::default(),
            uses: UsesConfig::default(),
            feature_flags: FeatureFlagConfig::default(),
            custom: HashMap::new(),
        }
    }

    /// Validate the configuration
    pub fn validate(&self) -> Result<(), crate::error::GatrixError> {
        if self.api_url.is_empty() {
            return Err(crate::error::GatrixError::invalid_config("apiUrl is required"));
        }
        if self.api_token.is_empty() {
            return Err(crate::error::GatrixError::invalid_config("apiToken is required"));
        }
        if self.app_name.is_empty() {
            return Err(crate::error::GatrixError::invalid_config("appName is required"));
        }

        // Validate URL format
        if reqwest::Url::parse(&self.api_url).is_err() {
            return Err(crate::error::GatrixError::invalid_config("apiUrl must be a valid URL"));
        }

        // Validate cache config
        if self.cache.refresh_method == RefreshMethod::Event && self.redis.is_none() {
            return Err(crate::error::GatrixError::invalid_config(
                "redis config is required when cache.refreshMethod is 'event'",
            ));
        }

        Ok(())
    }
}
