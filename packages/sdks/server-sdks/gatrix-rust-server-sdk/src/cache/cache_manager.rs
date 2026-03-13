// Gatrix Rust Server SDK
// Cache manager — polling/event/manual

use std::sync::Arc;
use log::{debug, info, warn};
use tokio::sync::RwLock;

use crate::types::events::SdkEvent;

#[cfg(feature = "redis-pubsub")]
use crate::types::events::SDK_EVENTS_CHANNEL;

/// Type alias for a cache refresher function
pub type RefresherFn = Arc<dyn Fn() -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send>> + Send + Sync>;

/// Cache manager that handles periodic or event-driven cache refresh
pub struct CacheManager {
    refreshers: Arc<RwLock<Vec<(String, RefresherFn)>>>,
    polling_handle: Arc<RwLock<Option<tokio::task::JoinHandle<()>>>>,
    running: Arc<std::sync::atomic::AtomicBool>,
}

impl CacheManager {
    pub fn new() -> Self {
        Self {
            refreshers: Arc::new(RwLock::new(Vec::new())),
            polling_handle: Arc::new(RwLock::new(None)),
            running: Arc::new(std::sync::atomic::AtomicBool::new(false)),
        }
    }

    /// Add a cache refresher function
    pub async fn add_refresher(&self, name: &str, refresher: RefresherFn) {
        let mut refreshers = self.refreshers.write().await;
        refreshers.push((name.to_string(), refresher));
    }

    /// refresh all cached services
    pub async fn refresh_all(&self) {
        let refreshers = self.refreshers.read().await;
        for (name, refresher) in refreshers.iter() {
            debug!("Refreshing cache: {}", name);
            refresher().await;
        }
    }

    /// Start polling with given interval (seconds)
    pub async fn start_polling(&self, interval_secs: u64) {
        self.running.store(true, std::sync::atomic::Ordering::SeqCst);
        let refreshers = Arc::clone(&self.refreshers);
        let running = Arc::clone(&self.running);

        let handle = tokio::spawn(async move {
            let interval = tokio::time::Duration::from_secs(interval_secs);
            loop {
                tokio::time::sleep(interval).await;
                if !running.load(std::sync::atomic::Ordering::SeqCst) {
                    break;
                }
                let refreshers = refreshers.read().await;
                for (name, refresher) in refreshers.iter() {
                    debug!("Polling refresh: {}", name);
                    refresher().await;
                }
            }
        });

        let mut polling_handle = self.polling_handle.write().await;
        *polling_handle = Some(handle);
        info!("Cache polling started (interval: {}s)", interval_secs);
    }

    /// Stop the cache manager
    pub async fn stop(&self) {
        self.running.store(false, std::sync::atomic::Ordering::SeqCst);
        let mut handle = self.polling_handle.write().await;
        if let Some(h) = handle.take() {
            h.abort();
        }
        info!("Cache manager stopped");
    }
}

impl Default for CacheManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Redis PubSub event listener for real-time cache invalidation
#[cfg(feature = "redis-pubsub")]
pub struct EventListener {
    config: RedisListenerConfig,
    running: Arc<std::sync::atomic::AtomicBool>,
    handle: Arc<RwLock<Option<tokio::task::JoinHandle<()>>>>,
}

#[derive(Debug, Clone)]
pub struct RedisListenerConfig {
    pub host: String,
    pub port: u16,
    pub password: Option<String>,
    pub db: Option<i64>,
}

#[cfg(feature = "redis-pubsub")]
impl EventListener {
    pub fn new(config: RedisListenerConfig) -> Self {
        Self {
            config,
            running: Arc::new(std::sync::atomic::AtomicBool::new(false)),
            handle: Arc::new(RwLock::new(None)),
        }
    }

    /// Start listening for Redis PubSub events
    pub async fn start(
        &self,
        event_handler: Arc<dyn Fn(SdkEvent) + Send + Sync>,
    ) -> Result<(), crate::error::GatrixError> {
        let redis_url = if let Some(pw) = &self.config.password {
            format!(
                "redis://:{}@{}:{}/{}",
                pw,
                self.config.host,
                self.config.port,
                self.config.db.unwrap_or(0)
            )
        } else {
            format!(
                "redis://{}:{}/{}",
                self.config.host,
                self.config.port,
                self.config.db.unwrap_or(0)
            )
        };

        let client = redis::Client::open(redis_url).map_err(|e| {
            crate::error::GatrixError::new(
                crate::error::ErrorCode::CacheError,
                format!("Failed to connect to Redis: {}", e),
            )
        })?;

        self.running.store(true, std::sync::atomic::Ordering::SeqCst);
        let running = Arc::clone(&self.running);

        let handle = tokio::spawn(async move {
            let conn = match client.get_async_pubsub().await {
                Ok(c) => c,
                Err(e) => {
                    warn!("Failed to create Redis PubSub connection: {}", e);
                    return;
                }
            };

            let mut pubsub = conn;
            if let Err(e) = pubsub.subscribe(SDK_EVENTS_CHANNEL).await {
                warn!("Failed to subscribe to {}: {}", SDK_EVENTS_CHANNEL, e);
                return;
            }

            info!("Subscribed to Redis channel: {}", SDK_EVENTS_CHANNEL);

            let mut msg_stream = pubsub.on_message();
            use futures_util::StreamExt;
            while let Some(msg) = msg_stream.next().await {
                if !running.load(std::sync::atomic::Ordering::SeqCst) {
                    break;
                }
                let payload: String = match redis::FromRedisValue::from_redis_value(&msg.get_payload::<redis::Value>().unwrap_or(redis::Value::Nil)) {
                    Ok(s) => s,
                    Err(_) => continue,
                };
                if let Ok(event) = serde_json::from_str::<SdkEvent>(&payload) {
                    event_handler(event);
                }
            }
        });

        let mut h = self.handle.write().await;
        *h = Some(handle);
        Ok(())
    }

    /// Stop listening
    pub async fn stop(&self) {
        self.running.store(false, std::sync::atomic::Ordering::SeqCst);
        let mut handle = self.handle.write().await;
        if let Some(h) = handle.take() {
            h.abort();
        }
        info!("Event listener stopped");
    }
}
