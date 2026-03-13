// Gatrix Edge Rust - Server Routes
// Server SDK API endpoints

use std::sync::Arc;
use actix_web::{web, HttpRequest, HttpResponse, Responder};
use log::{debug, error};

use crate::app_state::AppState;
use crate::middleware::server_auth;
use crate::services::token_mirror::TokenMirrorService;
use crate::services::environment_registry::EnvironmentRegistry;

/// Helper to authenticate and get ServerContext
async fn auth(
  req: &HttpRequest,
  data: &web::Data<AppState>,
) -> Result<server_auth::ServerContext, HttpResponse> {
  let token_mirror: Arc<TokenMirrorService> = Arc::clone(&data.token_mirror);
  let env_registry: Arc<EnvironmentRegistry> = Arc::clone(&data.env_registry);
  server_auth::authenticate_server(req, &token_mirror, &env_registry).await
}

/// GET /api/v1/server/features
async fn features(req: HttpRequest, data: web::Data<AppState>) -> impl Responder {
  let ctx = match auth(&req, &data).await {
    Ok(c) => c,
    Err(resp) => return resp,
  };

  let query = web::Query::<std::collections::HashMap<String, String>>::from_query(
    req.query_string(),
  );
  let params = query.unwrap_or_else(|_| web::Query(std::collections::HashMap::new()));

  let sdk = data.sdk.read().await;

  let mut flags = sdk
    .feature_flag
    .get_cached(Some(&ctx.cache_key))
    .await;

  // Filter by flagNames query parameter (comma-separated)
  let flag_names_param = params.get("flagNames");
  if let Some(names) = flag_names_param {
    let filter: std::collections::HashSet<String> = names
      .split(',')
      .map(|n| n.trim().to_string())
      .filter(|n| !n.is_empty())
      .collect();
    flags.retain(|f| filter.contains(&f.name));
  }

  // Parse compact option
  let compact = params.get("compact").map(|v| v == "true" || v == "1").unwrap_or(false);

  // When compact mode is enabled, strip evaluation data from disabled flags
  let response_flags: Vec<serde_json::Value> = flags
    .iter()
    .map(|f| {
      let mut val = serde_json::to_value(f).unwrap_or(serde_json::json!({}));
      if compact && !f.is_enabled {
        if let Some(obj) = val.as_object_mut() {
          obj.remove("strategies");
          obj.remove("variants");
          obj.remove("enabledValue");
          obj.insert("compact".to_string(), serde_json::json!(true));
        }
      }
      val
    })
    .collect();

  let mut response_data = serde_json::json!({
    "flags": response_flags,
  });

  // Include segments if available
  // Note: The Rust SDK doesn't expose getAllSegments directly;
  // segments are returned as part of the features response from the backend.
  // We serialize whatever segment data is available.
  if let Some(obj) = response_data.as_object_mut() {
    obj.insert("segments".to_string(), serde_json::json!([]));
  }

  debug!(
    "Features served: env={}, flags={}",
    ctx.environment_id,
    response_flags.len()
  );

  HttpResponse::Ok().json(serde_json::json!({
    "success": true,
    "data": response_data,
    "cached": true,
  }))
}

/// POST /api/v1/server/features/metrics
async fn features_metrics(
  req: HttpRequest,
  body: web::Json<serde_json::Value>,
  data: web::Data<AppState>,
) -> impl Responder {
  let ctx = match auth(&req, &data).await {
    Ok(c) => c,
    Err(resp) => return resp,
  };

  let metrics = body.get("metrics");
  if metrics.and_then(|m| m.as_array()).is_none() {
    return HttpResponse::BadRequest().json(serde_json::json!({
      "success": false,
      "error": {
        "code": "BAD_REQUEST",
        "message": "metrics must be an array"
      }
    }));
  }

  // Forward metrics to backend
  let url = format!(
    "{}/api/v1/server/features/metrics",
    data.config.gatrix_url
  );

  let client = reqwest::Client::new();
  let sdk_version = req
    .headers()
    .get("x-sdk-version")
    .and_then(|v| v.to_str().ok())
    .unwrap_or("unknown");

  match client
    .post(&url)
    .header("x-api-token", &data.config.api_token)
    .header("x-application-name", &ctx.application_name)
    .header("x-environment-id", &ctx.environment_id)
    .header("x-sdk-version", sdk_version)
    .json(&body.into_inner())
    .timeout(std::time::Duration::from_secs(10))
    .send()
    .await
  {
    Ok(_) => {
      debug!("Metrics forwarded to backend for env={}", ctx.environment_id);
    }
    Err(e) => {
      error!("Failed to forward metrics: {}", e);
    }
  }

  HttpResponse::Ok().json(serde_json::json!({
    "success": true,
    "buffered": true,
  }))
}

