// Gatrix Rust Server SDK
// Main SDK entry point

//! # Gatrix Rust Server SDK
//!
//! Official Rust server SDK for [Gatrix](https://github.com/gatrix) feature management platform.
//!
//! ## Quick Start
//!
//! ```rust,no_run
//! use gatrix_rust_server_sdk::{GatrixServerSDK, GatrixSDKConfig, EvaluationContext};
//!
//! #[tokio::main]
//! async fn main() {
//!     let config = GatrixSDKConfig::new(
//!         "http://localhost:45000",
//!         "unsecured-server-api-token",
//!         "my-game-server",
//!     );
//!     let mut sdk = GatrixServerSDK::new(config).expect("Failed to create SDK");
//!     sdk.initialize().await.expect("Failed to initialize");
//!
//!     // Evaluate a feature flag
//!     let ctx = EvaluationContext {
//!         user_id: Some("user-123".to_string()),
//!         ..Default::default()
//!     };
//!     let enabled = sdk.feature_flag.is_enabled("my-feature", false, Some(&ctx), None).await;
//!     println!("Feature enabled: {}", enabled);
//!
//!     sdk.shutdown().await;
//! }
//! ```

pub mod cache;
pub mod client;
pub mod config;
pub mod error;
pub mod evaluator;
pub mod events;
pub mod services;
pub mod types;

use std::sync::Arc;

use log::{info, warn};

use cache::CacheManager;
pub use config::*;
pub use error::*;
use events::EventEmitter;
pub use types::feature_flags::EvaluationContext;

use services::*;

/// SDK version
pub const SDK_VERSION: &str = "0.1.0";

/// Main Gatrix Server SDK
///
/// Access services through the public service fields:
/// ```rust,ignore
/// sdk.feature_flag.is_enabled("flag-name", false, Some(&ctx), None).await;
/// sdk.game_world.get_cached(None).await;
/// ```
pub struct GatrixServerSDK {
    config: GatrixSDKConfig,
    api_client: Arc<client::ApiClient>,
    cache_manager: Option<CacheManager>,
    event_emitter: EventEmitter,
    initialized: bool,

    // Public service fields (service-namespaced access pattern)
    pub feature_flag: FeatureFlagService,
    pub game_world: GameWorldService,
    pub popup_notice: PopupNoticeService,
    pub survey: SurveyService,
    pub whitelist: WhitelistService,
    pub service_maintenance: ServiceMaintenanceService,
    pub store_product: StoreProductService,
    pub service_discovery: ServiceDiscoveryService,
    pub coupon: CouponService,
    pub impact_metrics: ImpactMetricsService,
    pub banner: BannerService,
    pub client_version: ClientVersionService,
    pub service_notice: ServiceNoticeService,
    pub vars: VarsService,
}

