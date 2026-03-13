// Gatrix Rust Server SDK
// Feature Flag Evaluator
// Ported from Node.js @gatrix/evaluator (FeatureFlagEvaluator)
// Uses MurmurHash3 for consistent percentage bucketing

use std::collections::HashMap;
use std::io::Cursor;

use crate::types::feature_flags::*;

/// MurmurHash3 32-bit hash (seed 0, compatible with Node.js murmurhash package)
fn murmurhash3_32(data: &[u8]) -> u32 {
    // Use murmur3 crate but since we have a simple implementation need,
    // implement inline to match the exact behavior of the JS murmur3 package
    murmur3_32_of(data, 0)
}

/// murmur3 32-bit hash with seed
fn murmur3_32_of(data: &[u8], seed: u32) -> u32 {
    let mut cursor = Cursor::new(data);
    // murmur3 crate uses Read trait
    match murmur3::murmur3_32(&mut cursor, seed) {
        Ok(hash) => hash,
        Err(_) => 0,
    }
}

/// Calculate percentage for rollout/variant selection
/// Formula: (murmurhash3(groupId + ":" + stickinessValue, 0) % 10000) / 100.0
fn calculate_percentage(
    ctx: &EvaluationContext,
    stickiness: &str,
    group_id: &str,
) -> f64 {
    let stickiness_value = match stickiness {
        "default" | "userId" => {
            ctx.user_id
                .as_deref()
                .filter(|s| !s.is_empty())
                .or_else(|| ctx.session_id.as_deref().filter(|s| !s.is_empty()))
                .map(|s| s.to_string())
                .unwrap_or_else(|| format!("{}", rand::random::<f64>()))
        }
        "sessionId" => ctx
            .session_id
            .as_deref()
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
            .unwrap_or_else(|| format!("{}", rand::random::<f64>())),
        "random" => format!("{}", rand::random::<f64>()),
        _ => {
            // Custom stickiness — look up in context properties
            get_context_value(stickiness, ctx)
                .map(|v| value_to_string(&v))
                .unwrap_or_else(|| format!("{}", rand::random::<f64>()))
        }
    };

    let seed = format!("{}:{}", group_id, stickiness_value);
    let hash = murmurhash3_32(seed.as_bytes());
    (hash % 10000) as f64 / 100.0
}

/// Get a context value by field name
fn get_context_value(name: &str, ctx: &EvaluationContext) -> Option<serde_json::Value> {
    match name {
        "userId" => ctx
            .user_id
            .as_ref()
            .filter(|s| !s.is_empty())
            .map(|s| serde_json::Value::String(s.clone())),
        "sessionId" => ctx
            .session_id
            .as_ref()
            .filter(|s| !s.is_empty())
            .map(|s| serde_json::Value::String(s.clone())),
        "appName" => ctx
            .app_name
            .as_ref()
            .filter(|s| !s.is_empty())
            .map(|s| serde_json::Value::String(s.clone())),
        "appVersion" => ctx
            .app_version
            .as_ref()
            .filter(|s| !s.is_empty())
            .map(|s| serde_json::Value::String(s.clone())),
        "remoteAddress" => ctx
            .remote_address
            .as_ref()
            .filter(|s| !s.is_empty())
            .map(|s| serde_json::Value::String(s.clone())),
        _ => ctx.properties.get(name).cloned(),
    }
}

/// Convert serde_json::Value to string for comparison
fn value_to_string(v: &serde_json::Value) -> String {
    match v {
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::Bool(b) => b.to_string(),
        serde_json::Value::Null => String::new(),
        _ => v.to_string(),
    }
}

fn value_to_f64(v: &serde_json::Value) -> f64 {
    match v {
        serde_json::Value::Number(n) => n.as_f64().unwrap_or(0.0),
        serde_json::Value::String(s) => s.parse::<f64>().unwrap_or(0.0),
        serde_json::Value::Bool(b) => {
            if *b {
                1.0
            } else {
                0.0
            }
        }
        _ => 0.0,
    }
}

fn str_to_f64(s: &str) -> f64 {
    s.parse::<f64>().unwrap_or(0.0)
}

fn value_to_bool(v: &serde_json::Value) -> bool {
    match v {
        serde_json::Value::Bool(b) => *b,
        serde_json::Value::String(s) => s == "true" || s == "1",
        serde_json::Value::Number(n) => n.as_f64().unwrap_or(0.0) != 0.0,
        _ => false,
    }
}

fn value_to_string_vec(v: &serde_json::Value) -> Vec<String> {
    match v {
        serde_json::Value::Array(arr) => arr.iter().map(|item| value_to_string(item)).collect(),
        _ => vec![],
    }
}

fn to_lower_vec(v: &[String]) -> Vec<String> {
    v.iter().map(|s| s.to_lowercase()).collect()
}

/// Apply inverted modifier
fn apply_inverted(result: bool, inverted: bool) -> bool {
    if inverted {
        !result
    } else {
        result
    }
}

