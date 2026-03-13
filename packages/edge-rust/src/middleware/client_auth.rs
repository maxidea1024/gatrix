// Gatrix Edge Rust - Client Authentication
// Validates client API tokens and resolves environment context

use std::sync::Arc;
use actix_web::{HttpRequest, HttpResponse};
use log::{debug, warn};
use regex::Regex;
use std::sync::LazyLock;

use crate::services::token_mirror::TokenMirrorService;
use crate::services::environment_registry::EnvironmentRegistry;

/// Unsecured token regex: unsecured-{org}:{project}:{env}-{type}-api-token
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

/// Client context extracted from authentication
#[derive(Debug, Clone)]
pub struct ClientContext {
  pub api_token: String,
  pub application_name: String,
  pub environment_id: String,
  pub cache_key: String,
  pub client_version: Option<String>,
  pub platform: Option<String>,
  pub token_name: Option<String>,
}

/// Extract API token from request headers/query
fn extract_api_token(req: &HttpRequest) -> Option<String> {
  // Try x-api-token header
  if let Some(token) = req.headers().get("x-api-token") {
    if let Ok(t) = token.to_str() {
      return Some(t.to_string());
    }
  }

  // Try Authorization: Bearer header
  if let Some(auth) = req.headers().get("authorization") {
    if let Ok(a) = auth.to_str() {
      if let Some(token) = a.strip_prefix("Bearer ") {
        return Some(token.to_string());
      }
    }
  }

  // Try query parameters
  let query = actix_web::web::Query::<std::collections::HashMap<String, String>>::from_query(
    req.query_string(),
  );
  if let Ok(params) = query {
    if let Some(token) = params.get("token").or(params.get("apiToken")) {
      return Some(token.clone());
    }
  }

  None
}

/// Extract application name from request
fn extract_application_name(req: &HttpRequest) -> Option<String> {
  if let Some(name) = req.headers().get("x-application-name") {
    if let Ok(n) = name.to_str() {
      return Some(n.to_string());
    }
  }

  let query = actix_web::web::Query::<std::collections::HashMap<String, String>>::from_query(
    req.query_string(),
  );
  if let Ok(params) = query {
    if let Some(name) = params.get("appName").or(params.get("applicationName")) {
      return Some(name.clone());
    }
  }

  None
}

/// Authenticate a client request and return ClientContext
pub async fn authenticate_client(
  req: &HttpRequest,
  token_mirror: &Arc<TokenMirrorService>,
  env_registry: &Arc<EnvironmentRegistry>,
) -> Result<ClientContext, HttpResponse> {
  let api_token = extract_api_token(req).ok_or_else(|| {
    warn!("Missing API token in client request");
    HttpResponse::Unauthorized().json(serde_json::json!({
      "success": false,
      "error": {
        "code": "MISSING_API_TOKEN",
        "message": "x-api-token header or token query parameter is required"
      }
    }))
  })?;

  let application_name = extract_application_name(req).ok_or_else(|| {
    warn!("Missing application name in client request");
    HttpResponse::Unauthorized().json(serde_json::json!({
      "success": false,
      "error": {
        "code": "MISSING_APPLICATION_NAME",
        "message": "x-application-name header or appName query parameter is required"
      }
    }))
  })?;

  let client_version = req
    .headers()
    .get("x-client-version")
    .and_then(|v| v.to_str().ok())
    .map(|s| s.to_string());
  let platform = req
    .headers()
    .get("x-platform")
    .and_then(|v| v.to_str().ok())
    .map(|s| s.to_string());

  // 1. Try unsecured token format
  if let Some(captures) = UNSECURED_TOKEN_REGEX.captures(&api_token.clone()) {
    let env_id = captures.get(3).unwrap().as_str();
    let environment_id = env_registry
      .resolve_environment_id(env_id)
      .await
      .unwrap_or_else(|| env_id.to_string());

    debug!("Authenticated with unsecured format token, env={}", environment_id);

    return Ok(ClientContext {
      api_token,
      application_name,
      environment_id: environment_id.clone(),
      cache_key: environment_id,
      client_version,
      platform,
      token_name: Some(format!("Unsecured Token ({})", env_id)),
    });
  }

  // 2. Legacy unsecured tokens
  if LEGACY_TOKENS.contains(&api_token.as_str()) {
    let env_id = env_registry
      .resolve_environment_id(LEGACY_ENV_NAME)
      .await
      .ok_or_else(|| {
        HttpResponse::Unauthorized().json(serde_json::json!({
          "success": false,
          "error": {
            "code": "ENVIRONMENT_NOT_FOUND",
            "message": "Could not resolve environment for legacy token"
          }
        }))
      })?;

    debug!("Authenticated with legacy unsecured token, env={}", env_id);

    return Ok(ClientContext {
      api_token,
      application_name,
      environment_id: env_id.clone(),
      cache_key: env_id,
      client_version,
      platform,
      token_name: Some("Legacy Unsecured Token".to_string()),
    });
  }

  // 3. Real production token
  let validation = token_mirror.validate_token(&api_token, "client").await;

  if !validation.valid {
    let reason = validation.reason.as_deref().unwrap_or("not_found");
    let (code, message) = match reason {
      "expired" => ("TOKEN_EXPIRED", "API token has expired"),
      "invalid_type" => (
        "INVALID_TOKEN_TYPE",
        "Token is not authorized for client API access",
      ),
      "invalid_environment" => (
        "INVALID_ENVIRONMENT",
        "Token is not authorized for this environment",
      ),
      _ => ("INVALID_TOKEN", "Invalid API token"),
    };

    warn!("Client authentication failed: {}", reason);

    return Err(HttpResponse::Unauthorized().json(serde_json::json!({
      "success": false,
      "error": { "code": code, "message": message }
    })));
  }

  let token = validation.token.as_ref();
  let token_env_id = token
    .and_then(|t| t.environment_id.as_ref())
    .ok_or_else(|| {
      HttpResponse::Unauthorized().json(serde_json::json!({
        "success": false,
        "error": {
          "code": "INVALID_TOKEN",
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
        "code": "ENVIRONMENT_NOT_FOUND",
        "message": format!("Could not resolve environment: {}", token_env_id)
      }
    })));
  }

  debug!("Client authenticated, env={}", env_id);

  Ok(ClientContext {
    api_token,
    application_name,
    environment_id: env_id.clone(),
    cache_key: env_id,
    client_version,
    platform,
    token_name: token.map(|t| t.token_name.clone()),
  })
}