impl GatrixServerSDK {
    /// Create a new SDK instance with the given configuration
    pub fn new(config: GatrixSDKConfig) -> GatrixResult<Self> {
        config.validate()?;

        let api_url = config.api_url.trim_end_matches('/').to_string();
        let api_client = Arc::new(client::ApiClient::new(client::ApiClientConfig {
            base_url: api_url,
            api_token: config.api_token.clone(),
            app_name: config.app_name.clone(),
            retry: config.retry.clone(),
        }));

        let default_env = String::new();

        let mut feature_flag = FeatureFlagService::new(Arc::clone(&api_client), default_env.clone());
        let mut game_world = GameWorldService::new(Arc::clone(&api_client), default_env.clone());
        let mut popup_notice = PopupNoticeService::new(Arc::clone(&api_client), default_env.clone());
        let mut survey = SurveyService::new(Arc::clone(&api_client), default_env.clone());
        let mut whitelist = WhitelistService::new(Arc::clone(&api_client), default_env.clone());
        let mut service_maintenance = ServiceMaintenanceService::new(Arc::clone(&api_client), default_env.clone());
        let mut store_product = StoreProductService::new(Arc::clone(&api_client), default_env.clone());
        let service_discovery = ServiceDiscoveryService::new(Arc::clone(&api_client));
        let coupon = CouponService::new(Arc::clone(&api_client));
        let impact_metrics = ImpactMetricsService::new(
            Arc::clone(&api_client),
            config.app_name.clone(),
            config.meta.as_ref().and_then(|m| m.service.clone()).unwrap_or_default(),
        );
        let mut banner = BannerService::new(Arc::clone(&api_client), default_env.clone());
        let mut client_version = ClientVersionService::new(Arc::clone(&api_client), default_env.clone());
        let mut service_notice = ServiceNoticeService::new(Arc::clone(&api_client), default_env.clone());
        let mut vars = VarsService::new(Arc::clone(&api_client), default_env);

        // Apply 'uses' configuration
        feature_flag.set_feature_enabled(config.uses.feature_flag);
        feature_flag.set_compact_flags(config.feature_flags.compact);
        game_world.set_feature_enabled(config.uses.game_world);
        popup_notice.set_feature_enabled(config.uses.popup_notice);
        survey.set_feature_enabled(config.uses.survey);
        whitelist.set_feature_enabled(config.uses.whitelist);
        service_maintenance.set_feature_enabled(config.uses.service_maintenance);
        store_product.set_feature_enabled(config.uses.store_product);
        banner.set_feature_enabled(config.uses.banner);
        client_version.set_feature_enabled(config.uses.client_version);
        service_notice.set_feature_enabled(config.uses.service_notice);
        vars.set_feature_enabled(config.uses.vars);

        Ok(Self {
            config,
            api_client,
            cache_manager: None,
            event_emitter: EventEmitter::new(),
            initialized: false,
            feature_flag,
            game_world,
            popup_notice,
            survey,
            whitelist,
            service_maintenance,
            store_product,
            service_discovery,
            coupon,
            impact_metrics,
            banner,
            client_version,
            service_notice,
            vars,
        })
    }

    /// Initialize the SDK — fetches initial data and starts cache refresh
    pub async fn initialize(&mut self) -> GatrixResult<()> {
        if self.initialized {
            return Ok(());
        }

        info!(
            "Initializing Gatrix Rust Server SDK v{} (app: {})",
            SDK_VERSION, self.config.app_name
        );

        // Fetch initial data for enabled services
        self.fetch_initial_data().await;

        // Set up cache refresh strategy
        match self.config.cache.refresh_method {
            RefreshMethod::Polling => {
                self.start_polling().await;
            }
            RefreshMethod::Event => {
                if let Err(e) = self.start_event_listener().await {
                    warn!(
                        "Failed to start event listener, falling back to polling: {}",
                        e
                    );
                    self.start_polling().await;
                }
            }
            RefreshMethod::Manual => {
                info!("Manual refresh mode enabled");
            }
        }

        self.initialized = true;
        info!("Gatrix Rust Server SDK initialized successfully");
        Ok(())
    }

