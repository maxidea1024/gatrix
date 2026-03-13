// Gatrix Rust Server SDK — Integration Tests
// These tests require a running Gatrix backend at localhost:45000
//
// Run with: cargo test --test integration_tests

use gatrix_rust_server_sdk::{
    GatrixSDKConfig, GatrixServerSDK, UsesConfig, EvaluationContext,
    CacheConfig, RefreshMethod,
};

const API_URL: &str = "http://localhost:45000";
const API_TOKEN: &str = "unsecured-server-api-token";
const APP_NAME: &str = "rust-sdk-integration-test";

/// Helper: create SDK config with manual refresh (no automatic polling)
fn test_config() -> GatrixSDKConfig {
    let mut config = GatrixSDKConfig::new(API_URL, API_TOKEN, APP_NAME);
    config.cache = CacheConfig {
        enabled: true,
        ttl: 300,
        refresh_method: RefreshMethod::Manual,
    };
    config.uses = UsesConfig {
        feature_flag: true,
        game_world: true,
        popup_notice: true,
        survey: true,
        whitelist: false,
        service_maintenance: true,
        store_product: false,
        banner: false,
        client_version: false,
        service_notice: false,
        vars: true,
    };
    config
}

/// Helper: create and initialize SDK
async fn create_initialized_sdk() -> GatrixServerSDK {
    let config = test_config();
    let mut sdk = GatrixServerSDK::new(config).expect("Failed to create SDK");
    sdk.initialize().await.expect("Failed to initialize SDK");
    sdk
}

// ============================================================================
// SDK Lifecycle Tests
// ============================================================================

#[tokio::test]
async fn test_sdk_creation() {
    let config = test_config();
    let sdk = GatrixServerSDK::new(config);
    assert!(sdk.is_ok(), "SDK creation should succeed");
}

#[tokio::test]
async fn test_sdk_initialization() {
    let mut sdk = create_initialized_sdk().await;
    assert!(sdk.is_initialized(), "SDK should be initialized");
    sdk.shutdown().await;
}

#[tokio::test]
async fn test_sdk_double_init() {
    let mut sdk = create_initialized_sdk().await;
    // Double init should not fail
    let result = sdk.initialize().await;
    assert!(result.is_ok(), "Double init should be a no-op");
    sdk.shutdown().await;
}

#[tokio::test]
async fn test_sdk_invalid_config() {
    let config = GatrixSDKConfig::new("", API_TOKEN, APP_NAME);
    let result = GatrixServerSDK::new(config);
    assert!(result.is_err(), "Empty API URL should fail validation");
}

// ============================================================================
// Feature Flag Tests
// ============================================================================

#[tokio::test]
async fn test_feature_flag_fetch() {
    let mut sdk = create_initialized_sdk().await;

    // Flags should have been fetched during init
    let flags = sdk.feature_flag.get_cached(None).await;
    assert!(!flags.is_empty(), "Should have fetched feature flags from backend");
    println!("  Fetched {} feature flags", flags.len());

    for flag in &flags {
        println!("  Flag: {} (enabled: {}, type: {:?})", flag.name, flag.is_enabled, flag.value_type);
    }

    sdk.shutdown().await;
}

#[tokio::test]
async fn test_feature_flag_is_enabled() {
    let mut sdk = create_initialized_sdk().await;

    let flags = sdk.feature_flag.get_cached(None).await;
    assert!(!flags.is_empty(), "Should have flags to test");

    // Test a known flag — use the first one available
    let first_flag = &flags[0];
    let result = sdk.feature_flag.is_enabled(&first_flag.name, false, None, None).await;
    println!("  Flag '{}' is_enabled={}, expected={}", first_flag.name, result, first_flag.is_enabled);

    // If the flag has no strategies and is disabled, it should return false
    if !first_flag.is_enabled {
        assert!(!result, "Disabled flag '{}' should return false", first_flag.name);
    }

    sdk.shutdown().await;
}

