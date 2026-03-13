// Gatrix Edge Rust - Server Authentication
// Validates server API tokens and resolves environment context

use std::sync::Arc;
use actix_web::{HttpRequest, HttpResponse};
use log::{debug, warn};
use regex::Regex;
use std::sync::LazyLock;

use crate::services::token_mirror::TokenMirrorService;
use crate::services::environment_registry::EnvironmentRegistry;

/// Unsecured token regex
static UNSECURED_TOKEN_REGEX: LazyLock<Regex> = LazyLock::new(|| {
  Regex::new(r"^unsecured-([^:]+):([^:]+):(.+)-(server|client|edge)-api-token$").unwrap()
});

/// Legacy unsecured tokens
const LEGACY_TOKENS: &[&str] = &[
  "unsecured-client-api-token",
  "unsecured-server-api-token",
  "unsecured-edge-api-token",
];

const LEGACY_ENV_NAME: &str = "development";

/// Server context extracted from authentication
#[derive(Debug, Clone)]
pub struct ServerContext {
  pub environment_id: String,
  pub cache_key: String,
  pub application_name: String,
}

/// Authenticate a server request and return ServerContext
pub async fn authenticate_server(
  req: &HttpRequest,
  token_mirror: &Arc<TokenMirrorService>,
  env_registry: &Arc<EnvironmentRegistry>,
) -> Result<ServerContext, HttpResponse> {
  let api_token = req
    .headers()
    .get("x-api-token")
    .and_then(|v| v.to_str().ok())
    .ok_or_else(|| {
      HttpResponse::Unauthorized().json(serde_json::json!({
        "success": false,
        "error": {
          "code": "AUTH_TOKEN_REQUIRED",
          "message": "x-api-token header is required"
        }
      }))
    })?;

  let application_name = req
    .headers()
    .get("x-application-name")
    .and_then(|v| v.to_str().ok())
    .unwrap_or("unknown")
    .to_string();

  // 1. Try unsecured token format
  if let Some(captures) = UNSECURED_TOKEN_REGEX.captures(api_token) {
    let env_id = captures.get(3).unwrap().as_str();
    let environment_id = env_registry
      .resolve_environment_id(env_id)
      .await
      .unwrap_or_else(|| env_id.to_string());

    debug!("Server auth: unsecured token, env={}", environment_id);

    return Ok(ServerContext {
      environment_id: environment_id.clone(),
      cache_key: environment_id,
      application_name,
    });
  }

  // 2. Legacy unsecured tokens
  if LEGACY_TOKENS.contains(&api_token) {
    let env_id = env_registry
      .resolve_environment_id(LEGACY_ENV_NAME)
      .await
      .ok_or_else(|| {
        HttpResponse::Unauthorized().json(serde_json::json!({
          "success": false,
          "error": {
            "code": "AUTH_TOKEN_INVALID",
            "message": "Could not resolve environment for legacy token"
          }
        }))
      })?;

    debug!("Server auth: legacy token, env={}", env_id);

    return Ok(ServerContext {
      environment_id: env_id.clone(),
      cache_key: env_id,
      application_name,
    });
  }

  // 3. Real production token
  let validation = token_mirror.validate_token(api_token, "server").await;
  if !validation.valid {
    warn!("Server authentication failed");
    return Err(HttpResponse::Unauthorized().json(serde_json::json!({
      "success": false,
      "error": {
        "code": "AUTH_TOKEN_INVALID",
        "message": "Invalid or unauthorized server API token"
      }
    })));
  }

  let token = validation.token.as_ref();
  let token_env_id = token
    .and_then(|t| t.environment_id.as_ref())
    .ok_or_else(|| {
      HttpResponse::Unauthorized().json(serde_json::json!({
        "success": false,
        "error": {
          "code": "AUTH_TOKEN_INVALID",
          "message": "Token does not have a specific environment binding"
        }
      }))
    })?;

  let env_id = env_registry
    .resolve_environment_id(token_env_id)
    .await
    .unwrap_or_else(|| token_env_id.clone());

  if !env_registry.has_environment(&env_id).await {
    return Err(HttpResponse::Unauthorized().json(serde_json::json!({
      "success": false,
      "error": {
        "code": "AUTH_TOKEN_INVALID",
        "message": format!("Could not resolve environment: {}", token_env_id)
      }
    })));
  }

  debug!("Server authenticated, env={}", env_id);

  Ok(ServerContext {
    environment_id: env_id.clone(),
    cache_key: env_id,
    application_name,
  })
}
