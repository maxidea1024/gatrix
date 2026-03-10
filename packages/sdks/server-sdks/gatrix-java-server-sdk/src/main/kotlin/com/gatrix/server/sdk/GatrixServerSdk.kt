package com.gatrix.server.sdk

import com.gatrix.server.sdk.client.GatrixApiClient
import com.gatrix.server.sdk.config.GatrixSdkConfig
import com.gatrix.server.sdk.events.ChannelContext
import com.gatrix.server.sdk.events.EventListener
import com.gatrix.server.sdk.services.FeatureFlagService
import org.slf4j.LoggerFactory
import java.util.Timer
import java.util.TimerTask

/**
 * Gatrix Java Server SDK
 *
 * Main entry point for Gatrix Server SDK.
 * All service-specific operations MUST be accessed through their dedicated sub-service.
 *
 * Usage:
 *   val sdk = GatrixServerSdk(config)
 *   sdk.initialize()
 *   val enabled = sdk.features.isEnabled("my-flag", false, context)
 *   sdk.shutdown()
 */
class GatrixServerSdk(private val config: GatrixSdkConfig) {

    private val logger = LoggerFactory.getLogger(GatrixServerSdk::class.java)

    // Derived environment ID from the API token (resolved after first API call)
    // For now we use apiToken as the cache key; the backend resolves environment from token
    private val environmentId: String = config.apiToken

    // HTTP API Client
    private val apiClient: GatrixApiClient = GatrixApiClient(
        baseUrl = config.apiUrl,
        apiToken = config.apiToken,
        applicationName = config.applicationName,
        sdkVersion = config.version ?: "1.0.0",
        retryConfig = config.retry
    )

    // ==================== Services ====================

    /** Feature Flag service - local evaluation, typed variations */
    val features: FeatureFlagService = FeatureFlagService(
        apiClient = apiClient,
        defaultEnvironmentId = environmentId
    ).apply {
        compactFlags = config.featureFlags.compact
    }

    // ==================== Redis Pub/Sub ====================

    private var eventListener: EventListener? = null

    // ==================== Polling ====================

    private var pollingTimer: Timer? = null

    @Volatile
    private var isInitialized = false

    /**
     * Initialize the SDK
     * - Fetches initial flag definitions
     * - Starts cache refresh (polling or Redis Pub/Sub event)
     */
    fun initialize() {
        logger.info("Initializing Gatrix Server SDK...")

        // Validate config
        require(config.apiUrl.isNotBlank()) { "apiUrl must not be blank" }
        require(config.apiToken.isNotBlank()) { "apiToken must not be blank" }
        require(config.applicationName.isNotBlank()) { "applicationName must not be blank" }

        // Fetch initial flag definitions
        try {
            features.fetchFlags(environmentId)
            logger.info("Initial flag definitions loaded")
        } catch (e: Exception) {
            logger.error("Failed to fetch initial flag definitions: {}", e.message)
            if (!config.cache.skipBackendReady) {
                throw e
            }
            logger.warn("Continuing with empty cache (skipBackendReady=true)")
        }

        // Start cache refresh based on configured method
        when (config.cache.refreshMethod) {
            "polling" -> startPolling()
            "event" -> startEventListener()
            "manual" -> {
                logger.info("Manual refresh mode - no background activity")
            }
            else -> {
                logger.warn("Unknown refresh method '{}', falling back to polling", config.cache.refreshMethod)
                startPolling()
            }
        }

        isInitialized = true
        logger.info("Gatrix Server SDK initialized successfully")
    }

    /**
     * Start polling timer
     */
    private fun startPolling() {
        val intervalMs = config.cache.ttl.toLong() * 1000

        pollingTimer = Timer("gatrix-cache-polling", true).apply {
            scheduleAtFixedRate(object : TimerTask() {
                override fun run() {
                    try {
                        features.fetchFlags(environmentId)
                        logger.debug("Cache refreshed via polling")
                    } catch (e: Exception) {
                        logger.error("Polling cache refresh failed: {}", e.message)
                    }
                }
            }, intervalMs, intervalMs)
        }

        logger.info("Polling started with interval: {}s", config.cache.ttl)
    }

    /**
     * Start Redis Pub/Sub event listener
     */
    private fun startEventListener() {
        val redisConfig = config.redis
        if (redisConfig == null) {
            logger.warn("Redis config not provided, falling back to polling")
            startPolling()
            return
        }

        try {
            eventListener = EventListener(
                redisConfig = redisConfig,
                featureFlagService = features,
                defaultEnvironmentId = environmentId
            )
            eventListener?.initialize(ChannelContext())

            logger.info("Event listener started (Redis Pub/Sub)")
        } catch (e: Exception) {
            logger.error("Failed to start event listener: {}. Falling back to polling.", e.message)
            startPolling()
        }
    }

    /**
     * Manually refresh all cached data
     */
    fun refreshCache() {
        logger.info("Manual cache refresh triggered")
        features.refreshFlags(environmentId)
    }

    /**
     * Register an event listener for SDK events (requires Redis Pub/Sub mode)
     */
    fun on(eventType: String, callback: (com.gatrix.server.sdk.events.SdkEvent) -> Unit): () -> Unit {
        return eventListener?.on(eventType, callback)
            ?: run {
                logger.warn("Event listener not available - event mode not enabled")
                return { }
            }
    }

    /**
     * Shutdown the SDK gracefully
     * Stops all background tasks and closes connections
     */
    fun shutdown() {
        logger.info("Shutting down Gatrix Server SDK...")

        pollingTimer?.cancel()
        pollingTimer = null

        eventListener?.close()
        eventListener = null

        apiClient.close()

        isInitialized = false
        logger.info("Gatrix Server SDK shut down")
    }

    /**
     * Check if SDK is initialized
     */
    fun isInitialized(): Boolean = isInitialized
}
