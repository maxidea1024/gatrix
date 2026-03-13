// Gatrix Edge Rust - App State
// Shared application state accessible from all route handlers

use std::sync::Arc;
use gatrix_rust_server_sdk::GatrixServerSDK;
use tokio::sync::RwLock;

use crate::services::token_mirror::TokenMirrorService;
use crate::services::environment_registry::EnvironmentRegistry;
use crate::config::EdgeConfig;

/// Shared application state
pub struct AppState {
  pub sdk: Arc<RwLock<GatrixServerSDK>>,
  pub token_mirror: Arc<TokenMirrorService>,
  pub env_registry: Arc<EnvironmentRegistry>,
  pub config: EdgeConfig,
}