#[tokio::test]
async fn test_feature_flag_nonexistent() {
    let mut sdk = create_initialized_sdk().await;

    // Non-existent flag should return fallback
    let result = sdk.feature_flag.is_enabled("definitely-nonexistent-flag-xyz", true, None, None).await;
    assert!(result, "Non-existent flag should return fallback (true)");

    let result = sdk.feature_flag.is_enabled("definitely-nonexistent-flag-xyz", false, None, None).await;
    assert!(!result, "Non-existent flag should return fallback (false)");

    sdk.shutdown().await;
}

#[tokio::test]
async fn test_feature_flag_evaluate() {
    let mut sdk = create_initialized_sdk().await;

    let flags = sdk.feature_flag.get_cached(None).await;
    assert!(!flags.is_empty());

    let flag_name = &flags[0].name;
    let result = sdk.feature_flag.evaluate(flag_name, None, None).await;
    println!("  Evaluate '{}': enabled={}, reason={}", flag_name, result.enabled, result.reason);
    assert_eq!(result.flag_name, *flag_name, "Flag name should match in evaluation result");

    sdk.shutdown().await;
}

#[tokio::test]
async fn test_feature_flag_evaluate_nonexistent() {
    let mut sdk = create_initialized_sdk().await;

    let result = sdk.feature_flag.evaluate("nonexistent-flag-xyz", None, None).await;
    assert!(!result.enabled, "Non-existent flag should evaluate as disabled");
    assert_eq!(result.reason, gatrix_rust_server_sdk::types::feature_flags::EvaluationReason::NotFound);

    sdk.shutdown().await;
}

#[tokio::test]
async fn test_feature_flag_with_context() {
    let mut sdk = create_initialized_sdk().await;

    let ctx = EvaluationContext {
        user_id: Some("test-user-001".to_string()),
        session_id: Some("session-001".to_string()),
        app_name: Some("test-app".to_string()),
        ..Default::default()
    };

    let flags = sdk.feature_flag.get_cached(None).await;
    assert!(!flags.is_empty());

    // Evaluate each flag with context (should not panic)
    for flag in &flags {
        let result = sdk.feature_flag.evaluate(&flag.name, Some(&ctx), None).await;
        println!("  Flag '{}': enabled={}, reason={}", flag.name, result.enabled, result.reason);
    }

    sdk.shutdown().await;
}

#[tokio::test]
async fn test_feature_flag_static_context() {
    let mut sdk = create_initialized_sdk().await;

    // Set static context
    sdk.feature_flag.set_static_context(EvaluationContext {
        app_name: Some("static-app".to_string()),
        ..Default::default()
    }).await;

    // Per-evaluation context should merge with static
    let per_eval_ctx = EvaluationContext {
        user_id: Some("user-123".to_string()),
        ..Default::default()
    };

    let flags = sdk.feature_flag.get_cached(None).await;
    if !flags.is_empty() {
        let result = sdk.feature_flag.evaluate(&flags[0].name, Some(&per_eval_ctx), None).await;
        println!("  Evaluated with merged context: enabled={}", result.enabled);
    }

    sdk.shutdown().await;
}

#[tokio::test]
async fn test_feature_flag_string_variation() {
    let mut sdk = create_initialized_sdk().await;

    // Find a string-type flag
    let flags = sdk.feature_flag.get_cached(None).await;
    let string_flag = flags.iter().find(|f| f.value_type.as_deref() == Some("string"));

    if let Some(flag) = string_flag {
        let value = sdk.feature_flag.string_variation(&flag.name, "fallback", None, None).await;
        println!("  String variation '{}': '{}'", flag.name, value);
        // Value should be a string (empty is valid — enabledValue/disabledValue can be "")
    } else {
        println!("  No string-type flags found, skipping");
    }

    // Non-existent flag returns fallback
    let fb = sdk.feature_flag.string_variation("no-such-flag", "my-fallback", None, None).await;
    assert_eq!(fb, "my-fallback", "Non-existent flag should return fallback");

    sdk.shutdown().await;
}

