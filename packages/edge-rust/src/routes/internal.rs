// Gatrix Edge Rust - Internal Routes
// Internal management endpoints (separate port)

use actix_web::{web, HttpResponse, Responder};

use crate::app_state::AppState;

/// GET /internal/health
async fn internal_health(data: web::Data<AppState>) -> impl Responder {
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

/// GET /internal/cache/summary
async fn cache_summary(data: web::Data<AppState>) -> impl Responder {
  let sdk = data.sdk.read().await;
  if !sdk.is_initialized() {
    return HttpResponse::ServiceUnavailable().json(serde_json::json!({
      "status": "not_ready",
      "message": "SDK not initialized",
      "timestamp": chrono::Utc::now().to_rfc3339(),
    }));
  }

  // Count cached items per environment
  let env_ids = data.env_registry.get_all_environment_ids().await;

  let mut summary = serde_json::Map::new();

  let mut versions_count = 0usize;
  let mut worlds_count = 0usize;
  let mut banners_count = 0usize;
  let mut notices_count = 0usize;

  for env_id in &env_ids {
    versions_count += sdk.client_version.get_cached(Some(env_id)).await.len();
    worlds_count += sdk.game_world.get_cached(Some(env_id)).await.len();
    banners_count += sdk.banner.get_cached(Some(env_id)).await.len();
    notices_count += sdk.service_notice.get_cached(Some(env_id)).await.len();
  }

  summary.insert(
    "clientVersions".to_string(),
    serde_json::json!(versions_count),
  );
  summary.insert(
    "gameWorlds".to_string(),
    serde_json::json!(worlds_count),
  );
  summary.insert(
    "banners".to_string(),
    serde_json::json!(banners_count),
  );
  summary.insert(
    "serviceNotices".to_string(),
    serde_json::json!(notices_count),
  );
  summary.insert(
    "total".to_string(),
    serde_json::json!(versions_count + worlds_count + banners_count + notices_count),
  );

  HttpResponse::Ok().json(serde_json::json!({
    "status": "ready",
    "timestamp": chrono::Utc::now().to_rfc3339(),
    "environments": env_ids.len(),
    "summary": summary,
  }))
}

/// POST /internal/cache/refresh
async fn cache_refresh(data: web::Data<AppState>) -> impl Responder {
  let sdk = data.sdk.read().await;
  if !sdk.is_initialized() {
    return HttpResponse::ServiceUnavailable().json(serde_json::json!({
      "status": "not_ready",
      "message": "SDK not initialized",
      "timestamp": chrono::Utc::now().to_rfc3339(),
    }));
  }

  sdk.refresh_cache().await;

  HttpResponse::Ok().json(serde_json::json!({
    "status": "refreshed",
    "timestamp": chrono::Utc::now().to_rfc3339(),
  }))
}

/// Configure internal routes
pub fn configure(cfg: &mut web::ServiceConfig) {
  cfg.service(
    web::scope("/internal")
      .route("/health", web::get().to(internal_health))
      .route("/cache/summary", web::get().to(cache_summary))
      .route("/cache/refresh", web::post().to(cache_refresh)),
  );
}
