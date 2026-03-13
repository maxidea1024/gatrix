// Gatrix Rust Server SDK
// All service implementations
// Each service follows the service-namespaced access pattern from the SDK spec

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use log::{debug, info, warn};

use crate::client::ApiClient;
use crate::error::{FeatureFlagError, GatrixError};
use crate::evaluator;
use crate::types::api::*;
use crate::types::feature_flags::*;

// ============================================================================
// BaseEnvironmentService — shared cache pattern
// ============================================================================

/// Generic environment-scoped cache for service data
pub struct EnvironmentCache<T: Clone> {
    data: Arc<RwLock<HashMap<String, Vec<T>>>>,
    default_env: String,
}

impl<T: Clone> EnvironmentCache<T> {
    pub fn new(default_env: String) -> Self {
        Self {
            data: Arc::new(RwLock::new(HashMap::new())),
            default_env,
        }
    }

    pub async fn get_cached(&self, environment_id: Option<&str>) -> Vec<T> {
        let key = environment_id.unwrap_or(&self.default_env);
        let data = self.data.read().await;
        data.get(key).cloned().unwrap_or_default()
    }

    pub async fn update_cache(&self, items: Vec<T>, environment_id: Option<&str>) {
        let key = environment_id.unwrap_or(&self.default_env).to_string();
        let mut data = self.data.write().await;
        data.insert(key, items);
    }

    pub async fn clear_cache(&self) {
        let mut data = self.data.write().await;
        data.clear();
    }
}

// ============================================================================
// GameWorldService
// ============================================================================

pub struct GameWorldService {
    api_client: Arc<ApiClient>,
    cache: EnvironmentCache<GameWorld>,
    feature_enabled: bool,
}

impl GameWorldService {
    pub fn new(api_client: Arc<ApiClient>, default_env: String) -> Self {
        Self {
            api_client,
            cache: EnvironmentCache::new(default_env),
            feature_enabled: true,
        }
    }

    pub fn set_feature_enabled(&mut self, enabled: bool) {
        self.feature_enabled = enabled;
    }

    /// Fetch game worlds from API
    pub async fn fetch_by_environment(&self, environment_id: Option<&str>) -> Result<Vec<GameWorld>, GatrixError> {
        let response: ApiResponse<GameWorldListResponse> = self.api_client.get("/api/v1/server/game-worlds").await?;
        if let Some(data) = response.data {
            let mut worlds = data.worlds;
            worlds.sort_by_key(|w| w.display_order);
            self.cache.update_cache(worlds.clone(), environment_id).await;
            info!("Game worlds fetched: {} worlds", worlds.len());
            Ok(worlds)
        } else {
            Err(GatrixError::new(crate::error::ErrorCode::ApiError, "Failed to fetch game worlds"))
        }
    }

    /// Get cached game worlds (sorted by displayOrder)
    pub async fn get_cached(&self, environment_id: Option<&str>) -> Vec<GameWorld> {
        self.cache.get_cached(environment_id).await
    }

    /// Get a world by worldId
    pub async fn get_by_world_id(&self, world_id: &str, environment_id: Option<&str>) -> Option<GameWorld> {
        let worlds = self.cache.get_cached(environment_id).await;
        worlds.into_iter().find(|w| w.world_id == world_id)
    }

    /// Check if world maintenance is currently active (time-based)
    pub async fn is_world_maintenance_active(&self, world_id: &str, environment_id: Option<&str>) -> bool {
        let world = match self.get_by_world_id(world_id, environment_id).await {
            Some(w) => w,
            None => return false,
        };
        if !world.is_maintenance {
            return false;
        }
        let now = chrono::Utc::now();
        let start_ok = match &world.maintenance_start_date {
            Some(s) => chrono::DateTime::parse_from_rfc3339(s).map(|t| now >= t).unwrap_or(true),
            None => true,
        };
        let end_ok = match &world.maintenance_end_date {
            Some(s) => chrono::DateTime::parse_from_rfc3339(s).map(|t| now <= t).unwrap_or(true),
            None => true,
        };
        start_ok && end_ok
    }

    /// Get localized maintenance message
    pub async fn get_world_maintenance_message(&self, world_id: &str, environment_id: Option<&str>, lang: Option<&str>) -> Option<String> {
        let world = self.get_by_world_id(world_id, environment_id).await?;
        if let (Some(true), Some(locales), Some(lang)) = (world.supports_multi_language, &world.maintenance_locales, lang) {
            if let Some(locale) = locales.iter().find(|l| l.lang == lang) {
                return Some(locale.message.clone());
            }
        }
        world.maintenance_message.clone()
    }
}

// ============================================================================
// PopupNoticeService
// ============================================================================

pub struct PopupNoticeService {
    api_client: Arc<ApiClient>,
    cache: EnvironmentCache<PopupNotice>,
    feature_enabled: bool,
}

impl PopupNoticeService {
    pub fn new(api_client: Arc<ApiClient>, default_env: String) -> Self {
        Self {
            api_client,
            cache: EnvironmentCache::new(default_env),
            feature_enabled: true,
        }
    }

    pub fn set_feature_enabled(&mut self, enabled: bool) {
        self.feature_enabled = enabled;
    }