    /// Fetch initial data for all enabled services
    async fn fetch_initial_data(&self) {
        if self.config.uses.feature_flag {
            if let Err(e) = self.feature_flag.fetch_by_environment(None).await {
                warn!("Failed to fetch feature flags: {}", e);
            }
        }
        if self.config.uses.game_world {
            if let Err(e) = self.game_world.fetch_by_environment(None).await {
                warn!("Failed to fetch game worlds: {}", e);
            }
        }
        if self.config.uses.popup_notice {
            if let Err(e) = self.popup_notice.fetch_by_environment(None).await {
                warn!("Failed to fetch popup notices: {}", e);
            }
        }
        if self.config.uses.survey {
            if let Err(e) = self.survey.fetch_by_environment(None).await {
                warn!("Failed to fetch surveys: {}", e);
            }
        }
        if self.config.uses.whitelist {
            if let Err(e) = self.whitelist.fetch_by_environment(None).await {
                warn!("Failed to fetch whitelist: {}", e);
            }
        }
        if self.config.uses.service_maintenance {
            if let Err(e) = self.service_maintenance.fetch_by_environment(None).await {
                warn!("Failed to fetch maintenance: {}", e);
            }
        }
        if self.config.uses.store_product {
            if let Err(e) = self.store_product.fetch_by_environment(None).await {
                warn!("Failed to fetch store products: {}", e);
            }
        }
        if self.config.uses.banner {
            if let Err(e) = self.banner.fetch_by_environment(None).await {
                warn!("Failed to fetch banners: {}", e);
            }
        }
        if self.config.uses.client_version {
            if let Err(e) = self.client_version.fetch_by_environment(None).await {
                warn!("Failed to fetch client versions: {}", e);
            }
        }
        if self.config.uses.service_notice {
            if let Err(e) = self.service_notice.fetch_by_environment(None).await {
                warn!("Failed to fetch service notices: {}", e);
            }
        }
        if self.config.uses.vars {
            if let Err(e) = self.vars.fetch_by_environment(None).await {
                warn!("Failed to fetch vars: {}", e);
            }
        }
    }

    /// Start polling cache refresh
    async fn start_polling(&mut self) {
        let cache_manager = CacheManager::new();
        cache_manager.start_polling(self.config.cache.ttl).await;
        self.cache_manager = Some(cache_manager);
    }

    /// Start Redis event listener for cache invalidation
    async fn start_event_listener(&mut self) -> GatrixResult<()> {
        let redis_config = self.config.redis.as_ref().ok_or_else(|| {
            GatrixError::invalid_config("Redis config is required for event refresh mode")
        })?;

        #[cfg(feature = "redis-pubsub")]
        {
            let listener = cache::EventListener::new(cache::RedisListenerConfig {
                host: redis_config.host.clone(),
                port: redis_config.port,
                password: redis_config.password.clone(),
                db: redis_config.db,
            });

            let event_emitter_callback = {
                // We can't easily reference self here, so we just log events for now
                Arc::new(move |event: crate::types::events::SdkEvent| {
                    log::debug!("Received event: {}", event.event_type);
                })
            };

            listener.start(event_emitter_callback).await?;
        }

        #[cfg(not(feature = "redis-pubsub"))]
        {
            let _ = redis_config;
            return Err(GatrixError::invalid_config(
                "Redis PubSub feature is not enabled. Enable the 'redis-pubsub' feature in Cargo.toml",
            ));
        }

        Ok(())
    }

    /// Manually refresh all caches
    pub async fn refresh_cache(&self) {
        if let Some(cm) = &self.cache_manager {
            cm.refresh_all().await;
        } else {
            self.fetch_initial_data().await;
        }
    }

    /// Register an event listener
    pub async fn on(&self, event_type: &str, callback: events::EventCallback) {
        self.event_emitter.on(event_type, callback).await;
    }

    /// Remove event listeners for a type
    pub async fn off(&self, event_type: &str) {
        self.event_emitter.off(event_type).await;
    }

    /// Check if the SDK has been initialized
    pub fn is_initialized(&self) -> bool {
        self.initialized
    }

    /// Shutdown the SDK gracefully
    pub async fn shutdown(&mut self) {
        info!("Shutting down Gatrix Rust Server SDK...");

        // Flush remaining metrics
        self.feature_flag.flush_metrics().await;
        self.impact_metrics.flush().await;

        // Stop cache manager
        if let Some(cm) = &self.cache_manager {
            cm.stop().await;
        }

        // Unregister service discovery
        if let Err(e) = self.service_discovery.unregister().await {
            warn!("Failed to unregister service: {}", e);
        }

        self.initialized = false;
        info!("Gatrix Rust Server SDK shutdown complete");
    }
}
