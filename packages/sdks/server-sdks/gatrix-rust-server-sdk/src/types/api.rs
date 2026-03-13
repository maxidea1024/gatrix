// Gatrix Rust Server SDK
// API response types

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Generic API response wrapper
#[derive(Debug, Clone, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<ApiError>,
}

/// API error detail
#[derive(Debug, Clone, Deserialize)]
pub struct ApiError {
    pub code: String,
    pub message: String,
    pub details: Option<serde_json::Value>,
}

// ============================================================================
// Game World Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameWorld {
    pub id: String,
    pub world_id: String,
    pub name: String,
    pub is_maintenance: bool,
    pub maintenance_message: Option<String>,
    pub maintenance_start_date: Option<String>,
    pub maintenance_end_date: Option<String>,
    pub supports_multi_language: Option<bool>,
    pub maintenance_locales: Option<Vec<LocaleMessage>>,
    pub force_disconnect: Option<bool>,
    pub grace_period_minutes: Option<i32>,
    pub display_order: i32,
    pub custom_payload: Option<serde_json::Value>,
    pub infra_settings: Option<serde_json::Value>,
    pub world_server_address: String,
    pub tags: Option<Vec<String>>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocaleMessage {
    pub lang: String,
    pub message: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct GameWorldListResponse {
    pub worlds: Vec<GameWorld>,
}

// ============================================================================
// Popup Notice Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PopupNotice {
    pub id: String,
    pub content: String,
    pub target_worlds: Option<Vec<String>>,
    pub target_worlds_inverted: Option<bool>,
    pub target_platforms: Option<Vec<String>>,
    pub target_platforms_inverted: Option<bool>,
    pub target_channels: Option<Vec<String>>,
    pub target_channels_inverted: Option<bool>,
    pub target_subchannels: Option<Vec<String>>,
    pub target_subchannels_inverted: Option<bool>,
    pub target_user_ids: Option<Vec<String>>,
    pub target_user_ids_inverted: Option<bool>,
    pub display_priority: i32,
    pub show_once: bool,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
}