    pub async fn fetch_by_environment(&self, environment_id: Option<&str>) -> Result<Vec<PopupNotice>, GatrixError> {
        let response: ApiResponse<Vec<PopupNotice>> = self.api_client.get("/api/v1/server/popup-notices").await?;
        if let Some(notices) = response.data {
            self.cache.update_cache(notices.clone(), environment_id).await;
            info!("Popup notices fetched: {} notices", notices.len());
            Ok(notices)
        } else {
            Err(GatrixError::new(crate::error::ErrorCode::ApiError, "Failed to fetch popup notices"))
        }
    }

    pub async fn get_cached(&self, environment_id: Option<&str>) -> Vec<PopupNotice> {
        self.cache.get_cached(environment_id).await
    }

    /// Get notices filtered by world
    pub async fn get_for_world(&self, world_id: &str, environment_id: Option<&str>) -> Vec<PopupNotice> {
        let notices = self.cache.get_cached(environment_id).await;
        notices.into_iter().filter(|n| {
            match &n.target_worlds {
                None => true,
                Some(worlds) if worlds.is_empty() => true,
                Some(worlds) => {
                    let matches = worlds.contains(&world_id.to_string());
                    if n.target_worlds_inverted.unwrap_or(false) { !matches } else { matches }
                }
            }
        }).collect()
    }
}

// ============================================================================
// SurveyService
// ============================================================================

pub struct SurveyService {
    api_client: Arc<ApiClient>,
    cache: EnvironmentCache<Survey>,
    settings_cache: Arc<RwLock<HashMap<String, SurveySettings>>>,
    default_env: String,
    feature_enabled: bool,
}

impl SurveyService {
    pub fn new(api_client: Arc<ApiClient>, default_env: String) -> Self {
        Self {
            api_client,
            cache: EnvironmentCache::new(default_env.clone()),
            settings_cache: Arc::new(RwLock::new(HashMap::new())),
            default_env,
            feature_enabled: true,
        }
    }

    pub fn set_feature_enabled(&mut self, enabled: bool) {
        self.feature_enabled = enabled;
    }

    pub async fn fetch_by_environment(&self, environment_id: Option<&str>) -> Result<Vec<Survey>, GatrixError> {
        #[derive(serde::Deserialize)]
        struct SurveyResponse {
            surveys: Vec<Survey>,
            settings: Option<SurveySettings>,
        }
        let response: ApiResponse<SurveyResponse> = self.api_client.get("/api/v1/server/surveys").await?;
        if let Some(data) = response.data {
            self.cache.update_cache(data.surveys.clone(), environment_id).await;
            if let Some(settings) = data.settings {
                let key = environment_id.unwrap_or(&self.default_env).to_string();
                let mut sc = self.settings_cache.write().await;
                sc.insert(key, settings);
            }
            info!("Surveys fetched: {} surveys", data.surveys.len());
            Ok(data.surveys)
        } else {
            Err(GatrixError::new(crate::error::ErrorCode::ApiError, "Failed to fetch surveys"))
        }
    }

    pub async fn get_cached(&self, environment_id: Option<&str>) -> Vec<Survey> {
        self.cache.get_cached(environment_id).await
    }

    pub async fn get_cached_settings(&self, environment_id: Option<&str>) -> Option<SurveySettings> {
        let key = environment_id.unwrap_or(&self.default_env);
        let sc = self.settings_cache.read().await;
        sc.get(key).cloned()
    }
}

// ============================================================================
// WhitelistService
// ============================================================================

pub struct WhitelistService {
    api_client: Arc<ApiClient>,
    cache: Arc<RwLock<HashMap<String, WhitelistData>>>,
    default_env: String,
    feature_enabled: bool,
}

impl WhitelistService {
    pub fn new(api_client: Arc<ApiClient>, default_env: String) -> Self {
        Self {
            api_client,
            cache: Arc::new(RwLock::new(HashMap::new())),
            default_env,
            feature_enabled: true,
        }
    }

    pub fn set_feature_enabled(&mut self, enabled: bool) {
        self.feature_enabled = enabled;
    }

    pub async fn fetch_by_environment(&self, environment_id: Option<&str>) -> Result<WhitelistData, GatrixError> {
        let response: ApiResponse<WhitelistData> = self.api_client.get("/api/v1/server/whitelist").await?;
        if let Some(data) = response.data {
            let key = environment_id.unwrap_or(&self.default_env).to_string();
            let mut cache = self.cache.write().await;
            cache.insert(key, data.clone());
            info!("Whitelist fetched");
            Ok(data)
        } else {
            Err(GatrixError::new(crate::error::ErrorCode::ApiError, "Failed to fetch whitelist"))
        }
    }

    pub async fn get_cached(&self, environment_id: Option<&str>) -> Option<WhitelistData> {
        let key = environment_id.unwrap_or(&self.default_env);
        let cache = self.cache.read().await;
        cache.get(key).cloned()
    }

