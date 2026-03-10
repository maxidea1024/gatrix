package com.gatrix.server.sdk.config

/**
 * Main SDK Configuration
 */
data class GatrixSdkConfig(
    // Required
    val apiUrl: String,
    val apiToken: String,
    val applicationName: String,

    // Optional - Service identification
    val service: String? = null,
    val group: String? = null,

    // Optional - World ID for world-specific maintenance checks
    val worldId: String? = null,

    // Optional - Version information
    val version: String? = null,
    val commitHash: String? = null,
    val gitBranch: String? = null,

    // Optional - Redis (for PubSub events)
    val redis: RedisConfig? = null,

    // Optional - Cache settings
    val cache: CacheConfig = CacheConfig(),

    // Optional - HTTP retry settings
    val retry: RetryConfig = RetryConfig(),

    // Optional - Feature toggles
    val uses: UsesConfig = UsesConfig(),

    // Optional - Feature flag specific settings
    val featureFlags: FeatureFlagConfig = FeatureFlagConfig()
)

/**
 * Redis configuration for Pub/Sub event listening
 */
data class RedisConfig(
    val host: String = "localhost",
    val port: Int = 6379,
    val password: String? = null,
    val db: Int = 0
)

/**
 * Cache configuration
 */
data class CacheConfig(
    /** Enable caching (default: true) */
    val enabled: Boolean = true,
    /** Cache TTL in seconds (default: 300) */
    val ttl: Int = 300,
    /** Cache refresh method: polling, event, or manual (default: polling) */
    val refreshMethod: String = "polling",
    /** Skip waiting for backend to be ready during initialization (default: false) */
    val skipBackendReady: Boolean = false
)

/**
 * HTTP Retry configuration
 */
data class RetryConfig(
    /** Enable retry (default: true) */
    val enabled: Boolean = true,
    /** Max retry attempts. -1 for infinite retries (default: 10) */
    val maxRetries: Int = 10,
    /** Initial retry delay in ms (default: 2000) */
    val retryDelay: Long = 2000,
    /** Delay multiplier for exponential backoff (default: 2.0) */
    val retryDelayMultiplier: Double = 2.0,
    /** Max retry delay in ms (default: 10000) */
    val maxRetryDelay: Long = 10000,
    /** HTTP status codes to retry (default: [408, 429, 500, 502, 503, 504]) */
    val retryableStatusCodes: List<Int> = listOf(408, 429, 500, 502, 503, 504)
)

/**
 * Features Configuration - toggle caching features on/off
 */
data class UsesConfig(
    // Existing features - default: true
    val gameWorld: Boolean = true,
    val popupNotice: Boolean = true,
    val survey: Boolean = true,
    val whitelist: Boolean = true,
    val serviceMaintenance: Boolean = true,

    // New features - default: false
    val clientVersion: Boolean = false,
    val serviceNotice: Boolean = false,
    val banner: Boolean = false,
    val storeProduct: Boolean = false,
    val featureFlag: Boolean = false,
    val vars: Boolean = false
)

/**
 * Feature Flag specific configuration
 */
data class FeatureFlagConfig(
    /** When true, disabled flags are fetched without strategies/variants to reduce bandwidth (default: true) */
    val compact: Boolean = true
)