#[tokio::test]
async fn test_feature_flag_string_variation_detail() {
    let mut sdk = create_initialized_sdk().await;

    let flags = sdk.feature_flag.get_cached(None).await;
    if !flags.is_empty() {
        let detail = sdk.feature_flag.string_variation_detail(
            &flags[0].name, "fallback", None, None,
        ).await;
        println!("  Detail: value='{}', reason={}, variant={:?}", detail.value, detail.reason, detail.variant_name);
        assert_eq!(detail.flag_name, flags[0].name);
    }

    sdk.shutdown().await;
}

#[tokio::test]
async fn test_feature_flag_get_by_name() {
    let mut sdk = create_initialized_sdk().await;

    let flags = sdk.feature_flag.get_cached(None).await;
    if !flags.is_empty() {
        let flag = sdk.feature_flag.get_flag_by_name(&flags[0].name, None).await;
        assert!(flag.is_some(), "Should find flag by name");
        assert_eq!(flag.unwrap().name, flags[0].name);
    }

    let missing = sdk.feature_flag.get_flag_by_name("no-such-flag", None).await;
    assert!(missing.is_none(), "Should return None for missing flag");

    sdk.shutdown().await;
}

// ============================================================================
// Maintenance Service Tests
// ============================================================================

#[tokio::test]
async fn test_maintenance_fetch() {
    let mut sdk = create_initialized_sdk().await;

    let status = sdk.service_maintenance.get_status(None).await;
    assert!(status.is_some(), "Maintenance status should be cached after init");

    let status = status.unwrap();
    println!("  Maintenance active: {}", status.is_maintenance_active);

    sdk.shutdown().await;
}

#[tokio::test]
async fn test_maintenance_is_active() {
    let mut sdk = create_initialized_sdk().await;

    let active = sdk.service_maintenance.is_active(None).await;
    println!("  Maintenance is_active: {}", active);
    // Just verify it doesn't panic and returns a bool
    assert!(active == true || active == false);

    sdk.shutdown().await;
}

// ============================================================================
// Survey Service Tests
// ============================================================================

#[tokio::test]
async fn test_survey_fetch() {
    let mut sdk = create_initialized_sdk().await;

    let surveys = sdk.survey.get_cached(None).await;
    println!("  Surveys: {} items", surveys.len());

    let settings = sdk.survey.get_cached_settings(None).await;
    if let Some(settings) = &settings {
        println!("  Survey settings available: defaultSurveyUrl={}", settings.default_survey_url);
    }
    // Settings should be cached (backend returns them)
    assert!(settings.is_some(), "Survey settings should be cached after fetch");

    sdk.shutdown().await;
}

// ============================================================================
// Vars Service Tests
// ============================================================================

#[tokio::test]
async fn test_vars_fetch() {
    let mut sdk = create_initialized_sdk().await;

    let vars = sdk.vars.get_cached(None).await;
    println!("  Vars: {} items", vars.len());
    assert!(!vars.is_empty(), "Should have at least some vars (system-defined)");

    // Check that system var $channels exists
    let channels = sdk.vars.get_by_key("$channels", None).await;
    if let Some(var) = &channels {
        println!("  $channels var found: value_length={}", var.var_value.len());
    }

    sdk.shutdown().await;
}

#[tokio::test]
async fn test_vars_get_value() {
    let mut sdk = create_initialized_sdk().await;

    let value = sdk.vars.get_value("$channels", None).await;
    assert!(value.is_some(), "$channels should exist as a system var");
    let val = value.unwrap();
    let end = 100.min(val.len());
    println!("  $channels value (first {} chars): {}", end, &val[..end]);

    let missing = sdk.vars.get_value("completely-nonexistent-var", None).await;
    assert!(missing.is_none(), "Non-existent var should return None");

    sdk.shutdown().await;
}

// ============================================================================
// Game World Service Tests
// ============================================================================

#[tokio::test]
async fn test_game_world_fetch() {
    let mut sdk = create_initialized_sdk().await;

    let worlds = sdk.game_world.get_cached(None).await;
    println!("  Game worlds: {} items", worlds.len());
    // May be empty in test environment, just verify no panic
    for world in &worlds {
        println!("  World: {} - {}", world.world_id, world.name);
    }

    sdk.shutdown().await;
}

// ============================================================================
// Cache Refresh Tests
// ============================================================================