    /// Check if IP is whitelisted (supports CIDR notation)
    pub async fn is_ip_whitelisted(&self, ip: &str, environment_id: Option<&str>) -> bool {
        let data = match self.get_cached(environment_id).await {
            Some(d) => d,
            None => return false,
        };
        if !data.ip_whitelist.enabled {
            return false;
        }
        data.ip_whitelist.ips.iter().any(|whitelisted| {
            whitelisted == ip || {
                // Parse CIDR
                if let Ok(network) = whitelisted.parse::<ipnet::IpNet>() {
                    if let Ok(addr) = ip.parse::<std::net::IpAddr>() {
                        return network.contains(&addr);
                    }
                }
                false
            }
        })
    }

    /// Check if account is whitelisted
    pub async fn is_account_whitelisted(&self, account_id: &str, environment_id: Option<&str>) -> bool {
        let data = match self.get_cached(environment_id).await {
            Some(d) => d,
            None => return false,
        };
        if !data.account_whitelist.enabled {
            return false;
        }
        data.account_whitelist.account_ids.contains(&account_id.to_string())
    }
}

// ============================================================================
// ServiceMaintenanceService
// ============================================================================

pub struct ServiceMaintenanceService {
    api_client: Arc<ApiClient>,
    cache: Arc<RwLock<HashMap<String, MaintenanceStatus>>>,
    default_env: String,
    feature_enabled: bool,
}

impl ServiceMaintenanceService {
    pub fn new(api_client: Arc<ApiClient>, default_env: String) -> Self {
        Self {
            api_client,
            cache: Arc::new(RwLock::new(HashMap::new())),
            default_env,
            feature_enabled: true,
        }
    }

    pub fn set_feature_enabled(&mut self, enabled: bool) {
        self.feature_enabled = enabled;
    }

    pub async fn fetch_by_environment(&self, environment_id: Option<&str>) -> Result<MaintenanceStatus, GatrixError> {
        let response: ApiResponse<MaintenanceStatus> = self.api_client.get("/api/v1/server/maintenance").await?;
        if let Some(data) = response.data {
            let key = environment_id.unwrap_or(&self.default_env).to_string();
            let mut cache = self.cache.write().await;
            cache.insert(key, data.clone());
            info!("Maintenance status fetched");
            Ok(data)
        } else {
            Err(GatrixError::new(crate::error::ErrorCode::ApiError, "Failed to fetch maintenance"))
        }
    }

    pub async fn get_status(&self, environment_id: Option<&str>) -> Option<MaintenanceStatus> {
        let key = environment_id.unwrap_or(&self.default_env);
        let cache = self.cache.read().await;
        cache.get(key).cloned()
    }

    /// Check if maintenance is currently active (time-based)
    pub async fn is_active(&self, environment_id: Option<&str>) -> bool {
        match self.get_status(environment_id).await {
            Some(s) => s.is_maintenance_active,
            None => false,
        }
    }

    /// Get localized maintenance message
    pub async fn get_message(&self, environment_id: Option<&str>, lang: Option<&str>) -> Option<String> {
        let status = self.get_status(environment_id).await?;
        let detail = status.detail?;
        if let (Some(lang), Some(locales)) = (lang, &detail.locale_messages) {
            if let Some(msg) = locales.get(lang) {
                return Some(msg.clone());
            }
        }
        Some(detail.message)
    }
}

// ============================================================================
// StoreProductService
// ============================================================================

pub struct StoreProductService {
    api_client: Arc<ApiClient>,
    cache: EnvironmentCache<StoreProduct>,
    feature_enabled: bool,
}

impl StoreProductService {
    pub fn new(api_client: Arc<ApiClient>, default_env: String) -> Self {
        Self {
            api_client,
            cache: EnvironmentCache::new(default_env),
            feature_enabled: true,
        }
    }

    pub fn set_feature_enabled(&mut self, enabled: bool) {
        self.feature_enabled = enabled;
    }

    pub async fn fetch_by_environment(&self, environment_id: Option<&str>) -> Result<Vec<StoreProduct>, GatrixError> {
        let response: ApiResponse<StoreProductListResponse> = self.api_client.get("/api/v1/server/store-products").await?;
        if let Some(data) = response.data {
            self.cache.update_cache(data.products.clone(), environment_id).await;
            info!("Store products fetched: {} products", data.products.len());
            Ok(data.products)
        } else {
            Err(GatrixError::new(crate::error::ErrorCode::ApiError, "Failed to fetch store products"))
        }
    }

    pub async fn get_cached(&self, environment_id: Option<&str>) -> Vec<StoreProduct> {
        self.cache.get_cached(environment_id).await
    }
}

// ============================================================================
// FeatureFlagService
// ============================================================================

pub struct FeatureFlagService {
    api_client: Arc<ApiClient>,
    /// Flags cached per environment: env_id → (flag_name → FeatureFlag)
    cached_flags: Arc<RwLock<HashMap<String, HashMap<String, FeatureFlag>>>>,
    /// Segments per project: project_id → (segment_name → FeatureSegment)
    cached_segments: Arc<RwLock<HashMap<String, HashMap<String, FeatureSegment>>>>,
    /// Environment → project mapping
    env_to_project: Arc<RwLock<HashMap<String, String>>>,
    /// Metrics buffer
    metrics_buffer: Arc<RwLock<Vec<FlagMetric>>>,
    default_env: String,
    feature_enabled: bool,
    compact_flags: bool,
    /// Static context (merged with per-evaluation context)
    static_context: Arc<RwLock<EvaluationContext>>,
}

