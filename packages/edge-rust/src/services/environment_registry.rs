// Gatrix Edge Rust - Environment Registry
// Manages organization/project/environment tree for Edge

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use log::{info, warn, error};
use serde::Deserialize;

use crate::config::EdgeConfig;

/// Environment node in the tree
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvironmentNode {
  pub id: String,
  pub name: String,
  pub display_name: Option<String>,
  pub environment_type: Option<String>,
}

/// Project node in the tree
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectNode {
  pub id: String,
  pub project_name: String,
  pub display_name: Option<String>,
  pub environments: Vec<EnvironmentNode>,
}

/// Organization node in the tree
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrgNode {
  pub id: String,
  pub org_name: String,
  pub display_name: Option<String>,
  pub projects: Vec<ProjectNode>,
}

/// Environment context (org + project for a given environment)
#[derive(Debug, Clone)]
pub struct EnvironmentContext {
  pub org_id: String,
  pub project_id: String,
}

/// Environment name resolution result
#[derive(Debug, Clone)]
pub struct EnvNameEntry {
  pub org_id: String,
  pub project_id: String,
  pub env_id: String,
}

/// Environment Registry service
pub struct EnvironmentRegistry {
  tree: Arc<RwLock<Vec<OrgNode>>>,
  env_map: Arc<RwLock<HashMap<String, EnvironmentContext>>>,
  env_name_map: Arc<RwLock<HashMap<String, EnvNameEntry>>>,
  initialized: Arc<RwLock<bool>>,
  config: EdgeConfig,
}

impl EnvironmentRegistry {
  pub fn new(config: EdgeConfig) -> Self {
    Self {
      tree: Arc::new(RwLock::new(Vec::new())),
      env_map: Arc::new(RwLock::new(HashMap::new())),
      env_name_map: Arc::new(RwLock::new(HashMap::new())),
      initialized: Arc::new(RwLock::new(false)),
      config,
    }
  }

  /// Initialize the registry
  pub async fn initialize(&self) -> Result<(), String> {
    let initialized = *self.initialized.read().await;
    if initialized {
      warn!("EnvironmentRegistry: Already initialized");
      return Ok(());
    }

    info!("EnvironmentRegistry: Initializing...");
    self.fetch_tree().await?;
    self.subscribe_to_events().await;

    let mut init = self.initialized.write().await;
    *init = true;

    let env_count = self.env_map.read().await.len();
    info!("EnvironmentRegistry: Initialized with {} environments", env_count);
    Ok(())
  }

  /// Fetch the complete org/project/env tree from backend
  pub async fn fetch_tree(&self) -> Result<(), String> {
    let url = format!(
      "{}/api/v1/server/internal/environment-tree",
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
      .map_err(|e| format!("Failed to fetch environment tree: {}", e))?;

    let body: serde_json::Value = response
      .json()
      .await
      .map_err(|e| format!("Failed to parse tree response: {}", e))?;

    if body.get("success").and_then(|v| v.as_bool()) == Some(true) {
      if let Some(orgs_value) = body.get("data").and_then(|d| d.get("organisations")) {
        let orgs: Vec<OrgNode> = serde_json::from_value(orgs_value.clone())
          .map_err(|e| format!("Failed to deserialize tree: {}", e))?;

        self.rebuild_maps(&orgs).await;

        let mut tree = self.tree.write().await;
        *tree = orgs;

        let env_count = self.env_map.read().await.len();
        info!("EnvironmentRegistry: Tree fetched with {} environments", env_count);
        return Ok(());
      }
    }

    Err("Invalid response from environment-tree API".to_string())
  }

  /// Rebuild lookup maps from tree
  async fn rebuild_maps(&self, orgs: &[OrgNode]) {
    let mut env_map = self.env_map.write().await;
    let mut env_name_map = self.env_name_map.write().await;

    env_map.clear();
    env_name_map.clear();

    for org in orgs {
      for project in &org.projects {
        for env in &project.environments {
          env_map.insert(
            env.id.clone(),
            EnvironmentContext {
              org_id: org.id.clone(),
              project_id: project.id.clone(),
            },
          );
          env_name_map.insert(
            env.name.clone(),
            EnvNameEntry {
              org_id: org.id.clone(),
              project_id: project.id.clone(),
              env_id: env.id.clone(),
            },
          );
        }
      }
    }
  }

  /// Subscribe to lifecycle events via Redis PubSub
  async fn subscribe_to_events(&self) {
    let redis_host = self.config.redis.host.clone();
    let redis_port = self.config.redis.port;
    let redis_password = self.config.redis.password.clone();
    let redis_db = self.config.redis.db;
    let tree = Arc::clone(&self.tree);
    let env_map = Arc::clone(&self.env_map);
    let env_name_map = Arc::clone(&self.env_name_map);
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
          warn!("EnvironmentRegistry: Failed to connect to Redis: {}", e);
          return;
        }
      };

