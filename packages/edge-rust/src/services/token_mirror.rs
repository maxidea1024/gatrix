// Gatrix Edge Rust - Token Mirror Service
// Mirrors all API tokens from backend for local validation

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use log::{info, warn, error, debug};
use serde::Deserialize;

use crate::config::EdgeConfig;

/// Unsecured token constants
pub const UNSECURED_CLIENT_TOKEN: &str = "unsecured-client-api-token";
pub const UNSECURED_SERVER_TOKEN: &str = "unsecured-server-api-token";
pub const UNSECURED_EDGE_TOKEN: &str = "unsecured-edge-api-token";

pub const UNSECURED_TOKENS: &[&str] = &[
  UNSECURED_CLIENT_TOKEN,
  UNSECURED_SERVER_TOKEN,
  UNSECURED_EDGE_TOKEN,
];

/// Token structure mirrored from backend
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MirroredToken {
  pub id: i64,
  pub token_name: String,
  pub token_value: String,
  pub token_type: String, // "client" | "server" | "edge"
  pub org_id: Option<String>,
  pub project_id: Option<String>,
  pub environment_id: Option<String>,
  pub expires_at: Option<String>,
  pub created_at: String,
  pub updated_at: String,
}

/// Token validation result
pub struct TokenValidationResult {
  pub valid: bool,
  pub token: Option<MirroredToken>,
  pub reason: Option<String>,
}

/// Token mirror service
pub struct TokenMirrorService {
  tokens: Arc<RwLock<HashMap<String, MirroredToken>>>,
  initialized: Arc<RwLock<bool>>,
  config: EdgeConfig,
}

impl TokenMirrorService {
  pub fn new(config: EdgeConfig) -> Self {
    Self {
      tokens: Arc::new(RwLock::new(HashMap::new())),
      initialized: Arc::new(RwLock::new(false)),
      config,
    }
  }

  /// Initialize the token mirror service
  pub async fn initialize(&self) -> Result<(), String> {
    let initialized = *self.initialized.read().await;
    if initialized {
      warn!("TokenMirror: Already initialized");
      return Ok(());
    }

    info!("TokenMirror: Initializing...");
    self.fetch_all_tokens().await?;

    // Start Redis PubSub listener for token changes
    self.subscribe_to_events().await;

    let mut init = self.initialized.write().await;
    *init = true;

    let count = self.tokens.read().await.len();
    info!("TokenMirror: Initialized with {} tokens", count);
    Ok(())
  }

  /// Fetch all tokens from backend
  pub async fn fetch_all_tokens(&self) -> Result<(), String> {
    let url = format!(
      "{}/api/v1/server/internal/tokens",
      self.config.gatrix_url
    );

    let client = reqwest::Client::new();
    let response = client
      .get(&url)
      .header("x-api-token", &self.config.api_token)
      .header("x-application-name", &self.config.app_name)
      .timeout(std::time::Duration::from_secs(10))
      .send()
      .await
      .map_err(|e| format!("Failed to fetch tokens: {}", e))?;

    let body: serde_json::Value = response
      .json()
      .await
      .map_err(|e| format!("Failed to parse token response: {}", e))?;

    if body.get("success").and_then(|v| v.as_bool()) == Some(true) {
      if let Some(data) = body.get("data").and_then(|d| d.get("tokens")) {
        let tokens: Vec<MirroredToken> = serde_json::from_value(data.clone())
          .map_err(|e| format!("Failed to deserialize tokens: {}", e))?;

        let mut map = self.tokens.write().await;
        map.clear();
        for token in &tokens {
          map.insert(token.token_value.clone(), token.clone());
        }

        info!("TokenMirror: Fetched {} tokens from backend", tokens.len());
        return Ok(());
      }
    }

    Err("Invalid response from backend token API".to_string())
  }