impl FeatureFlagService {
    pub fn new(api_client: Arc<ApiClient>, default_env: String) -> Self {
        Self {
            api_client,
            cached_flags: Arc::new(RwLock::new(HashMap::new())),
            cached_segments: Arc::new(RwLock::new(HashMap::new())),
            env_to_project: Arc::new(RwLock::new(HashMap::new())),
            metrics_buffer: Arc::new(RwLock::new(Vec::new())),
            default_env,
            feature_enabled: true,
            compact_flags: true,
            static_context: Arc::new(RwLock::new(EvaluationContext::default())),
        }
    }

    pub fn set_feature_enabled(&mut self, enabled: bool) {
        self.feature_enabled = enabled;
    }

    pub fn set_compact_flags(&mut self, enabled: bool) {
        self.compact_flags = enabled;
    }

    /// Set static context (merged with per-evaluation context)
    pub async fn set_static_context(&self, ctx: EvaluationContext) {
        let mut sc = self.static_context.write().await;
        *sc = ctx;
    }

    /// Merge static context with per-evaluation context
    async fn merge_context(&self, ctx: &EvaluationContext) -> EvaluationContext {
        let sc = self.static_context.read().await;
        EvaluationContext {
            user_id: ctx.user_id.clone().or_else(|| sc.user_id.clone()),
            session_id: ctx.session_id.clone().or_else(|| sc.session_id.clone()),
            app_name: ctx.app_name.clone().or_else(|| sc.app_name.clone()),
            app_version: ctx.app_version.clone().or_else(|| sc.app_version.clone()),
            remote_address: ctx.remote_address.clone().or_else(|| sc.remote_address.clone()),
            properties: {
                let mut props = sc.properties.clone();
                props.extend(ctx.properties.clone());
                props
            },
        }
    }

    /// Fetch all flags for a specific environment
    pub async fn fetch_by_environment(&self, environment_id: Option<&str>) -> Result<Vec<FeatureFlag>, GatrixError> {
        let env = environment_id.unwrap_or(&self.default_env);
        let mut endpoint = "/api/v1/server/features".to_string();
        if self.compact_flags {
            endpoint.push_str("?compact=true");
        }

        let response: ApiResponse<FeatureFlagsApiResponse> = self.api_client.get(&endpoint).await?;
        if let Some(data) = response.data {
            // Cache flags by name
            let mut flag_map = HashMap::new();
            for flag in &data.flags {
                flag_map.insert(flag.name.clone(), flag.clone());
            }
            {
                let mut cache = self.cached_flags.write().await;
                cache.insert(env.to_string(), flag_map);
            }

            // Cache segments per project
            if let Some(project_id) = &data.project_id {
                {
                    let mut etp = self.env_to_project.write().await;
                    etp.insert(env.to_string(), project_id.clone());
                }
                if let Some(segments) = &data.segments {
                    let mut seg_map = HashMap::new();
                    for seg in segments {
                        seg_map.insert(seg.name.clone(), seg.clone());
                    }
                    let mut cs = self.cached_segments.write().await;
                    cs.insert(project_id.clone(), seg_map);
                    info!("Feature segments cached: {} segments for project {}", segments.len(), project_id);
                }
            }

            info!("Feature flags fetched: {} flags for env {}", data.flags.len(), env);
            Ok(data.flags)
        } else {
            Err(GatrixError::new(crate::error::ErrorCode::ApiError, "Failed to fetch feature flags"))
        }
    }

    /// Get all cached flags as array
    pub async fn get_cached(&self, environment_id: Option<&str>) -> Vec<FeatureFlag> {
        let env = environment_id.unwrap_or(&self.default_env);
        let cache = self.cached_flags.read().await;
        cache.get(env).map(|m| m.values().cloned().collect()).unwrap_or_default()
    }

    /// Get a single flag by name from cache (O(1) lookup)
    pub async fn get_flag_by_name(&self, flag_name: &str, environment_id: Option<&str>) -> Option<FeatureFlag> {
        let env = environment_id.unwrap_or(&self.default_env);
        let cache = self.cached_flags.read().await;
        cache.get(env)?.get(flag_name).cloned()
    }

    /// Resolve segments for a given environment
    async fn get_segments_for_env(&self, environment_id: &str) -> HashMap<String, FeatureSegment> {
        let etp = self.env_to_project.read().await;
        let project_id = match etp.get(environment_id) {
            Some(pid) => pid.clone(),
            None => return HashMap::new(),
        };
        drop(etp);
        let cs = self.cached_segments.read().await;
        cs.get(&project_id).cloned().unwrap_or_default()
    }

    /// Record a metric
    async fn record_metric(&self, flag_name: &str, enabled: bool, variant_name: Option<&str>, environment_id: &str) {
        let metric = FlagMetric {
            environment_id: environment_id.to_string(),
            flag_name: flag_name.to_string(),
            enabled,
            variant_name: variant_name.map(|s| s.to_string()),
            timestamp: chrono::Utc::now(),
        };
        let mut buffer = self.metrics_buffer.write().await;
        buffer.push(metric);
    }