#[tokio::test]
async fn test_manual_cache_refresh() {
    let mut sdk = create_initialized_sdk().await;

    // First fetch via init
    let flags_before = sdk.feature_flag.get_cached(None).await;
    let count_before = flags_before.len();

    // Manual refresh
    sdk.refresh_cache().await;

    // After refresh, should still have flags
    let flags_after = sdk.feature_flag.get_cached(None).await;
    println!("  Before refresh: {} flags, after refresh: {} flags", count_before, flags_after.len());
    assert!(!flags_after.is_empty(), "Flags should still be available after manual refresh");

    sdk.shutdown().await;
}

// ============================================================================
// Error Handling Tests
// ============================================================================

#[tokio::test]
async fn test_wrong_api_token() {
    let mut config = test_config();
    config.api_token = "wrong-token".to_string();
    // SDK creation should still succeed (validation doesn't check token)
    let sdk = GatrixServerSDK::new(config);
    assert!(sdk.is_ok(), "SDK creation with wrong token should succeed (validated on API call)");

    // Init should not panic even with wrong token — it should degrade gracefully
    let mut sdk = sdk.unwrap();
    let _result = sdk.initialize().await;
    // After failed init, flags should be empty but SDK should still function
    let flags = sdk.feature_flag.get_cached(None).await;
    println!("  Flags with wrong token: {} (should be 0)", flags.len());

    sdk.shutdown().await;
}

#[tokio::test]
async fn test_wrong_api_url() {
    let mut config = test_config();
    config.api_url = "http://localhost:19999".to_string(); // non-existent port
    config.retry = gatrix_rust_server_sdk::RetryConfig {
        enabled: false, // Disable retries for faster test
        ..Default::default()
    };

    let mut sdk = GatrixServerSDK::new(config).expect("SDK creation should succeed");
    // Initialization should degrade gracefully, not panic
    let _result = sdk.initialize().await;
    let flags = sdk.feature_flag.get_cached(None).await;
    assert!(flags.is_empty(), "Flags should be empty when backend is unreachable");

    sdk.shutdown().await;
}

// ============================================================================
// Full Lifecycle Test
// ============================================================================

#[tokio::test]
async fn test_full_lifecycle() {
    println!("=== Full Lifecycle Test ===");

    // 1. Create
    let config = test_config();
    let mut sdk = GatrixServerSDK::new(config).expect("Step 1: SDK creation");
    assert!(!sdk.is_initialized());
    println!("  Step 1: SDK created");

    // 2. Initialize
    sdk.initialize().await.expect("Step 2: SDK initialization");
    assert!(sdk.is_initialized());
    println!("  Step 2: SDK initialized");

    // 3. Feature flags
    let flags = sdk.feature_flag.get_cached(None).await;
    println!("  Step 3: {} feature flags loaded", flags.len());
    assert!(!flags.is_empty(), "Should have feature flags");

    // 4. Evaluate flags with context
    let ctx = EvaluationContext {
        user_id: Some("lifecycle-test-user".to_string()),
        session_id: Some("lifecycle-session".to_string()),
        app_name: Some(APP_NAME.to_string()),
        ..Default::default()
    };

    for flag in &flags {
        let enabled = sdk.feature_flag.is_enabled(&flag.name, false, Some(&ctx), None).await;
        let eval = sdk.feature_flag.evaluate(&flag.name, Some(&ctx), None).await;
        println!(
            "  Flag '{}': is_enabled={}, reason={}, variant={:?}",
            flag.name, enabled, eval.reason,
            eval.variant.as_ref().map(|v| &v.name)
        );
    }

    // 5. Maintenance
    let maint = sdk.service_maintenance.is_active(None).await;
    println!("  Step 5: Maintenance active={}", maint);

    // 6. Manual refresh
    sdk.refresh_cache().await;
    let flags_after = sdk.feature_flag.get_cached(None).await;
    println!("  Step 6: After refresh, {} flags", flags_after.len());

    // 7. Shutdown
    sdk.shutdown().await;
    assert!(!sdk.is_initialized());
    println!("  Step 7: SDK shutdown complete");

    println!("=== Full Lifecycle Test PASSED ===");
}