/// POST /api/v1/server/features/unknown
async fn features_unknown(
  req: HttpRequest,
  body: web::Json<serde_json::Value>,
  data: web::Data<AppState>,
) -> impl Responder {
  let ctx = match auth(&req, &data).await {
    Ok(c) => c,
    Err(resp) => return resp,
  };

  let flag_name = body.get("flagName").and_then(|v| v.as_str());
  if flag_name.is_none() {
    return HttpResponse::BadRequest().json(serde_json::json!({
      "success": false,
      "error": {
        "code": "BAD_REQUEST",
        "message": "flagName is required"
      }
    }));
  }

  // Forward to backend
  let url = format!(
    "{}/api/v1/server/features/unknown",
    data.config.gatrix_url
  );

  let client = reqwest::Client::new();
  let _ = client
    .post(&url)
    .header("x-api-token", &data.config.api_token)
    .header("x-application-name", &ctx.application_name)
    .header("x-environment-id", &ctx.environment_id)
    .json(&body.into_inner())
    .timeout(std::time::Duration::from_secs(10))
    .send()
    .await;

  HttpResponse::Ok().json(serde_json::json!({
    "success": true,
    "buffered": true,
  }))
}

/// POST /api/v1/server/features/eval
async fn features_eval_post(
  req: HttpRequest,
  body: web::Json<serde_json::Value>,
  data: web::Data<AppState>,
) -> impl Responder {
  let ctx = match auth(&req, &data).await {
    Ok(c) => c,
    Err(resp) => return resp,
  };

  perform_evaluation(&data, &ctx, Some(&body)).await
}

/// GET /api/v1/server/features/eval
async fn features_eval_get(req: HttpRequest, data: web::Data<AppState>) -> impl Responder {
  let ctx = match auth(&req, &data).await {
    Ok(c) => c,
    Err(resp) => return resp,
  };

  perform_evaluation(&data, &ctx, None).await
}

/// Shared evaluation logic
async fn perform_evaluation(
  data: &web::Data<AppState>,
  ctx: &server_auth::ServerContext,
  body: Option<&serde_json::Value>,
) -> HttpResponse {
  let sdk = data.sdk.read().await;

  // Get all cached flags
  let flags = sdk
    .feature_flag
    .get_cached(Some(&ctx.cache_key))
    .await;

  // Extract context from body (if POST)
  let eval_context = body
    .and_then(|b| b.get("context"))
    .cloned()
    .unwrap_or(serde_json::json!({}));

  // Extract flag names filter
  let flag_names: Vec<String> = body
    .and_then(|b| b.get("flagNames"))
    .and_then(|v| v.as_array())
    .map(|arr| {
      arr.iter()
        .filter_map(|v| v.as_str().map(|s| s.to_string()))
        .collect()
    })
    .unwrap_or_default();

  // Build evaluation context
  let user_id = eval_context.get("userId").and_then(|v| v.as_str()).map(|s| s.to_string());
  let session_id = eval_context.get("sessionId").and_then(|v| v.as_str()).map(|s| s.to_string());

  let mut eval_ctx = gatrix_rust_server_sdk::EvaluationContext {
    user_id,
    session_id,
    app_name: Some(ctx.application_name.clone()),
    ..Default::default()
  };

  // Add custom properties from context
  if let Some(props) = eval_context.get("properties").and_then(|v| v.as_object()) {
    for (key, value) in props {
      eval_ctx.properties.insert(
        key.clone(),
        value.clone(),
      );
    }
  }

  // Determine which flags to evaluate
  let keys_to_evaluate: Vec<String> = if flag_names.is_empty() {
    flags.iter().map(|f| f.name.clone()).collect()
  } else {
    flag_names
  };

  let mut results = Vec::new();

  for key in &keys_to_evaluate {
    let result = sdk
      .feature_flag
      .evaluate(key, Some(&eval_ctx), Some(&ctx.cache_key))
      .await;

    results.push(serde_json::json!({
      "name": key,
      "enabled": result.enabled,
      "variant": result.variant.as_ref().map(|v| serde_json::json!({
        "name": v.name,
        "enabled": v.enabled,
        "value": v.value,
      })),
      "reason": format!("{:?}", result.reason),
    }));
  }

  results.sort_by(|a, b| {
    let a_name = a.get("name").and_then(|v| v.as_str()).unwrap_or("");
    let b_name = b.get("name").and_then(|v| v.as_str()).unwrap_or("");
    a_name.cmp(b_name)
  });

  HttpResponse::Ok().json(serde_json::json!({
    "success": true,
    "data": {
      "flags": results,
    },
    "meta": {
      "environmentId": ctx.environment_id,
      "evaluatedAt": chrono::Utc::now().to_rfc3339(),
    },
  }))
}

/// GET /api/v1/server/segments
async fn segments(req: HttpRequest, data: web::Data<AppState>) -> impl Responder {
  let ctx = match auth(&req, &data).await {
    Ok(c) => c,
    Err(resp) => return resp,
  };

  // Note: Segments are not directly exposed via a separate API in Rust SDK.
  // Return empty for now (segments are included in features response).
  let _ = ctx;

  HttpResponse::Ok().json(serde_json::json!({
    "success": true,
    "data": { "segments": [] },
    "cached": true,
  }))
}

/// Configure server routes
pub fn configure(cfg: &mut web::ServiceConfig) {
  cfg.service(
    web::scope("/api/v1/server")
      .route("/features", web::get().to(features))
      .route("/features/metrics", web::post().to(features_metrics))
      .route("/features/unknown", web::post().to(features_unknown))
      .route("/features/eval", web::post().to(features_eval_post))
      .route("/features/eval", web::get().to(features_eval_get))
      .route("/segments", web::get().to(segments)),
  );
}