  /// Subscribe to Redis PubSub for token change events
  async fn subscribe_to_events(&self) {
    let redis_host = self.config.redis.host.clone();
    let redis_port = self.config.redis.port;
    let redis_password = self.config.redis.password.clone();
    let redis_db = self.config.redis.db;
    let tokens = Arc::clone(&self.tokens);
    let config = self.config.clone();

    tokio::spawn(async move {
      let url = if let Some(password) = &redis_password {
        format!(
          "redis://:{}@{}:{}/{}",
          password, redis_host, redis_port, redis_db
        )
      } else {
        format!("redis://{}:{}/{}", redis_host, redis_port, redis_db)
      };

      let client = match redis::Client::open(url.as_str()) {
        Ok(c) => c,
        Err(e) => {
          warn!("TokenMirror: Failed to connect to Redis: {}", e);
          return;
        }
      };

      let mut pubsub = match client.get_async_pubsub().await {
        Ok(ps) => ps,
        Err(e) => {
          warn!("TokenMirror: Failed to get PubSub connection: {}", e);
          return;
        }
      };

      if let Err(e) = pubsub.psubscribe("gatrix-sdk-events:*").await {
        warn!("TokenMirror: Failed to subscribe: {}", e);
        return;
      }

      info!("TokenMirror: Subscribed to Redis pattern: gatrix-sdk-events:*");

      use futures_util::StreamExt;
      let mut stream = pubsub.on_message();

      while let Some(msg) = stream.next().await {
        let payload: String = match msg.get_payload() {
          Ok(p) => p,
          Err(_) => continue,
        };

        let event: serde_json::Value = match serde_json::from_str(&payload) {
          Ok(v) => v,
          Err(_) => continue,
        };

        let event_type = event
          .get("type")
          .and_then(|v| v.as_str())
          .unwrap_or("");

        if !event_type.starts_with("api_token.") {
          continue;
        }

        info!("TokenMirror: Received event: {}", event_type);

        // Refetch all tokens on any token change event
        let fetch_url = format!(
          "{}/api/v1/server/internal/tokens",
          config.gatrix_url
        );

        let http_client = reqwest::Client::new();
        match http_client
          .get(&fetch_url)
          .header("x-api-token", &config.api_token)
          .header("x-application-name", &config.app_name)
          .timeout(std::time::Duration::from_secs(10))
          .send()
          .await
        {
          Ok(resp) => {
            if let Ok(body) = resp.json::<serde_json::Value>().await {
              if body.get("success").and_then(|v| v.as_bool()) == Some(true) {
                if let Some(data) = body.get("data").and_then(|d| d.get("tokens")) {
                  if let Ok(new_tokens) =
                    serde_json::from_value::<Vec<MirroredToken>>(data.clone())
                  {
                    let mut map = tokens.write().await;
                    map.clear();
                    for token in &new_tokens {
                      map.insert(token.token_value.clone(), token.clone());
                    }
                    info!(
                      "TokenMirror: Refetched {} tokens after event",
                      new_tokens.len()
                    );
                  }
                }
              }
            }
          }
          Err(e) => {
            error!("TokenMirror: Failed to refetch tokens: {}", e);
          }
        }
      }
    });
  }

  /// Validate a token
  pub async fn validate_token(
    &self,
    token_value: &str,
    required_type: &str,
  ) -> TokenValidationResult {
    // Check unsecured tokens
    if token_value == self.config.unsecured_client_token
      || UNSECURED_TOKENS.contains(&token_value)
    {
      debug!("TokenMirror: Unsecured token used");
      return TokenValidationResult {
        valid: true,
        token: Some(MirroredToken {
          id: 0,
          token_name: "Unsecured Token (Testing)".to_string(),
          token_value: token_value.to_string(),
          token_type: "server".to_string(),
          org_id: None,
          project_id: None,
          environment_id: None,
          expires_at: None,
          created_at: chrono::Utc::now().to_rfc3339(),
          updated_at: chrono::Utc::now().to_rfc3339(),
        }),
        reason: None,
      };
    }

    let tokens = self.tokens.read().await;
    let token = match tokens.get(token_value) {
      Some(t) => t.clone(),
      None => {
        return TokenValidationResult {
          valid: false,
          token: None,
          reason: Some("not_found".to_string()),
        };
      }
    };

    // Check expiration
    if let Some(ref expires_at) = token.expires_at {
      if let Ok(exp) = chrono::DateTime::parse_from_rfc3339(expires_at) {
        if chrono::Utc::now() > exp {
          return TokenValidationResult {
            valid: false,
            token: Some(token),
            reason: Some("expired".to_string()),
          };
        }
      }
    }

    // Check token type
    if token.token_type != required_type {
      return TokenValidationResult {
        valid: false,
        token: Some(token),
        reason: Some("invalid_type".to_string()),
      };
    }

    TokenValidationResult {
      valid: true,
      token: Some(token),
      reason: None,
    }
  }

  /// Get token count
  pub async fn get_token_count(&self) -> usize {
    self.tokens.read().await.len()
  }

  /// Check if initialized
  pub async fn is_initialized(&self) -> bool {
    *self.initialized.read().await
  }
}
