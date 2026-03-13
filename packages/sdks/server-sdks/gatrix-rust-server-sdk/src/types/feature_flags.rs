// Gatrix Rust Server SDK
// Feature flag types for evaluation

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Feature flag value type
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ValueType {
    String,
    Number,
    Boolean,
    Json,
}

impl std::fmt::Display for ValueType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ValueType::String => write!(f, "string"),
            ValueType::Number => write!(f, "number"),
            ValueType::Boolean => write!(f, "boolean"),
            ValueType::Json => write!(f, "json"),
        }
    }
}

/// Constraint operator
pub type ConstraintOperator = String;

/// Evaluation context passed per-evaluation
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvaluationContext {
    pub user_id: Option<String>,
    pub session_id: Option<String>,
    pub app_name: Option<String>,
    pub app_version: Option<String>,
    pub remote_address: Option<String>,
    #[serde(default)]
    pub properties: HashMap<String, serde_json::Value>,
}

/// Strategy parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StrategyParameters {
    pub rollout: Option<f64>,
    pub stickiness: Option<String>,
    pub group_id: Option<String>,
}

/// Constraint definition
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Constraint {
    pub context_name: String,
    pub operator: ConstraintOperator,
    pub value: Option<String>,
    pub values: Option<Vec<String>>,
    pub case_insensitive: Option<bool>,
    pub inverted: Option<bool>,
}

/// Variant definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Variant {
    pub name: String,
    pub weight: i32,
    pub value: Option<serde_json::Value>,
    #[serde(default)]
    pub enabled: bool,
}

/// Feature segment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeatureSegment {
    pub name: String,
    pub constraints: Vec<Constraint>,
}

/// Feature strategy
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeatureStrategy {
    pub name: String,
    pub parameters: Option<StrategyParameters>,
    pub constraints: Option<Vec<Constraint>>,
    pub segments: Option<Vec<String>>,
    pub is_enabled: bool,
}

/// Feature flag definition
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeatureFlag {
    pub id: String,
    pub name: String,
    pub is_enabled: bool,
    #[serde(default)]
    pub strategies: Vec<FeatureStrategy>,
    #[serde(default)]
    pub variants: Vec<Variant>,
    pub value_type: Option<String>,
    pub enabled_value: Option<serde_json::Value>,
    pub disabled_value: Option<serde_json::Value>,
    pub value_source: Option<String>,
}

/// Evaluation reason
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EvaluationReason {
    Disabled,
    Default,
    StrategyMatch,
    NotFound,
}

impl std::fmt::Display for EvaluationReason {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EvaluationReason::Disabled => write!(f, "disabled"),
            EvaluationReason::Default => write!(f, "default"),
            EvaluationReason::StrategyMatch => write!(f, "strategy_match"),
            EvaluationReason::NotFound => write!(f, "not_found"),
        }
    }
}

/// Evaluation result
#[derive(Debug, Clone)]
pub struct EvaluationResult {
    pub id: String,
    pub flag_name: String,
    pub enabled: bool,
    pub reason: EvaluationReason,
    pub variant: Option<Variant>,
}

/// Evaluation detail with typed value
#[derive(Debug, Clone)]
pub struct EvaluationDetail<T> {
    pub value: T,
    pub reason: EvaluationReason,
    pub variant_name: Option<String>,
    pub flag_name: String,
}

/// Value source constants
pub mod value_source {
    pub const FLAG_DEFAULT_ENABLED: &str = "flag:defaultEnabled";
    pub const FLAG_DEFAULT_DISABLED: &str = "flag:defaultDisabled";
    pub const ENV_DEFAULT_ENABLED: &str = "env:defaultEnabled";
    pub const ENV_DEFAULT_DISABLED: &str = "env:defaultDisabled";
    pub const MISSING: &str = "missing";
}

/// Feature flags API response
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeatureFlagsApiResponse {
    pub flags: Vec<FeatureFlag>,
    pub segments: Option<Vec<FeatureSegment>>,
    pub project_id: Option<String>,
}

/// Flag metric for analytics tracking
#[derive(Debug, Clone)]
pub struct FlagMetric {
    pub environment_id: String,
    pub flag_name: String,
    pub enabled: bool,
    pub variant_name: Option<String>,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}