// ============================================================================
// Survey Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TriggerCondition {
    #[serde(rename = "type")]
    pub condition_type: String,
    pub value: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Survey {
    pub id: String,
    pub platform_survey_id: String,
    pub survey_title: String,
    pub survey_content: Option<String>,
    pub trigger_conditions: Vec<TriggerCondition>,
    pub participation_rewards: Option<Vec<Reward>>,
    pub reward_mail_title: Option<String>,
    pub reward_mail_content: Option<String>,
    pub target_platforms: Option<Vec<String>>,
    pub target_platforms_inverted: Option<bool>,
    pub target_channels: Option<Vec<String>>,
    pub target_channels_inverted: Option<bool>,
    pub target_subchannels: Option<Vec<String>>,
    pub target_subchannels_inverted: Option<bool>,
    pub target_worlds: Option<Vec<String>>,
    pub target_worlds_inverted: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SurveySettings {
    pub default_survey_url: String,
    pub completion_url: String,
    pub link_caption: String,
    pub verification_key: String,
}

// ============================================================================
// Reward
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Reward {
    #[serde(rename = "type")]
    pub reward_type: i32,
    pub id: String,
    pub quantity: i32,
}

// ============================================================================
// Whitelist Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WhitelistData {
    pub ip_whitelist: IpWhitelist,
    pub account_whitelist: AccountWhitelist,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpWhitelist {
    pub enabled: bool,
    pub ips: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountWhitelist {
    pub enabled: bool,
    pub account_ids: Vec<String>,
}

// ============================================================================
// Maintenance Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MaintenanceDetail {
    #[serde(rename = "type")]
    pub maintenance_type: String,
    pub starts_at: Option<String>,
    pub ends_at: Option<String>,
    pub message: String,
    pub locale_messages: Option<HashMap<String, String>>,
    pub kick_existing_players: Option<bool>,
    pub kick_delay_minutes: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MaintenanceStatus {
    pub has_maintenance_scheduled: bool,
    pub is_maintenance_active: bool,
    pub is_under_maintenance: bool,
    pub detail: Option<MaintenanceDetail>,
}

// ============================================================================
// Store Product Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoreProduct {
    pub id: String,
    pub cms_product_id: i64,
    pub is_active: Option<bool>,
    pub product_id: String,
    pub product_name: String,
    pub store: String,
    pub price: f64,
    pub currency: String,
    pub sale_start_at: Option<String>,
    pub sale_end_at: Option<String>,
    pub description: Option<String>,
    pub metadata: Option<serde_json::Value>,
    pub tags: Option<Vec<String>>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct StoreProductListResponse {
    pub products: Vec<StoreProduct>,
    pub total: i64,
}

// ============================================================================
// Coupon Types
// ============================================================================

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RedeemCouponRequest {
    pub code: String,
    pub user_id: String,
    pub user_name: String,
    pub character_id: String,
    pub world_id: String,
    pub platform: String,
    pub channel: String,
    pub sub_channel: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RedeemCouponResponse {
    pub reward: Vec<Reward>,
    pub user_used_count: i64,
    pub global_used: i64,
    pub sequence: i64,
    pub used_at: String,
    pub reward_mail_title: String,
    pub reward_mail_content: String,
}

// ============================================================================
// Service Discovery Types
// ============================================================================

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ServiceStatus {
    Initializing,
    Ready,
    ShuttingDown,
    Error,
    Terminated,
    #[serde(rename = "no-response")]
    NoResponse,
    Heartbeat,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceLabels {
    pub service: String,
    pub group: Option<String>,
    pub environment: Option<String>,
    pub region: Option<String>,
    #[serde(flatten)]
    pub extra: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServicePorts(pub HashMap<String, u16>);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceInstance {
    pub instance_id: String,
    pub labels: ServiceLabels,
    pub hostname: String,
    pub external_address: String,
    pub internal_address: String,
    pub ports: ServicePorts,
    pub status: ServiceStatus,
    pub stats: Option<serde_json::Value>,
    pub meta: Option<serde_json::Value>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisterServiceInput {
    pub instance_id: Option<String>,
    pub labels: ServiceLabels,
    pub hostname: Option<String>,
    pub internal_address: Option<String>,
    pub ports: ServicePorts,
    pub status: Option<ServiceStatus>,
    pub stats: Option<serde_json::Value>,
    pub meta: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateServiceStatusInput {
    pub status: Option<ServiceStatus>,
    pub stats: Option<serde_json::Value>,
    pub auto_register_if_missing: Option<bool>,
    pub hostname: Option<String>,
    pub internal_address: Option<String>,
    pub ports: Option<ServicePorts>,
    pub meta: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct GetServicesParams {
    pub service: Option<String>,
    pub group: Option<String>,
    pub environment: Option<String>,
    pub region: Option<String>,
    pub status: Option<ServiceStatus>,
    pub exclude_self: Option<bool>,
    pub labels: Option<HashMap<String, String>>,
}

// ============================================================================
// Banner Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Banner {
    pub banner_id: String,
    pub name: String,
    pub description: Option<String>,
    pub width: i32,
    pub height: i32,
    pub metadata: Option<serde_json::Value>,
    pub playback_speed: f64,
    pub shuffle: bool,
    pub sequences: Vec<serde_json::Value>,
    pub version: i32,
    pub status: String,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct BannerListResponse {
    pub banners: Vec<Banner>,
    pub total: i64,
}

// ============================================================================
// Client Version Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientVersion {
    pub id: String,
    pub platform: String,
    pub client_version: String,
    pub client_status: String,
    pub game_server_address: String,
    pub game_server_address_for_white_list: Option<String>,
    pub patch_address: String,
    pub patch_address_for_white_list: Option<String>,
    pub guest_mode_allowed: bool,
    pub external_click_link: Option<String>,
    pub memo: Option<String>,
    pub custom_payload: Option<serde_json::Value>,
    pub maintenance_start_date: Option<String>,
    pub maintenance_end_date: Option<String>,
    pub maintenance_message: Option<String>,
    pub tags: Option<Vec<serde_json::Value>>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientVersionListResponse {
    pub client_versions: Vec<ClientVersion>,
    pub total: i64,
}

// ============================================================================
// Service Notice Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceNotice {
    pub id: String,
    pub is_active: bool,
    pub is_pinned: bool,
    pub category: String,
    pub platforms: Vec<String>,
    pub channels: Option<Vec<String>>,
    pub subchannels: Option<Vec<String>>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub tab_title: Option<String>,
    pub title: String,
    pub content: String,
    pub description: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ServiceNoticeListResponse {
    pub notices: Vec<ServiceNotice>,
    pub total: i64,
}

// ============================================================================
// Vars (KV) Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VarItem {
    pub id: String,
    pub var_key: String,
    pub var_value: String,
    pub value_type: String,
    pub description: Option<String>,
    pub is_system_defined: bool,
    pub is_copyable: bool,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct VarListResponse {
    pub success: bool,
    pub data: Vec<VarItem>,
}
