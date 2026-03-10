package com.gatrix.server.sdk.example

import com.gatrix.server.sdk.GatrixServerSdk
import com.gatrix.server.sdk.config.GatrixSdkConfig
import com.gatrix.server.sdk.config.RedisConfig
import com.gatrix.server.sdk.models.EvaluationContext

/**
 * Example: Gatrix Java Server SDK Usage
 *
 * This shows basic SDK initialization, feature flag evaluation,
 * and typed variation methods.
 */
fun main() {
    // 1. Configure the SDK
    val config = GatrixSdkConfig(
        apiUrl = "http://localhost:3000",
        apiToken = "your-api-token",
        applicationName = "my-game-server",

        // Optional: Redis for real-time event updates
        redis = RedisConfig(
            host = "localhost",
            port = 6379
        )
    )

    // 2. Create and initialize
    val sdk = GatrixServerSdk(config)
    try {
        sdk.initialize()
    } catch (e: Exception) {
        println("Failed to initialize SDK: ${e.message}")
        println("Make sure the Gatrix backend is running at ${config.apiUrl}")
        return
    }

    // 3. Evaluate feature flags with per-request context
    val context = EvaluationContext(
        userId = "user-123",
        appName = "my-game-server",
        appVersion = "2.1.0",
        properties = mapOf(
            "region" to "us-east",
            "level" to 42,
            "isPremium" to true,
            "tags" to listOf("beta", "vip")
        )
    )

    // Simple boolean check
    val isNewUiEnabled = sdk.features.isEnabled("new-ui", false, context)
    println("new-ui enabled: $isNewUiEnabled")

    // Typed variations
    val maxRetries = sdk.features.intVariation("max-retries", 3, context)
    println("max-retries: $maxRetries")

    val bannerText = sdk.features.stringVariation("banner-text", "Welcome!", context)
    println("banner-text: $bannerText")

    val featureConfig = sdk.features.jsonVariation(
        "feature-config",
        mapOf("mode" to "default"),
        context
    )
    println("feature-config: $featureConfig")

    // Detailed evaluation (includes reason and variant info)
    val detail = sdk.features.boolVariationDetail("new-ui", false, context)
    println("new-ui detail: value=${detail.value}, reason=${detail.reason}, variant=${detail.variantName}")

    // 4. Shutdown
    sdk.shutdown()
    println("SDK shut down")
}
