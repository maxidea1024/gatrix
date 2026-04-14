// Gatrix Rust Server SDK
// Event types

use serde::{Deserialize, Serialize};

/// SDK event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SdkEvent {
    #[serde(rename = "type")]
    pub event_type: String,
    pub data: serde_json::Value,
    pub timestamp: Option<String>,
}

/// Standard event types
pub mod event_types {
    // Game World events
    pub const GAMEWORLD_CREATED: &str = "game_world.created";
    pub const GAMEWORLD_UPDATED: &str = "game_world.updated";
    pub const GAMEWORLD_DELETED: &str = "game_world.deleted";
    pub const GAMEWORLD_ORDER_CHANGED: &str = "game_world.order_changed";

    // Popup events
    pub const POPUP_CREATED: &str = "popup.created";
    pub const POPUP_UPDATED: &str = "popup.updated";
    pub const POPUP_DELETED: &str = "popup.deleted";

    // Survey events
    pub const SURVEY_CREATED: &str = "survey.created";
    pub const SURVEY_UPDATED: &str = "survey.updated";
    pub const SURVEY_DELETED: &str = "survey.deleted";
    pub const SURVEY_SETTINGS_UPDATED: &str = "survey.settings.updated";

    // Whitelist events
    pub const WHITELIST_UPDATED: &str = "whitelist.updated";

    // Maintenance events
    pub const MAINTENANCE_SETTINGS_UPDATED: &str = "maintenance.settings.updated";

    // Store Product events
    pub const STORE_PRODUCT_CREATED: &str = "store_product.created";
    pub const STORE_PRODUCT_UPDATED: &str = "store_product.updated";
    pub const STORE_PRODUCT_DELETED: &str = "store_product.deleted";
    pub const STORE_PRODUCT_BULK_UPDATED: &str = "store_product.bulk_updated";

    // Feature Flag events
    pub const FEATURE_FLAG_CHANGED: &str = "feature_flag.changed";
    pub const FEATURE_FLAG_CREATED: &str = "feature_flag.created";
    pub const FEATURE_FLAG_UPDATED: &str = "feature_flag.updated";
    pub const FEATURE_FLAG_DELETED: &str = "feature_flag.deleted";

    // Segment events
    pub const SEGMENT_CREATED: &str = "segment.created";
    pub const SEGMENT_UPDATED: &str = "segment.updated";
    pub const SEGMENT_DELETED: &str = "segment.deleted";

    // Client Version events
    pub const CLIENT_VERSION_CREATED: &str = "client_version.created";
    pub const CLIENT_VERSION_UPDATED: &str = "client_version.updated";
    pub const CLIENT_VERSION_DELETED: &str = "client_version.deleted";

    // Banner events
    pub const BANNER_CREATED: &str = "banner.created";
    pub const BANNER_UPDATED: &str = "banner.updated";
    pub const BANNER_DELETED: &str = "banner.deleted";

    // Service Notice events
    pub const SERVICE_NOTICE_CREATED: &str = "service_notice.created";
    pub const SERVICE_NOTICE_UPDATED: &str = "service_notice.updated";
    pub const SERVICE_NOTICE_DELETED: &str = "service_notice.deleted";

    // Wildcard
    pub const WILDCARD: &str = "*";
}

/// Redis PubSub channel name
pub const SDK_EVENTS_CHANNEL: &str = "gatrix-sdk-events";