    /// Internal evaluate
    async fn evaluate_internal(&self, flag: &FeatureFlag, ctx: Option<&EvaluationContext>, environment_id: Option<&str>) -> EvaluationResult {
        let env = environment_id.unwrap_or(&self.default_env);
        let merged_ctx = match ctx {
            Some(c) => self.merge_context(c).await,
            None => self.static_context.read().await.clone(),
        };
        let segments = self.get_segments_for_env(env).await;
        let result = evaluator::evaluate(flag, &merged_ctx, &segments);

        self.record_metric(
            &flag.name,
            result.enabled,
            result.variant.as_ref().map(|v| v.name.as_str()),
            env,
        ).await;

        result
    }

    /// Check if a feature flag is enabled
    pub async fn is_enabled(&self, flag_name: &str, fallback: bool, ctx: Option<&EvaluationContext>, environment_id: Option<&str>) -> bool {
        let flag = match self.get_flag_by_name(flag_name, environment_id).await {
            Some(f) => f,
            None => return fallback,
        };
        let result = self.evaluate_internal(&flag, ctx, environment_id).await;
        result.enabled
    }

    /// Evaluate a flag and return full result
    pub async fn evaluate(&self, flag_name: &str, ctx: Option<&EvaluationContext>, environment_id: Option<&str>) -> EvaluationResult {
        let flag = match self.get_flag_by_name(flag_name, environment_id).await {
            Some(f) => f,
            None => {
                return EvaluationResult {
                    id: String::new(),
                    flag_name: flag_name.to_string(),
                    enabled: false,
                    reason: EvaluationReason::NotFound,
                    variant: Some(Variant {
                        name: value_source::MISSING.to_string(),
                        weight: 100,
                        enabled: false,
                        value: None,
                    }),
                };
            }
        };
        self.evaluate_internal(&flag, ctx, environment_id).await
    }

    /// Get string variation value
    pub async fn string_variation(&self, flag_name: &str, fallback: &str, ctx: Option<&EvaluationContext>, environment_id: Option<&str>) -> String {
        let flag = match self.get_flag_by_name(flag_name, environment_id).await {
            Some(f) => f,
            None => return fallback.to_string(),
        };
        let result = self.evaluate_internal(&flag, ctx, environment_id).await;
        if flag.value_type.as_deref() != Some("string") {
            return fallback.to_string();
        }
        result.variant.and_then(|v| v.value).map(|v| match v {
            serde_json::Value::String(s) => s,
            other => other.to_string(),
        }).unwrap_or_else(|| fallback.to_string())
    }

    /// Get number variation value
    pub async fn number_variation(&self, flag_name: &str, fallback: f64, ctx: Option<&EvaluationContext>, environment_id: Option<&str>) -> f64 {
        let flag = match self.get_flag_by_name(flag_name, environment_id).await {
            Some(f) => f,
            None => return fallback,
        };
        let result = self.evaluate_internal(&flag, ctx, environment_id).await;
        if flag.value_type.as_deref() != Some("number") {
            return fallback;
        }
        result.variant.and_then(|v| v.value).and_then(|v| v.as_f64()).unwrap_or(fallback)
    }

    /// Get boolean variation value (NOT same as isEnabled — this returns the variant VALUE)
    pub async fn bool_variation(&self, flag_name: &str, fallback: bool, ctx: Option<&EvaluationContext>, environment_id: Option<&str>) -> bool {
        let flag = match self.get_flag_by_name(flag_name, environment_id).await {
            Some(f) => f,
            None => return fallback,
        };
        let result = self.evaluate_internal(&flag, ctx, environment_id).await;
        if flag.value_type.as_deref() != Some("boolean") {
            return fallback;
        }
        result.variant.and_then(|v| v.value).and_then(|v| v.as_bool()).unwrap_or(fallback)
    }

    /// Get JSON variation value
    pub async fn json_variation(&self, flag_name: &str, fallback: serde_json::Value, ctx: Option<&EvaluationContext>, environment_id: Option<&str>) -> serde_json::Value {
        let flag = match self.get_flag_by_name(flag_name, environment_id).await {
            Some(f) => f,
            None => return fallback,
        };
        let result = self.evaluate_internal(&flag, ctx, environment_id).await;
        if flag.value_type.as_deref() != Some("json") {
            return fallback;
        }
        result.variant.and_then(|v| v.value).unwrap_or(fallback)
    }

    /// String variation with detail
    pub async fn string_variation_detail(&self, flag_name: &str, fallback: &str, ctx: Option<&EvaluationContext>, environment_id: Option<&str>) -> EvaluationDetail<String> {
        let flag = match self.get_flag_by_name(flag_name, environment_id).await {
            Some(f) => f,
            None => {
                return EvaluationDetail {
                    value: fallback.to_string(),
                    reason: EvaluationReason::NotFound,
                    variant_name: None,
                    flag_name: flag_name.to_string(),
                };
            }
        };
        let result = self.evaluate_internal(&flag, ctx, environment_id).await;
        let value = if flag.value_type.as_deref() == Some("string") {
            result.variant.as_ref().and_then(|v| v.value.as_ref()).map(|v| match v {
                serde_json::Value::String(s) => s.clone(),
                other => other.to_string(),
            }).unwrap_or_else(|| fallback.to_string())
        } else {
            fallback.to_string()
        };
        EvaluationDetail {
            value,
            reason: result.reason,
            variant_name: result.variant.as_ref().map(|v| v.name.clone()),
            flag_name: flag_name.to_string(),
        }
    }