/// Parse time from various formats
fn parse_time(s: &str) -> Option<chrono::DateTime<chrono::Utc>> {
    // Try RFC3339 first
    if let Ok(t) = chrono::DateTime::parse_from_rfc3339(s) {
        return Some(t.with_timezone(&chrono::Utc));
    }
    // Try ISO 8601 without timezone
    if let Ok(t) = chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%SZ") {
        return Some(t.and_utc());
    }
    // Try date only
    if let Ok(t) = chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d") {
        return t.and_hms_opt(0, 0, 0).map(|dt| dt.and_utc());
    }
    None
}

/// Compare semver strings
fn compare_semver(a: &str, b: &str) -> std::cmp::Ordering {
    let a_parts = parse_semver(a);
    let b_parts = parse_semver(b);
    let max_len = a_parts.len().max(b_parts.len());

    for i in 0..max_len {
        let a_val = a_parts.get(i).copied().unwrap_or(0);
        let b_val = b_parts.get(i).copied().unwrap_or(0);
        match a_val.cmp(&b_val) {
            std::cmp::Ordering::Equal => continue,
            other => return other,
        }
    }
    std::cmp::Ordering::Equal
}

fn parse_semver(v: &str) -> Vec<i32> {
    let v = v.strip_prefix('v').unwrap_or(v);
    v.split('.')
        .map(|p| p.parse::<i32>().unwrap_or(0))
        .collect()
}

/// Convert IPv4 string to u32
fn ip_to_num(ip: &str) -> Option<u32> {
    let parts: Vec<&str> = ip.trim().split('.').collect();
    if parts.len() != 4 {
        return None;
    }
    let mut result: u32 = 0;
    for part in parts {
        let n: u32 = part.parse().ok()?;
        if n > 255 {
            return None;
        }
        result = (result << 8) + n;
    }
    Some(result)
}

/// Check if an IP is within a CIDR range
fn is_in_cidr(ip: &str, cidr: &str) -> bool {
    let parts: Vec<&str> = cidr.splitn(2, '/').collect();
    let ip_num = match ip_to_num(ip) {
        Some(n) => n,
        None => return false,
    };
    let range_num = match ip_to_num(parts[0]) {
        Some(n) => n,
        None => return false,
    };
    if parts.len() == 1 {
        return ip_num == range_num;
    }
    let prefix: u32 = match parts[1].parse() {
        Ok(p) if p <= 32 => p,
        _ => return false,
    };
    let mask: u32 = if prefix == 0 {
        0
    } else {
        !0u32 << (32 - prefix)
    };
    (ip_num & mask) == (range_num & mask)
}

/// Evaluate a single constraint
fn evaluate_constraint(constraint: &Constraint, ctx: &EvaluationContext) -> bool {
    let context_value = get_context_value(&constraint.context_name, ctx);
    let inverted = constraint.inverted.unwrap_or(false);
    let case_insensitive = constraint.case_insensitive.unwrap_or(false);

    // Handle exists/not_exists BEFORE nil check
    if constraint.operator == "exists" {
        let result = context_value.is_some();
        return apply_inverted(result, inverted);
    }
    if constraint.operator == "not_exists" {
        let result = context_value.is_none();
        return apply_inverted(result, inverted);
    }

    // Handle arr_empty BEFORE nil check
    if constraint.operator == "arr_empty" {
        let result = match &context_value {
            Some(v) => {
                let arr = value_to_string_vec(v);
                arr.is_empty()
            }
            None => true,
        };
        return apply_inverted(result, inverted);
    }

    let context_value = match context_value {
        Some(v) => v,
        None => return apply_inverted(false, inverted),
    };

    // Array operators
    if constraint.operator == "arr_any" || constraint.operator == "arr_all" {
        let arr = value_to_string_vec(&context_value);
        let target_values = constraint.values.as_deref().unwrap_or(&[]);

        let (arr, target_values_owned): (Vec<String>, Vec<String>) = if case_insensitive {
            (to_lower_vec(&arr), to_lower_vec(target_values))
        } else {
            (arr, target_values.to_vec())
        };

        let result = if constraint.operator == "arr_any" {
            target_values_owned.iter().any(|t| arr.contains(t))
        } else {
            !target_values_owned.is_empty()
                && target_values_owned.iter().all(|t| arr.contains(t))
        };
        return apply_inverted(result, inverted);
    }

    let string_value = value_to_string(&context_value);
    let target_value_raw = constraint.value.as_deref().unwrap_or("");

    let (compare_value, target_value) = if case_insensitive {
        (string_value.to_lowercase(), target_value_raw.to_lowercase())
    } else {
        (string_value.clone(), target_value_raw.to_string())
    };

    let target_values = constraint.values.as_deref().unwrap_or(&[]);
    let target_values_cmp: Vec<String> = if case_insensitive {
        to_lower_vec(target_values)
    } else {
        target_values.to_vec()
    };

    let result = match constraint.operator.as_str() {
        // String operators
        "str_eq" => compare_value == target_value,
        "str_contains" => compare_value.contains(&target_value),
        "str_starts_with" => compare_value.starts_with(&target_value),
        "str_ends_with" => compare_value.ends_with(&target_value),
        "str_in" => target_values_cmp.contains(&compare_value),
        "str_regex" => {
            let pattern = if case_insensitive {
                format!("(?i){}", target_value_raw)
            } else {
                target_value_raw.to_string()
            };
            regex::Regex::new(&pattern)
                .map(|re| re.is_match(&string_value))
                .unwrap_or(false)
        }

        // Number operators
        "num_eq" => value_to_f64(&context_value) == str_to_f64(target_value_raw),
        "num_gt" => value_to_f64(&context_value) > str_to_f64(target_value_raw),
        "num_gte" => value_to_f64(&context_value) >= str_to_f64(target_value_raw),
        "num_lt" => value_to_f64(&context_value) < str_to_f64(target_value_raw),
        "num_lte" => value_to_f64(&context_value) <= str_to_f64(target_value_raw),
        "num_in" => {
            let cv = value_to_f64(&context_value);
            target_values.iter().any(|v| str_to_f64(v) == cv)
        }

        // Boolean operator
        "bool_is" => value_to_bool(&context_value) == (target_value_raw == "true"),

        // Date operators
        "date_eq" => {
            let t1 = parse_time(&string_value);
            let t2 = parse_time(&target_value);
            matches!((t1, t2), (Some(a), Some(b)) if a == b)
        }
        "date_gt" => {
            let t1 = parse_time(&string_value);
            let t2 = parse_time(&target_value);
            matches!((t1, t2), (Some(a), Some(b)) if a > b)
        }
        "date_gte" => {
            let t1 = parse_time(&string_value);
            let t2 = parse_time(&target_value);
            matches!((t1, t2), (Some(a), Some(b)) if a >= b)
        }
        "date_lt" => {
            let t1 = parse_time(&string_value);
            let t2 = parse_time(&target_value);
            matches!((t1, t2), (Some(a), Some(b)) if a < b)
        }
        "date_lte" => {
            let t1 = parse_time(&string_value);
            let t2 = parse_time(&target_value);
            matches!((t1, t2), (Some(a), Some(b)) if a <= b)
        }

        // Semver operators
        "semver_eq" => compare_semver(&string_value, &target_value) == std::cmp::Ordering::Equal,
        "semver_gt" => compare_semver(&string_value, &target_value) == std::cmp::Ordering::Greater,
        "semver_gte" => compare_semver(&string_value, &target_value) != std::cmp::Ordering::Less,
        "semver_lt" => compare_semver(&string_value, &target_value) == std::cmp::Ordering::Less,
        "semver_lte" => {
            compare_semver(&string_value, &target_value) != std::cmp::Ordering::Greater
        }
        "semver_in" => target_values
            .iter()
            .any(|v| compare_semver(&string_value, v) == std::cmp::Ordering::Equal),

        // CIDR operator
        "cidr_match" => target_values
            .iter()
            .any(|cidr| string_value == *cidr || is_in_cidr(&string_value, cidr)),

        _ => false,
    };

    apply_inverted(result, inverted)
}

