// Gatrix Rust Server SDK — Basic Example
//
// This example demonstrates how to create, initialize, and use the SDK
// to evaluate feature flags and access game worlds.
//
// Run with: cargo run --example basic

use gatrix_rust_server_sdk::{
    EvaluationContext, GatrixSDKConfig, GatrixServerSDK, UsesConfig,
};

#[tokio::main]
async fn main() {
    // Initialize logger
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    // Create SDK configuration
    let mut config = GatrixSDKConfig::new(
        "http://localhost:45000",     // Gatrix backend URL
        "unsecured-server-api-token", // Server API Token
        "my-game-server",             // Application name
    );

    // Enable only the services you need
    config.uses = UsesConfig {
        feature_flag: true,
        game_world: true,
        ..Default::default()
    };

    // Create SDK instance
    let mut sdk = match GatrixServerSDK::new(config) {
        Ok(sdk) => sdk,
        Err(e) => {
            eprintln!("Failed to create SDK: {}", e);
            return;
        }
    };

    // Initialize — fetches initial data and starts cache refresh
    if let Err(e) = sdk.initialize().await {
        eprintln!("Failed to initialize SDK: {}", e);
        return;
    }

    // ---- Feature Flags ----

    // Simple boolean check
    let ctx = EvaluationContext {
        user_id: Some("user-123".to_string()),
        ..Default::default()
    };

    let enabled = sdk
        .feature_flag
        .is_enabled("new-feature", false, Some(&ctx), None)
        .await;
    println!("new-feature enabled: {}", enabled);

    // Get a string variation
    let value = sdk
        .feature_flag
        .string_variation("welcome-message", "Hello!", Some(&ctx), None)
        .await;
    println!("welcome-message: {}", value);

    // Get number variation
    let max_retries = sdk
        .feature_flag
        .number_variation("max-retries", 3.0, Some(&ctx), None)
        .await;
    println!("max-retries: {}", max_retries);

    // Get detailed evaluation
    let detail = sdk
        .feature_flag
        .string_variation_detail("ab-test", "control", Some(&ctx), None)
        .await;
    println!(
        "ab-test: value={}, reason={}, variant={:?}",
        detail.value, detail.reason, detail.variant_name
    );

    // ---- Game Worlds ----

    let worlds = sdk.game_world.get_cached(None).await;
    println!("Game worlds: {} loaded", worlds.len());

    for world in &worlds {
        let is_maint = sdk
            .game_world
            .is_world_maintenance_active(&world.world_id, None)
            .await;
        println!(
            "  World {}: {} (maintenance: {})",
            world.world_id, world.name, is_maint
        );
    }

    // ---- Shutdown ----
    sdk.shutdown().await;
    println!("SDK shutdown complete");
}