    /// String variation or throw
    pub async fn string_variation_or_throw(&self, flag_name: &str, ctx: Option<&EvaluationContext>, environment_id: Option<&str>) -> Result<String, FeatureFlagError> {
        let flag = match self.get_flag_by_name(flag_name, environment_id).await {
            Some(f) => f,
            None => return Err(FeatureFlagError::flag_not_found(flag_name)),
        };
        if flag.value_type.as_deref() != Some("string") {
            let actual = flag.value_type.as_deref().unwrap_or("unknown");
            return Err(FeatureFlagError::invalid_value_type(flag_name, "string", actual));
        }
        let result = self.evaluate_internal(&flag, ctx, environment_id).await;
        result.variant.and_then(|v| v.value).map(|v| match v {
            serde_json::Value::String(s) => s,
            other => other.to_string(),
        }).ok_or_else(|| FeatureFlagError::no_value(flag_name))
    }

    /// Update a segment in cache
    pub async fn update_segment_in_cache(&self, segment: FeatureSegment, project_id: &str) {
        let mut cs = self.cached_segments.write().await;
        let seg_map = cs.entry(project_id.to_string()).or_default();
        seg_map.insert(segment.name.clone(), segment);
    }

    /// Remove a segment from cache
    pub async fn remove_segment_from_cache(&self, segment_name: &str, project_id: &str) {
        let mut cs = self.cached_segments.write().await;
        if let Some(seg_map) = cs.get_mut(project_id) {
            seg_map.remove(segment_name);
        }
    }

    /// Flush metrics to backend
    pub async fn flush_metrics(&self) {
        let metrics: Vec<FlagMetric> = {
            let mut buffer = self.metrics_buffer.write().await;
            std::mem::take(&mut *buffer)
        };

        if metrics.is_empty() {
            return;
        }

        debug!("Flushing {} flag metrics", metrics.len());
        // Build metrics payload for backend
        // POST /api/v1/server/features/metrics
        // (Implementation sends batched metrics to the backend API)
        let _payload = serde_json::json!({
            "appName": "",
            "sdkVersion": crate::client::SDK_VERSION,
            "bucket": {
                "start": metrics.first().map(|m| m.timestamp.to_rfc3339()).unwrap_or_default(),
                "stop": metrics.last().map(|m| m.timestamp.to_rfc3339()).unwrap_or_default(),
            }
        });

        // Fire and forget — don't block on metrics
        if let Err(e) = self.api_client.post::<_, serde_json::Value>("/api/v1/server/features/metrics", &_payload).await {
            warn!("Failed to flush flag metrics: {}", e);
        }
    }
}

// ============================================================================
// ServiceDiscoveryService (not cached — real-time API calls)
// ============================================================================

pub struct ServiceDiscoveryService {
    api_client: Arc<ApiClient>,
    instance_id: Arc<RwLock<Option<String>>>,
}

impl ServiceDiscoveryService {
    pub fn new(api_client: Arc<ApiClient>) -> Self {
        Self {
            api_client,
            instance_id: Arc::new(RwLock::new(None)),
        }
    }

    /// Register a service instance
    pub async fn register(&self, input: RegisterServiceInput) -> Result<ServiceInstance, GatrixError> {
        let response: ApiResponse<ServiceInstance> = self.api_client.post("/api/v1/server/services/register", &input).await?;
        if let Some(instance) = response.data {
            let mut iid = self.instance_id.write().await;
            *iid = Some(instance.instance_id.clone());
            info!("Service registered: {}", instance.instance_id);
            Ok(instance)
        } else {
            Err(GatrixError::new(crate::error::ErrorCode::ApiError, "Failed to register service"))
        }
    }

    /// Update service status
    pub async fn update_status(&self, input: UpdateServiceStatusInput) -> Result<(), GatrixError> {
        let iid = self.instance_id.read().await;
        let instance_id = match iid.as_ref() {
            Some(id) => id.clone(),
            None => return Err(GatrixError::new(crate::error::ErrorCode::NotInitialized, "Service not registered")),
        };
        drop(iid);

        let endpoint = format!("/api/v1/server/services/{}/status", instance_id);
        let _: ApiResponse<serde_json::Value> = self.api_client.put(&endpoint, &input).await?;
        Ok(())
    }

    /// Unregister the service instance
    pub async fn unregister(&self) -> Result<(), GatrixError> {
        let iid = self.instance_id.read().await;
        let instance_id = match iid.as_ref() {
            Some(id) => id.clone(),
            None => return Ok(()),
        };
        drop(iid);

        let endpoint = format!("/api/v1/server/services/{}", instance_id);
        let _: ApiResponse<serde_json::Value> = self.api_client.delete(&endpoint).await?;
        let mut iid = self.instance_id.write().await;
        *iid = None;
        info!("Service unregistered");
        Ok(())
    }