      let mut pubsub = match client.get_async_pubsub().await {
        Ok(ps) => ps,
        Err(e) => {
          warn!("EnvironmentRegistry: Failed to get PubSub: {}", e);
          return;
        }
      };

      if let Err(e) = pubsub.psubscribe("gatrix-sdk-events:*").await {
        warn!("EnvironmentRegistry: Failed to subscribe: {}", e);
        return;
      }

      info!("EnvironmentRegistry: Subscribed to Redis pattern: gatrix-sdk-events:*");

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

        // Only handle lifecycle events
        let lifecycle_events = [
          "environment.created",
          "environment.deleted",
          "project.created",
          "project.deleted",
          "org.created",
          "org.deleted",
        ];

        if !lifecycle_events.contains(&event_type) {
          continue;
        }

        info!("EnvironmentRegistry: Received lifecycle event: {}", event_type);

        // Refetch tree
        let fetch_url = format!(
          "{}/api/v1/server/internal/environment-tree",
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
                if let Some(orgs_value) =
                  body.get("data").and_then(|d| d.get("organisations"))
                {
                  if let Ok(orgs) =
                    serde_json::from_value::<Vec<OrgNode>>(orgs_value.clone())
                  {
                    // Rebuild maps
                    let mut em = env_map.write().await;
                    let mut enm = env_name_map.write().await;
                    em.clear();
                    enm.clear();

                    for org in &orgs {
                      for project in &org.projects {
                        for env in &project.environments {
                          em.insert(
                            env.id.clone(),
                            EnvironmentContext {
                              org_id: org.id.clone(),
                              project_id: project.id.clone(),
                            },
                          );
                          enm.insert(
                            env.name.clone(),
                            EnvNameEntry {
                              org_id: org.id.clone(),
                              project_id: project.id.clone(),
                              env_id: env.id.clone(),
                            },
                          );
                        }
                      }
                    }

                    let mut t = tree.write().await;
                    *t = orgs;

                    info!(
                      "EnvironmentRegistry: Tree refetched with {} environments",
                      em.len()
                    );
                  }
                }
              }
            }
          }
          Err(e) => {
            error!("EnvironmentRegistry: Failed to refetch tree: {}", e);
          }
        }
      }
    });
  }

  /// Resolve environment name or ID to actual environment ID
  pub async fn resolve_environment_id(&self, name_or_id: &str) -> Option<String> {
    // Try by name first
    let env_name_map = self.env_name_map.read().await;
    if let Some(entry) = env_name_map.get(name_or_id) {
      return Some(entry.env_id.clone());
    }
    drop(env_name_map);

    // Try by ID
    let env_map = self.env_map.read().await;
    if env_map.contains_key(name_or_id) {
      return Some(name_or_id.to_string());
    }

    None
  }

  /// Check if an environment ID exists
  pub async fn has_environment(&self, environment_id: &str) -> bool {
    self.env_map.read().await.contains_key(environment_id)
  }

  /// Get all environment IDs
  pub async fn get_all_environment_ids(&self) -> Vec<String> {
    self.env_map.read().await.keys().cloned().collect()
  }

  /// Get the tree
  pub async fn get_tree(&self) -> Vec<OrgNode> {
    self.tree.read().await.clone()
  }

  /// Check if initialized
  pub async fn is_initialized(&self) -> bool {
    *self.initialized.read().await
  }
}
