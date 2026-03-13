// Gatrix Rust Server SDK
// Event emitter — supports wildcards

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::types::events::*;

/// Callback type for event listeners
pub type EventCallback = Arc<dyn Fn(SdkEvent) + Send + Sync>;

/// Simple event emitter with wildcard support
pub struct EventEmitter {
    listeners: Arc<RwLock<HashMap<String, Vec<EventCallback>>>>,
}

impl EventEmitter {
    pub fn new() -> Self {
        Self {
            listeners: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Register a callback for an event type (supports "*" wildcard)
    pub async fn on(&self, event_type: &str, callback: EventCallback) {
        let mut listeners = self.listeners.write().await;
        listeners
            .entry(event_type.to_string())
            .or_default()
            .push(callback);
    }

    /// Remove all listeners for an event type
    pub async fn off(&self, event_type: &str) {
        let mut listeners = self.listeners.write().await;
        listeners.remove(event_type);
    }

    /// Emit an event to all matching listeners
    pub async fn emit(&self, event: SdkEvent) {
        let listeners = self.listeners.read().await;

        // Exact match
        if let Some(cbs) = listeners.get(&event.event_type) {
            for cb in cbs {
                cb(event.clone());
            }
        }

        // Wildcard listeners
        if event.event_type != event_types::WILDCARD {
            if let Some(cbs) = listeners.get(event_types::WILDCARD) {
                for cb in cbs {
                    cb(event.clone());
                }
            }
        }
    }
}

impl Default for EventEmitter {
    fn default() -> Self {
        Self::new()
    }
}