    /// Fetch registered services
    pub async fn fetch_services(&self, params: Option<&GetServicesParams>) -> Result<Vec<ServiceInstance>, GatrixError> {
        let mut endpoint = "/api/v1/server/services".to_string();
        if let Some(p) = params {
            let mut query_parts = vec![];
            if let Some(s) = &p.service { query_parts.push(format!("service={}", s)); }
            if let Some(g) = &p.group { query_parts.push(format!("group={}", g)); }
            if let Some(s) = &p.status { query_parts.push(format!("status={:?}", s)); }
            if !query_parts.is_empty() {
                endpoint.push('?');
                endpoint.push_str(&query_parts.join("&"));
            }
        }
        let response: ApiResponse<Vec<ServiceInstance>> = self.api_client.get(&endpoint).await?;
        Ok(response.data.unwrap_or_default())
    }

    /// Get current instance ID
    pub async fn get_instance_id(&self) -> Option<String> {
        self.instance_id.read().await.clone()
    }
}

// ============================================================================
// CouponService (not cached — real-time API calls)
// ============================================================================

pub struct CouponService {
    api_client: Arc<ApiClient>,
}

impl CouponService {
    pub fn new(api_client: Arc<ApiClient>) -> Self {
        Self { api_client }
    }

    /// Redeem a coupon code
    pub async fn redeem(&self, request: &RedeemCouponRequest, _environment_id: Option<&str>) -> Result<RedeemCouponResponse, GatrixError> {
        let response: ApiResponse<RedeemCouponResponse> = self.api_client.post("/api/v1/server/coupons/redeem", request).await?;
        if let Some(data) = response.data {
            Ok(data)
        } else {
            let msg = response.error.map(|e| e.message).unwrap_or_else(|| "Failed to redeem coupon".to_string());
            Err(GatrixError::new(crate::error::ErrorCode::ApiError, msg))
        }
    }
}

// ============================================================================
// BannerService
// ============================================================================

pub struct BannerService {
    api_client: Arc<ApiClient>,
    cache: EnvironmentCache<Banner>,
    feature_enabled: bool,
}

impl BannerService {
    pub fn new(api_client: Arc<ApiClient>, default_env: String) -> Self {
        Self {
            api_client,
            cache: EnvironmentCache::new(default_env),
            feature_enabled: true,
        }
    }

    pub fn set_feature_enabled(&mut self, enabled: bool) {
        self.feature_enabled = enabled;
    }

    pub async fn fetch_by_environment(&self, environment_id: Option<&str>) -> Result<Vec<Banner>, GatrixError> {
        let response: ApiResponse<BannerListResponse> = self.api_client.get("/api/v1/server/banners").await?;
        if let Some(data) = response.data {
            self.cache.update_cache(data.banners.clone(), environment_id).await;
            Ok(data.banners)
        } else {
            Err(GatrixError::new(crate::error::ErrorCode::ApiError, "Failed to fetch banners"))
        }
    }

    pub async fn get_cached(&self, environment_id: Option<&str>) -> Vec<Banner> {
        self.cache.get_cached(environment_id).await
    }
}

// ============================================================================
// ClientVersionService
// ============================================================================

pub struct ClientVersionService {
    api_client: Arc<ApiClient>,
    cache: EnvironmentCache<ClientVersion>,
    feature_enabled: bool,
}

impl ClientVersionService {
    pub fn new(api_client: Arc<ApiClient>, default_env: String) -> Self {
        Self {
            api_client,
            cache: EnvironmentCache::new(default_env),
            feature_enabled: true,
        }
    }

    pub fn set_feature_enabled(&mut self, enabled: bool) {
        self.feature_enabled = enabled;
    }

    pub async fn fetch_by_environment(&self, environment_id: Option<&str>) -> Result<Vec<ClientVersion>, GatrixError> {
        let response: ApiResponse<ClientVersionListResponse> = self.api_client.get("/api/v1/server/client-versions").await?;
        if let Some(data) = response.data {
            self.cache.update_cache(data.client_versions.clone(), environment_id).await;
            Ok(data.client_versions)
        } else {
            Err(GatrixError::new(crate::error::ErrorCode::ApiError, "Failed to fetch client versions"))
        }
    }

    pub async fn get_cached(&self, environment_id: Option<&str>) -> Vec<ClientVersion> {
        self.cache.get_cached(environment_id).await
    }
}

// ============================================================================
// ServiceNoticeService
// ============================================================================

pub struct ServiceNoticeService {
    api_client: Arc<ApiClient>,
    cache: EnvironmentCache<ServiceNotice>,
    feature_enabled: bool,
}

impl ServiceNoticeService {
    pub fn new(api_client: Arc<ApiClient>, default_env: String) -> Self {
        Self {
            api_client,
            cache: EnvironmentCache::new(default_env),
            feature_enabled: true,
        }
    }

    pub fn set_feature_enabled(&mut self, enabled: bool) {
        self.feature_enabled = enabled;
    }

    pub async fn fetch_by_environment(&self, environment_id: Option<&str>) -> Result<Vec<ServiceNotice>, GatrixError> {
        let response: ApiResponse<ServiceNoticeListResponse> = self.api_client.get("/api/v1/server/service-notices").await?;
        if let Some(data) = response.data {
            self.cache.update_cache(data.notices.clone(), environment_id).await;
            Ok(data.notices)
        } else {
            Err(GatrixError::new(crate::error::ErrorCode::ApiError, "Failed to fetch service notices"))
        }
    }

