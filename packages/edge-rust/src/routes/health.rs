// Gatrix Edge Rust - Health Routes

use actix_web::{web, HttpResponse, Responder};
use crate::app_state::AppState;

/// GET /health
pub async fn health(data: web::Data<AppState>) -> impl Responder {
  let sdk = data.sdk.read().await;
  let is_sdk_ready = sdk.is_initialized();
  let is_token_mirror_ready = data.token_mirror.is_initialized().await;
  let is_ready = is_sdk_ready && is_token_mirror_ready;

  let status_code = if is_ready { 200 } else { 503 };
  let token_count = data.token_mirror.get_token_count().await;

  HttpResponse::build(actix_web::http::StatusCode::from_u16(status_code).unwrap())
    .json(serde_json::json!({
      "status": if is_ready { "healthy" } else { "initializing" },
      "timestamp": chrono::Utc::now().to_rfc3339(),
      "version": env!("CARGO_PKG_VERSION"),
      "runtime": "rust",
      "sdk": if is_sdk_ready { "ready" } else { "initializing" },
      "tokenMirror": if is_token_mirror_ready { "ready" } else { "initializing" },
      "tokenCount": token_count,
    }))
}

/// GET /health/ready
pub async fn health_ready(data: web::Data<AppState>) -> impl Responder {
  let sdk = data.sdk.read().await;
  let is_ready = sdk.is_initialized();

  if is_ready {
    HttpResponse::Ok().json(serde_json::json!({
      "status": "ready",
      "timestamp": chrono::Utc::now().to_rfc3339(),
    }))
  } else {
    HttpResponse::ServiceUnavailable().json(serde_json::json!({
      "status": "not_ready",
      "message": "SDK not initialized",
      "timestamp": chrono::Utc::now().to_rfc3339(),
    }))
  }
}

/// GET /health/live
pub async fn health_live() -> impl Responder {
  HttpResponse::Ok().json(serde_json::json!({
    "status": "alive",
    "timestamp": chrono::Utc::now().to_rfc3339(),
  }))
}

/// Configure health routes
pub fn configure(cfg: &mut web::ServiceConfig) {
  cfg.service(
    web::scope("/health")
      .route("", web::get().to(health))
      .route("/", web::get().to(health))
      .route("/ready", web::get().to(health_ready))
      .route("/live", web::get().to(health_live)),
  );
}