/// Evaluate a strategy: segments → constraints → rollout
fn evaluate_strategy(
    strategy: &FeatureStrategy,
    ctx: &EvaluationContext,
    flag: &FeatureFlag,
    segments: &HashMap<String, FeatureSegment>,
) -> bool {
    // 1. Check segment constraints
    if let Some(seg_names) = &strategy.segments {
        for seg_name in seg_names {
            if let Some(segment) = segments.get(seg_name) {
                if !segment.constraints.is_empty() {
                    let all_pass = segment.constraints.iter().all(|c| evaluate_constraint(c, ctx));
                    if !all_pass {
                        return false;
                    }
                }
            }
        }
    }

    // 2. Check strategy constraints
    if let Some(constraints) = &strategy.constraints {
        for c in constraints {
            if !evaluate_constraint(c, ctx) {
                return false;
            }
        }
    }

    // 3. Check rollout percentage (delegate to strategy-specific logic)
    let mut rollout = 100.0;
    if let Some(params) = &strategy.parameters {
        if let Some(r) = params.rollout {
            rollout = r;
        }
    }

    if rollout < 100.0 {
        let stickiness = strategy
            .parameters
            .as_ref()
            .and_then(|p| p.stickiness.as_deref())
            .unwrap_or("default");
        let group_id = strategy
            .parameters
            .as_ref()
            .and_then(|p| p.group_id.as_deref())
            .unwrap_or(&flag.name);

        let percentage = calculate_percentage(ctx, stickiness, group_id);
        if percentage > rollout {
            return false;
        }
    }

    true
}

/// Select a variant based on weighted distribution
fn select_variant(
    flag: &FeatureFlag,
    ctx: &EvaluationContext,
    matched_strategy: Option<&FeatureStrategy>,
) -> Option<Variant> {
    if flag.variants.is_empty() {
        return None;
    }

    let total_weight: i32 = flag.variants.iter().map(|v| v.weight).sum();
    if total_weight <= 0 {
        return None;
    }

    let stickiness = matched_strategy
        .and_then(|s| s.parameters.as_ref())
        .and_then(|p| p.stickiness.as_deref())
        .unwrap_or("default");

    let percentage = calculate_percentage(ctx, stickiness, &format!("{}-variant", flag.name));
    let target_weight = (percentage / 100.0) * total_weight as f64;

    let mut cumulative_weight = 0.0;
    for variant in &flag.variants {
        cumulative_weight += variant.weight as f64;
        if target_weight <= cumulative_weight {
            return Some(variant.clone());
        }
    }

    flag.variants.last().cloned()
}

