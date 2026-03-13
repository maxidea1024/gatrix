// Gatrix Edge Server (Rust)
// Main entry point

mod config;
mod services;
mod middleware;
mod routes;
mod app_state;

use std::sync::Arc;
use actix_cors::Cors;
use actix_web::{web, App, HttpServer, HttpResponse, middleware as actix_middleware};
use clap::Parser;
use log::{info, error};
use tokio::sync::RwLock;

use config::{CliArgs, EdgeConfig};
use services::token_mirror::TokenMirrorService;
use services::environment_registry::EnvironmentRegistry;
use app_state::AppState;

use gatrix_rust_server_sdk::{GatrixServerSDK, GatrixSDKConfig, RefreshMethod};

#[actix_web::main]
async fn main() -> std::io::Result<()> {
  // Load .env file if present (ignore errors)
  let _ = dotenvy::dotenv();

  // Parse CLI arguments (with env var fallback via clap)
  let args = CliArgs::parse();

  // Load configuration
  let config = EdgeConfig::load(&args);

  // Initialize logger
  std::env::set_var("RUST_LOG", &config.log_level);
  env_logger::init();

  info!("Starting Gatrix Edge Server (Rust)...");

  // Validate configuration
  if let Err(e) = config.validate() {
    error!("Configuration error: {}", e);
    std::process::exit(1);
  }
  info!("Configuration validated");

  // Initialize SDK
  let refresh_method = match config.cache.sync_method.as_str() {
    "event" => RefreshMethod::Event,
    "manual" => RefreshMethod::Manual,
    _ => RefreshMethod::Polling,
  };

  let mut sdk_config = GatrixSDKConfig::new(
    &config.gatrix_url,
    &config.api_token,
    &config.app_name,
  );

  sdk_config.meta = Some(gatrix_rust_server_sdk::MetaConfig {
    service: Some(config.meta.service.clone()),
    group: Some(config.meta.group.clone()),
    ..Default::default()
  });

  sdk_config.cache.refresh_method = refresh_method;
  sdk_config.cache.ttl = config.cache.polling_interval_ms / 1000;

  if config.redis.host != "localhost" || config.cache.sync_method == "event" {
    sdk_config.redis = Some(gatrix_rust_server_sdk::RedisConfig {
      host: config.redis.host.clone(),
      port: config.redis.port,
      password: config.redis.password.clone(),
      db: Some(config.redis.db),
    });
  }

  // Enable all services for Edge (cache everything)
  sdk_config.uses = gatrix_rust_server_sdk::UsesConfig {
    game_world: true,
    popup_notice: true,
    survey: true,
    whitelist: true,
    service_maintenance: true,
    client_version: true,
    service_notice: true,
    banner: true,
    store_product: true,
    feature_flag: true,
    vars: true,
  };

  let mut sdk = GatrixServerSDK::new(sdk_config).expect("Failed to create SDK");
  sdk.initialize().await.expect("Failed to initialize SDK");
  info!("GatrixServerSDK initialized successfully");

  // Initialize token mirror service
  let token_mirror = Arc::new(TokenMirrorService::new(config.clone()));
  token_mirror
    .initialize()
    .await
    .expect("Failed to initialize token mirror");
  info!(
    "Token mirror initialized with {} tokens",
    token_mirror.get_token_count().await
  );

  // Initialize environment registry
  let env_registry = Arc::new(EnvironmentRegistry::new(config.clone()));
  env_registry
    .initialize()
    .await
    .expect("Failed to initialize environment registry");
  info!(
    "Environment registry initialized with {} environments",
    env_registry.get_all_environment_ids().await.len()
  );

  // Register Edge service to Service Discovery
  let ports = {
    let mut ports = std::collections::HashMap::new();
    ports.insert("externalApi".to_string(), config.port);
    ports.insert("internalApi".to_string(), config.internal_port);
    ports
  };

  match sdk.service_discovery.register(
    gatrix_rust_server_sdk::types::api::RegisterServiceInput {
      instance_id: None,
      labels: gatrix_rust_server_sdk::types::api::ServiceLabels {
        service: "edge-rust".to_string(),
        group: Some(config.meta.group.clone()),
        environment: None,
        region: None,
        extra: {
          let mut m = std::collections::HashMap::new();
          m.insert("appVersion".to_string(), env!("CARGO_PKG_VERSION").to_string());
          m
        },
      },
      hostname: None,
      internal_address: None,
      ports: gatrix_rust_server_sdk::types::api::ServicePorts(ports),
      status: Some(gatrix_rust_server_sdk::types::api::ServiceStatus::Ready),
      stats: None,
      meta: Some(serde_json::json!({
        "instanceName": "edge-rust-1",
        "runtime": "rust",
      })),
    },
  ).await {
    Ok(instance) => {
      info!("Edge service registered: instanceId={}", instance.instance_id);
    }
    Err(e) => {
      error!("Failed to register Edge service: {}", e);
    }
  }

  // Build shared application state
  let app_state = web::Data::new(AppState {
    sdk: Arc::new(RwLock::new(sdk)),
    token_mirror: Arc::clone(&token_mirror),
    env_registry: Arc::clone(&env_registry),
    config: config.clone(),
  });

  let main_port = config.port;
  let internal_port = config.internal_port;
  let app_state_internal = app_state.clone();

  // Start internal HTTP server on separate port
  let internal_server = HttpServer::new(move || {
    App::new()
      .app_data(app_state_internal.clone())
      .configure(routes::health::configure)
      .configure(routes::internal::configure)
      .default_service(web::route().to(|| async {
        HttpResponse::NotFound().json(serde_json::json!({
          "success": false,
          "error": {
            "code": "NOT_FOUND",
            "message": "Endpoint not found"
          }
        }))
      }))
  })
  .bind(format!("0.0.0.0:{}", internal_port))?
  .workers(2)
  .run();

  info!("Edge internal server listening on port {}", internal_port);

  // Start main HTTP server
  let main_server = HttpServer::new(move || {
    let cors = Cors::default()
      .allow_any_origin()
      .allowed_methods(vec!["GET", "POST", "OPTIONS"])
      .allowed_headers(vec![
        "content-type",
        "x-api-token",
        "x-application-name",
        "x-client-version",
        "x-platform",
        "x-sdk-version",
        "x-environment-id",
        "x-connection-id",
        "authorization",
        "if-none-match",
      ])
      .expose_headers(vec!["etag"])
      .max_age(3600);

    App::new()
      .wrap(cors)
      .wrap(actix_middleware::Logger::default())
      .app_data(app_state.clone())
      .app_data(web::JsonConfig::default().limit(1024 * 1024)) // 1MB limit
      .configure(routes::health::configure)
      .configure(routes::client::configure)
      .configure(routes::server::configure)
      .default_service(web::route().to(|| async {
        HttpResponse::NotFound().json(serde_json::json!({
          "success": false,
          "error": {
            "code": "NOT_FOUND",
            "message": "Endpoint not found"
          }
        }))
      }))
  })
  .bind(format!("0.0.0.0:{}", main_port))?
  .run();

  info!("Edge server listening on port {}", main_port);

  // Run both servers concurrently
  tokio::select! {
    result = main_server => {
      if let Err(e) = result {
        error!("Main server error: {}", e);
      }
    }
    result = internal_server => {
      if let Err(e) = result {
        error!("Internal server error: {}", e);
      }
    }
  }

  info!("Edge server shutting down...");
  Ok(())
}