    pub async fn get_cached(&self, environment_id: Option<&str>) -> Vec<ServiceNotice> {
        self.cache.get_cached(environment_id).await
    }
}

// ============================================================================
// VarsService
// ============================================================================

pub struct VarsService {
    api_client: Arc<ApiClient>,
    cache: EnvironmentCache<VarItem>,
    feature_enabled: bool,
}

impl VarsService {
    pub fn new(api_client: Arc<ApiClient>, default_env: String) -> Self {
        Self {
            api_client,
            cache: EnvironmentCache::new(default_env),
            feature_enabled: true,
        }
    }

    pub fn set_feature_enabled(&mut self, enabled: bool) {
        self.feature_enabled = enabled;
    }

    pub async fn fetch_by_environment(&self, environment_id: Option<&str>) -> Result<Vec<VarItem>, GatrixError> {
        let response: ApiResponse<Vec<VarItem>> = self.api_client.get("/api/v1/server/vars").await?;
        if let Some(vars) = response.data {
            self.cache.update_cache(vars.clone(), environment_id).await;
            info!("Vars fetched: {} items", vars.len());
            Ok(vars)
        } else {
            Err(GatrixError::new(crate::error::ErrorCode::ApiError, "Failed to fetch vars"))
        }
    }

    pub async fn get_cached(&self, environment_id: Option<&str>) -> Vec<VarItem> {
        self.cache.get_cached(environment_id).await
    }

    /// Get a single var by key
    pub async fn get_by_key(&self, key: &str, environment_id: Option<&str>) -> Option<VarItem> {
        let vars = self.cache.get_cached(environment_id).await;
        vars.into_iter().find(|v| v.var_key == key)
    }

    /// Get var value by key
    pub async fn get_value(&self, key: &str, environment_id: Option<&str>) -> Option<String> {
        self.get_by_key(key, environment_id).await.map(|v| v.var_value)
    }

    /// Get parsed JSON value
    pub async fn get_parsed_value<T: serde::de::DeserializeOwned>(&self, key: &str, environment_id: Option<&str>) -> Option<T> {
        let value = self.get_value(key, environment_id).await?;
        serde_json::from_str(&value).ok()
    }
}

// ============================================================================
// ImpactMetricsService
// ============================================================================

pub struct ImpactMetricsService {
    api_client: Arc<ApiClient>,
    counters: Arc<RwLock<HashMap<String, CounterMetric>>>,
    histograms: Arc<RwLock<HashMap<String, HistogramMetric>>>,
    app_name: String,
    service_name: String,
}

#[derive(Debug, Clone)]
struct CounterMetric {
    description: String,
    value: f64,
}

#[derive(Debug, Clone)]
struct HistogramMetric {
    description: String,
    buckets: Vec<f64>,
    observations: Vec<f64>,
}

impl ImpactMetricsService {
    pub fn new(api_client: Arc<ApiClient>, app_name: String, service_name: String) -> Self {
        Self {
            api_client,
            counters: Arc::new(RwLock::new(HashMap::new())),
            histograms: Arc::new(RwLock::new(HashMap::new())),
            app_name,
            service_name,
        }
    }

    /// Define a counter metric
    pub async fn define_counter(&self, name: &str, description: &str) {
        let mut counters = self.counters.write().await;
        counters.insert(name.to_string(), CounterMetric {
            description: description.to_string(),
            value: 0.0,
        });
    }

    /// Increment a counter
    pub async fn increment_counter(&self, name: &str) {
        let mut counters = self.counters.write().await;
        if let Some(counter) = counters.get_mut(name) {
            counter.value += 1.0;
        }
    }

    /// Define a histogram metric
    pub async fn define_histogram(&self, name: &str, description: &str, buckets: Option<Vec<f64>>) {
        let mut histograms = self.histograms.write().await;
        histograms.insert(name.to_string(), HistogramMetric {
            description: description.to_string(),
            buckets: buckets.unwrap_or_else(|| vec![10.0, 50.0, 100.0, 500.0, 1000.0]),
            observations: Vec::new(),
        });
    }

    /// Observe a value on a histogram
    pub async fn observe_histogram(&self, name: &str, value: f64) {
        let mut histograms = self.histograms.write().await;
        if let Some(histogram) = histograms.get_mut(name) {
            histogram.observations.push(value);
        }
    }

    /// Flush metrics to backend
    pub async fn flush(&self) {
        // Collect and send impact metrics to the backend
        let counters = self.counters.read().await;
        let histograms = self.histograms.read().await;

        if counters.is_empty() && histograms.is_empty() {
            return;
        }

        debug!("Flushing impact metrics: {} counters, {} histograms", counters.len(), histograms.len());

        let payload = serde_json::json!({
            "appName": self.app_name,
            "service": self.service_name,
            "timestamp": chrono::Utc::now().to_rfc3339(),
        });

        if let Err(e) = self.api_client.post::<_, serde_json::Value>("/api/v1/server/impact-metrics", &payload).await {
            warn!("Failed to flush impact metrics: {}", e);
        }
    }
}