/// Ensure values match the declared valueType
pub fn get_fallback_value(
    value: Option<&serde_json::Value>,
    value_type: Option<&str>,
) -> serde_json::Value {
    let vt = value_type.unwrap_or("string");

    match value {
        None | Some(serde_json::Value::Null) => match vt {
            "boolean" => serde_json::Value::Bool(false),
            "number" => serde_json::json!(0.0),
            "json" => serde_json::json!({}),
            _ => serde_json::Value::String(String::new()),
        },
        Some(v) => match vt {
            "string" => match v {
                serde_json::Value::String(s) => serde_json::Value::String(s.clone()),
                _ => serde_json::Value::String(value_to_string(v)),
            },
            "number" => serde_json::json!(value_to_f64(v)),
            "boolean" => serde_json::Value::Bool(value_to_bool(v)),
            "json" => match v {
                serde_json::Value::Object(_) | serde_json::Value::Array(_) => v.clone(),
                serde_json::Value::String(s) => {
                    serde_json::from_str(s).unwrap_or_else(|_| serde_json::json!({}))
                }
                _ => v.clone(),
            },
            _ => v.clone(),
        },
    }
}

/// Evaluate a single feature flag
pub fn evaluate(
    flag: &FeatureFlag,
    ctx: &EvaluationContext,
    segments: &HashMap<String, FeatureSegment>,
) -> EvaluationResult {
    let vt = flag.value_type.as_deref();
    let mut reason = EvaluationReason::Disabled;

    if flag.is_enabled {
        let active_strategies: Vec<&FeatureStrategy> = flag
            .strategies
            .iter()
            .filter(|s| s.is_enabled)
            .collect();

        if !active_strategies.is_empty() {
            // Check strategies in order (first match wins)
            for strategy in &active_strategies {
                if evaluate_strategy(strategy, ctx, flag, segments) {
                    let variant = select_variant(flag, ctx, Some(strategy));
                    let default_name = if flag.value_source.as_deref() == Some("environment") {
                        value_source::ENV_DEFAULT_ENABLED
                    } else {
                        value_source::FLAG_DEFAULT_ENABLED
                    };

                    let (var_name, var_weight, var_value) = match &variant {
                        Some(v) => (
                            v.name.clone(),
                            v.weight,
                            v.value.clone(),
                        ),
                        None => (default_name.to_string(), 100, None),
                    };

                    let final_value = if var_value.is_some() && var_value.as_ref() != Some(&serde_json::Value::Null) {
                        var_value
                    } else {
                        flag.enabled_value.clone()
                    };

                    return EvaluationResult {
                        id: flag.id.clone(),
                        flag_name: flag.name.clone(),
                        enabled: true,
                        reason: EvaluationReason::StrategyMatch,
                        variant: Some(Variant {
                            name: var_name,
                            weight: var_weight,
                            value: Some(get_fallback_value(final_value.as_ref(), vt)),
                            enabled: true,
                        }),
                    };
                }
            }
            reason = EvaluationReason::Default;
        } else {
            // No strategies or all disabled — enabled by default
            let variant = select_variant(flag, ctx, None);
            let default_name = if flag.value_source.as_deref() == Some("environment") {
                value_source::ENV_DEFAULT_ENABLED
            } else {
                value_source::FLAG_DEFAULT_ENABLED
            };

            let (var_name, var_weight, var_value) = match &variant {
                Some(v) => (v.name.clone(), v.weight, v.value.clone()),
                None => (default_name.to_string(), 100, None),
            };

            let final_value = if var_value.is_some() && var_value.as_ref() != Some(&serde_json::Value::Null) {
                var_value
            } else {
                flag.enabled_value.clone()
            };

            return EvaluationResult {
                id: flag.id.clone(),
                flag_name: flag.name.clone(),
                enabled: true,
                reason: EvaluationReason::Default,
                variant: Some(Variant {
                    name: var_name,
                    weight: var_weight,
                    value: Some(get_fallback_value(final_value.as_ref(), vt)),
                    enabled: true,
                }),
            };
        }
    }

    // Disabled or no strategy matched
    let default_disabled_name = if flag.value_source.as_deref() == Some("environment") {
        value_source::ENV_DEFAULT_DISABLED
    } else {
        value_source::FLAG_DEFAULT_DISABLED
    };

    EvaluationResult {
        id: flag.id.clone(),
        flag_name: flag.name.clone(),
        enabled: false,
        reason,
        variant: Some(Variant {
            name: default_disabled_name.to_string(),
            weight: 100,
            value: Some(get_fallback_value(flag.disabled_value.as_ref(), vt)),
            enabled: false,
        }),
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn empty_segments() -> HashMap<String, FeatureSegment> {
        HashMap::new()
    }

    #[test]
    fn test_evaluate_disabled_flag() {
        let flag = FeatureFlag {
            id: "f1".to_string(),
            name: "disabled-flag".to_string(),
            is_enabled: false,
            strategies: vec![],
            variants: vec![],
            value_type: Some("string".to_string()),
            enabled_value: None,
            disabled_value: Some(serde_json::json!("off")),
            value_source: None,
        };
        let ctx = EvaluationContext::default();
        let result = evaluate(&flag, &ctx, &empty_segments());

        assert!(!result.enabled);
        assert_eq!(result.reason, EvaluationReason::Disabled);
        assert_eq!(
            result.variant.as_ref().unwrap().value,
            Some(serde_json::json!("off"))
        );
    }

    #[test]
    fn test_evaluate_enabled_no_strategies() {
        let flag = FeatureFlag {
            id: "f2".to_string(),
            name: "enabled-flag".to_string(),
            is_enabled: true,
            strategies: vec![],
            variants: vec![],
            value_type: Some("string".to_string()),
            enabled_value: Some(serde_json::json!("on")),
            disabled_value: None,
            value_source: None,
        };
        let result = evaluate(&flag, &EvaluationContext::default(), &empty_segments());

        assert!(result.enabled);
        assert_eq!(result.reason, EvaluationReason::Default);
        assert_eq!(
            result.variant.as_ref().unwrap().value,
            Some(serde_json::json!("on"))
        );
    }

    #[test]
    fn test_evaluate_strategy_match() {
        let flag = FeatureFlag {
            id: "f3".to_string(),
            name: "strategy-flag".to_string(),
            is_enabled: true,
            strategies: vec![FeatureStrategy {
                name: "target-users".to_string(),
                is_enabled: true,
                constraints: Some(vec![Constraint {
                    context_name: "userId".to_string(),
                    operator: "str_eq".to_string(),
                    value: Some("user-123".to_string()),
                    values: None,
                    case_insensitive: None,
                    inverted: None,
                }]),
                segments: None,
                parameters: None,
            }],
            variants: vec![],
            value_type: Some("string".to_string()),
            enabled_value: Some(serde_json::json!("matched")),
            disabled_value: Some(serde_json::json!("not-matched")),
            value_source: None,
        };
        let ctx = EvaluationContext {
            user_id: Some("user-123".to_string()),
            ..Default::default()
        };
        let result = evaluate(&flag, &ctx, &empty_segments());

        assert!(result.enabled);
        assert_eq!(result.reason, EvaluationReason::StrategyMatch);
    }

    #[test]
    fn test_evaluate_strategy_not_matched() {
        let flag = FeatureFlag {
            id: "f4".to_string(),
            name: "no-match-flag".to_string(),
            is_enabled: true,
            strategies: vec![FeatureStrategy {
                name: "target-users".to_string(),
                is_enabled: true,
                constraints: Some(vec![Constraint {
                    context_name: "userId".to_string(),
                    operator: "str_eq".to_string(),
                    value: Some("user-999".to_string()),
                    values: None,
                    case_insensitive: None,
                    inverted: None,
                }]),
                segments: None,
                parameters: None,
            }],
            variants: vec![],
            value_type: Some("string".to_string()),
            enabled_value: None,
            disabled_value: Some(serde_json::json!("fallback")),
            value_source: None,
        };
        let ctx = EvaluationContext {
            user_id: Some("user-123".to_string()),
            ..Default::default()
        };
        let result = evaluate(&flag, &ctx, &empty_segments());

        assert!(!result.enabled);
        assert_eq!(result.reason, EvaluationReason::Default);
    }

    #[test]
    fn test_constraint_str_contains() {
        let flag = FeatureFlag {
            id: "c1".to_string(),
            name: "contains-flag".to_string(),
            is_enabled: true,
            strategies: vec![FeatureStrategy {
                name: "s".to_string(),
                is_enabled: true,
                constraints: Some(vec![Constraint {
                    context_name: "appName".to_string(),
                    operator: "str_contains".to_string(),
                    value: Some("game".to_string()),
                    values: None,
                    case_insensitive: None,
                    inverted: None,
                }]),
                segments: None,
                parameters: None,
            }],
            variants: vec![],
            value_type: Some("boolean".to_string()),
            enabled_value: Some(serde_json::json!(true)),
            disabled_value: None,
            value_source: None,
        };

        let ctx = EvaluationContext {
            app_name: Some("my-game-server".to_string()),
            ..Default::default()
        };
        let result = evaluate(&flag, &ctx, &empty_segments());
        assert!(result.enabled);

        let ctx2 = EvaluationContext {
            app_name: Some("web-server".to_string()),
            ..Default::default()
        };
        let result2 = evaluate(&flag, &ctx2, &empty_segments());
        assert_ne!(result2.reason, EvaluationReason::StrategyMatch);
    }

    #[test]
    fn test_constraint_str_in() {
        let flag = FeatureFlag {
            id: "c2".to_string(),
            name: "in-flag".to_string(),
            is_enabled: true,
            strategies: vec![FeatureStrategy {
                name: "s".to_string(),
                is_enabled: true,
                constraints: Some(vec![Constraint {
                    context_name: "userId".to_string(),
                    operator: "str_in".to_string(),
                    value: None,
                    values: Some(vec![
                        "user-1".to_string(),
                        "user-2".to_string(),
                        "user-3".to_string(),
                    ]),
                    case_insensitive: None,
                    inverted: None,
                }]),
                segments: None,
                parameters: None,
            }],
            variants: vec![],
            value_type: Some("boolean".to_string()),
            enabled_value: Some(serde_json::json!(true)),
            disabled_value: None,
            value_source: None,
        };

        let ctx = EvaluationContext {
            user_id: Some("user-2".to_string()),
            ..Default::default()
        };
        assert!(evaluate(&flag, &ctx, &empty_segments()).enabled);

        let ctx2 = EvaluationContext {
            user_id: Some("user-99".to_string()),
            ..Default::default()
        };
        let r = evaluate(&flag, &ctx2, &empty_segments());
        assert_ne!(r.reason, EvaluationReason::StrategyMatch);
    }

    #[test]
    fn test_constraint_num_gt() {
        let flag = FeatureFlag {
            id: "c3".to_string(),
            name: "num-flag".to_string(),
            is_enabled: true,
            strategies: vec![FeatureStrategy {
                name: "s".to_string(),
                is_enabled: true,
                constraints: Some(vec![Constraint {
                    context_name: "level".to_string(),
                    operator: "num_gt".to_string(),
                    value: Some("10".to_string()),
                    values: None,
                    case_insensitive: None,
                    inverted: None,
                }]),
                segments: None,
                parameters: None,
            }],
            variants: vec![],
            value_type: Some("boolean".to_string()),
            enabled_value: Some(serde_json::json!(true)),
            disabled_value: None,
            value_source: None,
        };

        let mut props = HashMap::new();
        props.insert("level".to_string(), serde_json::json!(15));
        let ctx = EvaluationContext {
            properties: props,
            ..Default::default()
        };
        assert!(evaluate(&flag, &ctx, &empty_segments()).enabled);

        let mut props2 = HashMap::new();
        props2.insert("level".to_string(), serde_json::json!(5));
        let ctx2 = EvaluationContext {
            properties: props2,
            ..Default::default()
        };
        let r = evaluate(&flag, &ctx2, &empty_segments());
        assert_ne!(r.reason, EvaluationReason::StrategyMatch);
    }

    #[test]
    fn test_constraint_exists() {
        let flag = FeatureFlag {
            id: "c4".to_string(),
            name: "exists-flag".to_string(),
            is_enabled: true,
            strategies: vec![FeatureStrategy {
                name: "s".to_string(),
                is_enabled: true,
                constraints: Some(vec![Constraint {
                    context_name: "userId".to_string(),
                    operator: "exists".to_string(),
                    value: None,
                    values: None,
                    case_insensitive: None,
                    inverted: None,
                }]),
                segments: None,
                parameters: None,
            }],
            variants: vec![],
            value_type: Some("boolean".to_string()),
            enabled_value: Some(serde_json::json!(true)),
            disabled_value: None,
            value_source: None,
        };

        let ctx = EvaluationContext {
            user_id: Some("user-1".to_string()),
            ..Default::default()
        };
        assert!(evaluate(&flag, &ctx, &empty_segments()).enabled);

        let ctx2 = EvaluationContext::default();
        let r = evaluate(&flag, &ctx2, &empty_segments());
        assert_ne!(r.reason, EvaluationReason::StrategyMatch);
    }

    #[test]
    fn test_constraint_inverted() {
        let flag = FeatureFlag {
            id: "c5".to_string(),
            name: "inverted-flag".to_string(),
            is_enabled: true,
            strategies: vec![FeatureStrategy {
                name: "s".to_string(),
                is_enabled: true,
                constraints: Some(vec![Constraint {
                    context_name: "userId".to_string(),
                    operator: "str_eq".to_string(),
                    value: Some("admin".to_string()),
                    values: None,
                    case_insensitive: None,
                    inverted: Some(true),
                }]),
                segments: None,
                parameters: None,
            }],
            variants: vec![],
            value_type: Some("boolean".to_string()),
            enabled_value: Some(serde_json::json!(true)),
            disabled_value: None,
            value_source: None,
        };

        // "admin" should NOT match (inverted)
        let ctx = EvaluationContext {
            user_id: Some("admin".to_string()),
            ..Default::default()
        };
        let r = evaluate(&flag, &ctx, &empty_segments());
        assert_ne!(r.reason, EvaluationReason::StrategyMatch);

        // "user-1" should match (inverted)
        let ctx2 = EvaluationContext {
            user_id: Some("user-1".to_string()),
            ..Default::default()
        };
        assert!(evaluate(&flag, &ctx2, &empty_segments()).enabled);
    }

    #[test]
    fn test_constraint_case_insensitive() {
        let flag = FeatureFlag {
            id: "c6".to_string(),
            name: "case-flag".to_string(),
            is_enabled: true,
            strategies: vec![FeatureStrategy {
                name: "s".to_string(),
                is_enabled: true,
                constraints: Some(vec![Constraint {
                    context_name: "userId".to_string(),
                    operator: "str_eq".to_string(),
                    value: Some("Admin".to_string()),
                    values: None,
                    case_insensitive: Some(true),
                    inverted: None,
                }]),
                segments: None,
                parameters: None,
            }],
            variants: vec![],
            value_type: Some("boolean".to_string()),
            enabled_value: Some(serde_json::json!(true)),
            disabled_value: None,
            value_source: None,
        };

        let ctx = EvaluationContext {
            user_id: Some("admin".to_string()),
            ..Default::default()
        };
        assert!(evaluate(&flag, &ctx, &empty_segments()).enabled);
    }

    #[test]
    fn test_constraint_semver_gte() {
        let flag = FeatureFlag {
            id: "c7".to_string(),
            name: "semver-flag".to_string(),
            is_enabled: true,
            strategies: vec![FeatureStrategy {
                name: "s".to_string(),
                is_enabled: true,
                constraints: Some(vec![Constraint {
                    context_name: "appVersion".to_string(),
                    operator: "semver_gte".to_string(),
                    value: Some("2.0.0".to_string()),
                    values: None,
                    case_insensitive: None,
                    inverted: None,
                }]),
                segments: None,
                parameters: None,
            }],
            variants: vec![],
            value_type: Some("boolean".to_string()),
            enabled_value: Some(serde_json::json!(true)),
            disabled_value: None,
            value_source: None,
        };

        let ctx = EvaluationContext {
            app_version: Some("2.1.0".to_string()),
            ..Default::default()
        };
        assert!(evaluate(&flag, &ctx, &empty_segments()).enabled);

        let ctx2 = EvaluationContext {
            app_version: Some("1.9.0".to_string()),
            ..Default::default()
        };
        let r = evaluate(&flag, &ctx2, &empty_segments());
        assert_ne!(r.reason, EvaluationReason::StrategyMatch);
    }

    #[test]
    fn test_evaluate_with_segment() {
        let mut segments = HashMap::new();
        segments.insert(
            "beta-users".to_string(),
            FeatureSegment {
                name: "beta-users".to_string(),
                constraints: vec![Constraint {
                    context_name: "userId".to_string(),
                    operator: "str_in".to_string(),
                    value: None,
                    values: Some(vec!["user-1".to_string(), "user-2".to_string()]),
                    case_insensitive: None,
                    inverted: None,
                }],
            },
        );

        let flag = FeatureFlag {
            id: "s1".to_string(),
            name: "segment-flag".to_string(),
            is_enabled: true,
            strategies: vec![FeatureStrategy {
                name: "s".to_string(),
                is_enabled: true,
                constraints: None,
                segments: Some(vec!["beta-users".to_string()]),
                parameters: None,
            }],
            variants: vec![],
            value_type: Some("boolean".to_string()),
            enabled_value: Some(serde_json::json!(true)),
            disabled_value: None,
            value_source: None,
        };

        let ctx = EvaluationContext {
            user_id: Some("user-1".to_string()),
            ..Default::default()
        };
        assert!(evaluate(&flag, &ctx, &segments).enabled);

        let ctx2 = EvaluationContext {
            user_id: Some("user-99".to_string()),
            ..Default::default()
        };
        let r = evaluate(&flag, &ctx2, &segments);
        assert_ne!(r.reason, EvaluationReason::StrategyMatch);
    }

    #[test]
    fn test_evaluate_rollout() {
        let flag = FeatureFlag {
            id: "r1".to_string(),
            name: "rollout-flag".to_string(),
            is_enabled: true,
            strategies: vec![FeatureStrategy {
                name: "s".to_string(),
                is_enabled: true,
                constraints: None,
                segments: None,
                parameters: Some(StrategyParameters {
                    rollout: Some(0.0),
                    stickiness: None,
                    group_id: None,
                }),
            }],
            variants: vec![],
            value_type: Some("boolean".to_string()),
            enabled_value: Some(serde_json::json!(true)),
            disabled_value: None,
            value_source: None,
        };

        let ctx = EvaluationContext {
            user_id: Some("user-123".to_string()),
            ..Default::default()
        };
        let r = evaluate(&flag, &ctx, &empty_segments());
        // With 0% rollout, nobody should match
        assert_ne!(r.reason, EvaluationReason::StrategyMatch);
    }

    #[test]
    fn test_evaluate_variant_selection() {
        let flag = FeatureFlag {
            id: "v1".to_string(),
            name: "variant-flag".to_string(),
            is_enabled: true,
            strategies: vec![],
            variants: vec![
                Variant {
                    name: "control".to_string(),
                    weight: 50,
                    value: Some(serde_json::json!("A")),
                    enabled: true,
                },
                Variant {
                    name: "treatment".to_string(),
                    weight: 50,
                    value: Some(serde_json::json!("B")),
                    enabled: true,
                },
            ],
            value_type: Some("string".to_string()),
            enabled_value: Some(serde_json::json!("default")),
            disabled_value: None,
            value_source: None,
        };

        let ctx = EvaluationContext {
            user_id: Some("user-test".to_string()),
            ..Default::default()
        };
        let result = evaluate(&flag, &ctx, &empty_segments());
        assert!(result.variant.is_some());
        let variant_name = &result.variant.as_ref().unwrap().name;
        assert!(variant_name == "control" || variant_name == "treatment");

        // Same user should get same variant (stickiness)
        let result2 = evaluate(&flag, &ctx, &empty_segments());
        assert_eq!(
            result2.variant.as_ref().unwrap().name,
            result.variant.as_ref().unwrap().name
        );
    }

    #[test]
    fn test_get_fallback_value() {
        // Nil → defaults
        assert_eq!(get_fallback_value(None, Some("boolean")), serde_json::json!(false));
        assert_eq!(get_fallback_value(None, Some("number")), serde_json::json!(0.0));
        assert_eq!(get_fallback_value(None, Some("string")), serde_json::json!(""));

        // String coercion
        assert_eq!(
            get_fallback_value(Some(&serde_json::json!(42)), Some("string")),
            serde_json::json!("42")
        );

        // Boolean coercion
        assert_eq!(
            get_fallback_value(Some(&serde_json::json!("true")), Some("boolean")),
            serde_json::json!(true)
        );
        assert_eq!(
            get_fallback_value(Some(&serde_json::json!("false")), Some("boolean")),
            serde_json::json!(false)
        );

        // Number coercion
        assert_eq!(
            get_fallback_value(Some(&serde_json::json!("42.5")), Some("number")),
            serde_json::json!(42.5)
        );
    }

    #[test]
    fn test_constraint_arr_any() {
        let flag = FeatureFlag {
            id: "a1".to_string(),
            name: "arr-flag".to_string(),
            is_enabled: true,
            strategies: vec![FeatureStrategy {
                name: "s".to_string(),
                is_enabled: true,
                constraints: Some(vec![Constraint {
                    context_name: "tags".to_string(),
                    operator: "arr_any".to_string(),
                    value: None,
                    values: Some(vec!["vip".to_string(), "premium".to_string()]),
                    case_insensitive: None,
                    inverted: None,
                }]),
                segments: None,
                parameters: None,
            }],
            variants: vec![],
            value_type: Some("boolean".to_string()),
            enabled_value: Some(serde_json::json!(true)),
            disabled_value: None,
            value_source: None,
        };

        let mut props = HashMap::new();
        props.insert("tags".to_string(), serde_json::json!(["basic", "vip"]));
        let ctx = EvaluationContext {
            properties: props,
            ..Default::default()
        };
        assert!(evaluate(&flag, &ctx, &empty_segments()).enabled);
    }

    #[test]
    fn test_constraint_arr_empty() {
        let flag = FeatureFlag {
            id: "a2".to_string(),
            name: "arr-empty-flag".to_string(),
            is_enabled: true,
            strategies: vec![FeatureStrategy {
                name: "s".to_string(),
                is_enabled: true,
                constraints: Some(vec![Constraint {
                    context_name: "items".to_string(),
                    operator: "arr_empty".to_string(),
                    value: None,
                    values: None,
                    case_insensitive: None,
                    inverted: None,
                }]),
                segments: None,
                parameters: None,
            }],
            variants: vec![],
            value_type: Some("boolean".to_string()),
            enabled_value: Some(serde_json::json!(true)),
            disabled_value: None,
            value_source: None,
        };

        // Empty array
        let mut props = HashMap::new();
        props.insert("items".to_string(), serde_json::json!([]));
        let ctx = EvaluationContext {
            properties: props,
            ..Default::default()
        };
        assert!(evaluate(&flag, &ctx, &empty_segments()).enabled);

        // Missing field should also match
        assert!(evaluate(&flag, &EvaluationContext::default(), &empty_segments()).enabled);
    }

    #[test]
    fn test_constraint_str_regex() {
        let flag = FeatureFlag {
            id: "rx".to_string(),
            name: "regex-flag".to_string(),
            is_enabled: true,
            strategies: vec![FeatureStrategy {
                name: "s".to_string(),
                is_enabled: true,
                constraints: Some(vec![Constraint {
                    context_name: "userId".to_string(),
                    operator: "str_regex".to_string(),
                    value: Some(r"^user-\d+$".to_string()),
                    values: None,
                    case_insensitive: None,
                    inverted: None,
                }]),
                segments: None,
                parameters: None,
            }],
            variants: vec![],
            value_type: Some("boolean".to_string()),
            enabled_value: Some(serde_json::json!(true)),
            disabled_value: None,
            value_source: None,
        };

        let ctx = EvaluationContext {
            user_id: Some("user-123".to_string()),
            ..Default::default()
        };
        assert!(evaluate(&flag, &ctx, &empty_segments()).enabled);

        let ctx2 = EvaluationContext {
            user_id: Some("admin".to_string()),
            ..Default::default()
        };
        let r = evaluate(&flag, &ctx2, &empty_segments());
        assert_ne!(r.reason, EvaluationReason::StrategyMatch);
    }

    #[test]
    fn test_cidr_match() {
        assert!(is_in_cidr("192.168.1.100", "192.168.1.0/24"));
        assert!(!is_in_cidr("192.168.2.100", "192.168.1.0/24"));
        assert!(is_in_cidr("10.0.0.1", "10.0.0.1"));
    }

    #[test]
    fn test_compare_semver() {
        assert_eq!(compare_semver("1.0.0", "1.0.0"), std::cmp::Ordering::Equal);
        assert_eq!(compare_semver("2.0.0", "1.0.0"), std::cmp::Ordering::Greater);
        assert_eq!(compare_semver("1.0.0", "2.0.0"), std::cmp::Ordering::Less);
        assert_eq!(compare_semver("v1.2.3", "1.2.3"), std::cmp::Ordering::Equal);
    }
}
