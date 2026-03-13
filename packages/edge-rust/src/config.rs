// Gatrix Edge Rust - Configuration
// Environment variable parsing with CLI argument override

use std::env;
use clap::Parser;

/// Gatrix Edge Server (Rust)
#[derive(Parser, Debug)]
#[command(name = "gatrix-edge-rust")]
#[command(about = "Gatrix Edge Server - High-availability caching proxy")]
#[command(version)]
pub struct CliArgs {
  /// Main API port
  #[arg(long, env = "EDGE_PORT")]
  pub port: Option<u16>,

  /// Gatrix backend URL
  #[arg(long, env = "GATRIX_URL")]
  pub gatrix_url: Option<String>,

  /// Bypass API token for backend authentication
  #[arg(long, env = "EDGE_BYPASS_TOKEN")]
  pub api_token: Option<String>,

  /// Application name
  #[arg(long, env = "EDGE_APPLICATION_NAME")]
  pub app_name: Option<String>,

  /// Service label for service discovery
  #[arg(long, env = "EDGE_SERVICE")]
  pub service: Option<String>,

  /// Group label for service discovery
  #[arg(long, env = "EDGE_GROUP")]
  pub group: Option<String>,

  /// Redis host
  #[arg(long, env = "EDGE_REDIS_HOST")]
  pub redis_host: Option<String>,

  /// Redis port
  #[arg(long, env = "EDGE_REDIS_PORT")]
  pub redis_port: Option<u16>,

  /// Redis password
  #[arg(long, env = "EDGE_REDIS_PASSWORD")]
  pub redis_password: Option<String>,

  /// Redis database number
  #[arg(long, env = "EDGE_REDIS_DB")]
  pub redis_db: Option<i64>,

  /// Cache sync method: polling | event | manual
  #[arg(long, env = "EDGE_SYNC_METHOD")]
  pub sync_method: Option<String>,

  /// Cache polling interval in milliseconds
  #[arg(long, env = "EDGE_CACHE_POLLING_INTERVAL_MS")]
  pub polling_interval_ms: Option<u64>,

  /// Log level: debug | info | warn | error
  #[arg(long, env = "EDGE_LOG_LEVEL")]
  pub log_level: Option<String>,
}

/// Redis configuration
#[derive(Debug, Clone)]
pub struct RedisConfig {
  pub host: String,
  pub port: u16,
  pub password: Option<String>,
  pub db: i64,
}

/// Cache configuration
#[derive(Debug, Clone)]
pub struct CacheConfig {
  pub polling_interval_ms: u64,
  pub sync_method: String,
}

/// Service metadata
#[derive(Debug, Clone)]
pub struct MetaConfig {
  pub service: String,
  pub group: String,
  pub environment: String,
}

/// Main Edge configuration
#[derive(Debug, Clone)]
pub struct EdgeConfig {
  // Server
  pub port: u16,
  pub internal_port: u16,

  // Backend API
  pub gatrix_url: String,

  // Auth
  pub api_token: String,
  pub app_name: String,

  // Metadata
  pub meta: MetaConfig,

  // Redis
  pub redis: RedisConfig,

  // Cache
  pub cache: CacheConfig,

  // Logging
  pub log_level: String,

  // Unsecured client token
  pub unsecured_client_token: String,
}

impl EdgeConfig {
  /// Load configuration from environment variables, then apply CLI overrides
  pub fn load(args: &CliArgs) -> Self {
    let port = args.port.unwrap_or_else(|| {
      env::var("EDGE_PORT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(3400)
    });

    let api_token = args.api_token.clone().unwrap_or_else(|| {
      env::var("EDGE_BYPASS_TOKEN")
        .or_else(|_| env::var("EDGE_API_TOKEN"))
        .unwrap_or_else(|_| "gatrix-infra-server-token".to_string())
    });

    let redis_host = args.redis_host.clone().unwrap_or_else(|| {
      env::var("EDGE_REDIS_HOST")
        .or_else(|_| env::var("REDIS_HOST"))
        .unwrap_or_else(|_| "localhost".to_string())
    });

    let redis_port = args.redis_port.unwrap_or_else(|| {
      env::var("EDGE_REDIS_PORT")
        .or_else(|_| env::var("REDIS_PORT"))
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(6379)
    });

    let redis_password = args.redis_password.clone().or_else(|| {
      env::var("EDGE_REDIS_PASSWORD")
        .or_else(|_| env::var("REDIS_PASSWORD"))
        .ok()
    });

    let redis_db = args.redis_db.unwrap_or_else(|| {
      env::var("EDGE_REDIS_DB")
        .or_else(|_| env::var("REDIS_DB"))
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(0)
    });

    Self {
      port,
      internal_port: port + 10,

      gatrix_url: args.gatrix_url.clone().unwrap_or_else(|| {
        env::var("GATRIX_URL")
          .unwrap_or_else(|_| "http://localhost:5000".to_string())
      }),

      api_token,

      app_name: args.app_name.clone().unwrap_or_else(|| {
        env::var("EDGE_APPLICATION_NAME")
          .unwrap_or_else(|_| "edge-rust-server".to_string())
      }),

      meta: MetaConfig {
        service: args.service.clone().unwrap_or_else(|| {
          env::var("EDGE_SERVICE")
            .unwrap_or_else(|_| "edge-rust".to_string())
        }),
        group: args.group.clone().unwrap_or_else(|| {
          env::var("EDGE_GROUP")
            .unwrap_or_else(|_| "gatrix".to_string())
        }),
        environment: env::var("EDGE_ENVIRONMENT")
          .unwrap_or_else(|_| "gatrix-env".to_string()),
      },

      redis: RedisConfig {
        host: redis_host,
        port: redis_port,
        password: redis_password,
        db: redis_db,
      },

      cache: CacheConfig {
        polling_interval_ms: args.polling_interval_ms.unwrap_or_else(|| {
          env::var("EDGE_CACHE_POLLING_INTERVAL_MS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(30000)
        }),
        sync_method: args.sync_method.clone().unwrap_or_else(|| {
          env::var("EDGE_SYNC_METHOD")
            .unwrap_or_else(|_| "polling".to_string())
        }),
      },

      log_level: args.log_level.clone().unwrap_or_else(|| {
        env::var("EDGE_LOG_LEVEL")
          .unwrap_or_else(|_| "info".to_string())
      }),

      unsecured_client_token: env::var("EDGE_CLIENT_UNSECURED_TOKEN")
        .unwrap_or_else(|_| "unsecured-edge-api-token".to_string()),
    }
  }

  /// Validate the configuration
  pub fn validate(&self) -> Result<(), String> {
    if self.api_token.is_empty() {
      return Err("EDGE_API_TOKEN or EDGE_BYPASS_TOKEN is required".to_string());
    }
    if self.gatrix_url.is_empty() {
      return Err("GATRIX_URL is required".to_string());
    }
    Ok(())
  }
}
