package com.gatrix.server.sdk.events

import com.gatrix.server.sdk.cache.FlagDefinitionCache
import com.gatrix.server.sdk.config.RedisConfig
import com.gatrix.server.sdk.models.FeatureFlag
import com.gatrix.server.sdk.models.FeatureSegment
import com.gatrix.server.sdk.services.FeatureFlagService
import com.google.gson.Gson
import com.google.gson.JsonObject
import org.slf4j.LoggerFactory
import redis.clients.jedis.JedisPool
import redis.clients.jedis.JedisPoolConfig
import redis.clients.jedis.JedisPubSub

/**
 * Event Listener for Redis Pub/Sub
 * Listens to cache invalidation events from Gatrix backend.
 *
 * Channel format: gatrix-sdk-events:{orgId|-}:{projectId|-}:{environmentId|-}
 */
class EventListener(
    private val redisConfig: RedisConfig,
    private val featureFlagService: FeatureFlagService,
    private val defaultEnvironmentId: String
) {
    private val logger = LoggerFactory.getLogger(EventListener::class.java)
    private val gson = Gson()
    private val channelPrefix = "gatrix-sdk-events"

    private var jedisPool: JedisPool? = null
    private var subscriberThread: Thread? = null
    private var pubSub: GatrixPubSub? = null

    @Volatile
    private var isConnected = false

    @Volatile
    private var isShuttingDown = false

    // Event callbacks: eventType -> list of callbacks
    private val eventCallbacks = mutableMapOf<String, MutableList<(SdkEvent) -> Unit>>()

    /**
     * Initialize event listener - connect to Redis and subscribe
     */
    fun initialize(channelContext: ChannelContext? = null) {
        logger.info("Initializing Redis event listener...")

        try {
            val poolConfig = JedisPoolConfig().apply {
                maxTotal = 2
                maxIdle = 2
                minIdle = 0
                testOnBorrow = true
            }

            jedisPool = if (redisConfig.password != null) {
                JedisPool(
                    poolConfig,
                    redisConfig.host,
                    redisConfig.port,
                    2000,
                    redisConfig.password,
                    redisConfig.db
                )
            } else {
                JedisPool(poolConfig, redisConfig.host, redisConfig.port, 2000, null, redisConfig.db)
            }

            // Build channels to subscribe
            val channels = buildChannels(channelContext)

            // Create Pub/Sub handler
            pubSub = GatrixPubSub()

            // Subscribe in a separate thread (blocking call)
            subscriberThread = Thread({
                while (!isShuttingDown) {
                    try {
                        jedisPool?.resource?.use { jedis ->
                            isConnected = true
                            logger.info("Redis event listener connected, subscribing to: {}", channels)

                            if (channels.isNotEmpty()) {
                                jedis.subscribe(pubSub!!, *channels.toTypedArray())
                            }
                        }
                    } catch (e: Exception) {
                        isConnected = false
                        if (!isShuttingDown) {
                            logger.warn("Redis subscriber disconnected: {}. Reconnecting in 5s...", e.message)
                            try {
                                Thread.sleep(5000)
                            } catch (_: InterruptedException) {
                                break
                            }
                        }
                    }
                }
            }, "gatrix-redis-subscriber").apply {
                isDaemon = true
            }

            subscriberThread?.start()
            logger.info("Redis event listener initialized")

        } catch (e: Exception) {
            logger.error("Failed to initialize Redis event listener: {}", e.message)
            throw e
        }
    }

    /**
     * Build channel names based on context
     */
    private fun buildChannels(channelContext: ChannelContext?): List<String> {
        val channels = mutableListOf<String>()

        if (channelContext != null) {
            val org = channelContext.orgId ?: "-"
            val proj = channelContext.projectId ?: "-"
            val env = channelContext.environmentId ?: "-"
            channels.add("$channelPrefix:$org:$proj:$env")
        } else {
            // Fallback: subscribe with default environment
            channels.add("$channelPrefix:-:-:$defaultEnvironmentId")
        }

        return channels
    }

    /**
     * Register event callback
     * Returns a function to unregister the listener
     */
    fun on(eventType: String, callback: (SdkEvent) -> Unit): () -> Unit {
        val callbacks = eventCallbacks.getOrPut(eventType) { mutableListOf() }
        callbacks.add(callback)
        return { eventCallbacks[eventType]?.remove(callback) }
    }

    /**
     * Close event listener and cleanup
     */
    fun close() {
        logger.info("Closing Redis event listener...")
        isShuttingDown = true

        try {
            pubSub?.unsubscribe()
        } catch (_: Exception) { }

        subscriberThread?.interrupt()
        subscriberThread = null

        try {
            jedisPool?.close()
        } catch (_: Exception) { }

        jedisPool = null
        isConnected = false
        eventCallbacks.clear()

        logger.info("Redis event listener closed")
    }

    /**
     * Check if connected to Redis
     */
    fun isConnected(): Boolean = isConnected

    /**
     * Inner Pub/Sub handler
     */
    private inner class GatrixPubSub : JedisPubSub() {
        override fun onMessage(channel: String, message: String) {
            try {
                val event = gson.fromJson(message, JsonObject::class.java)
                val eventType = event.get("type")?.asString ?: return
                val eventData = event.getAsJsonObject("data")

                logger.info("SDK Event received: type={}, channel={}", eventType, channel)

                // Handle cache invalidation events
                handleEvent(eventType, eventData)

                // Emit to registered listeners
                emitEvent(eventType, eventData)

            } catch (e: Exception) {
                logger.error("Failed to process event message: {}", e.message)
            }
        }

        override fun onSubscribe(channel: String, subscribedChannels: Int) {
            logger.info("Subscribed to Redis channel: {} (total: {})", channel, subscribedChannels)
        }

        override fun onUnsubscribe(channel: String, subscribedChannels: Int) {
            logger.info("Unsubscribed from Redis channel: {} (total: {})", channel, subscribedChannels)
        }
    }

    /**
     * Handle cache invalidation events from backend
     */
    private fun handleEvent(eventType: String, data: JsonObject?) {
        val environmentId = data?.get("environmentId")?.asString
            ?: data?.get("environment")?.asString
            ?: defaultEnvironmentId

        try {
            when (eventType) {
                // Feature flag events
                "feature.created", "feature.updated" -> {
                    val flagJson = data?.get("flag")
                    if (flagJson != null) {
                        val flag = gson.fromJson(flagJson, FeatureFlag::class.java)
                        featureFlagService.getCache().upsertFlag(flag, environmentId)
                        logger.info("Flag upserted in cache: {} (env: {})", flag.name, environmentId)
                    } else {
                        // Full refresh if individual flag not provided
                        refreshFlagsAsync(environmentId)
                    }
                }

                "feature.deleted" -> {
                    val flagName = data?.get("name")?.asString ?: data?.get("flagName")?.asString
                    if (flagName != null) {
                        featureFlagService.getCache().removeFlag(flagName, environmentId)
                        logger.info("Flag removed from cache: {} (env: {})", flagName, environmentId)
                    }
                }

                "feature.toggled" -> {
                    // Refresh all flags for this environment
                    refreshFlagsAsync(environmentId)
                }

                // Segment events (segments are per-project, NOT global)
                "segment.created", "segment.updated" -> {
                    val projectId = data?.get("projectId")?.asString
                        ?: featureFlagService.getCache().getProjectId(environmentId)
                    if (projectId == null) {
                        logger.warn("Segment event missing projectId, doing full refresh")
                        refreshFlagsAsync(environmentId)
                    } else {
                        val segmentJson = data?.get("segment")
                        if (segmentJson != null) {
                            val segment = gson.fromJson(segmentJson, FeatureSegment::class.java)
                            featureFlagService.getCache().upsertSegment(segment, projectId)
                            logger.info("Segment upserted in cache: {} (project: {})", segment.name, projectId)
                        } else {
                            // Full refresh
                            refreshFlagsAsync(environmentId)
                        }
                    }
                }

                "segment.deleted" -> {
                    val projectId = data?.get("projectId")?.asString
                        ?: featureFlagService.getCache().getProjectId(environmentId)
                    val segmentName = data?.get("name")?.asString
                    if (segmentName != null && projectId != null) {
                        featureFlagService.getCache().removeSegment(segmentName, projectId)
                        logger.info("Segment removed from cache: {} (project: {})", segmentName, projectId)
                    } else if (segmentName != null) {
                        // Fallback: remove from all projects if projectId unknown
                        featureFlagService.getCache().removeSegmentFromAll(segmentName)
                        logger.warn("Segment removed from ALL projects (no projectId): {}", segmentName)
                    }
                }

                // Full refresh events
                "cache.invalidate", "environment.updated" -> {
                    refreshFlagsAsync(environmentId)
                }

                else -> {
                    logger.debug("Unhandled event type: {}", eventType)
                }
            }
        } catch (e: Exception) {
            logger.error("Failed to handle event {}: {}", eventType, e.message)
        }
    }

    /**
     * Asynchronously refresh flags
     */
    private fun refreshFlagsAsync(environmentId: String) {
        Thread({
            try {
                featureFlagService.refreshFlags(environmentId)
                logger.info("Flags refreshed after event for environment: {}", environmentId)
            } catch (e: Exception) {
                logger.error("Failed to refresh flags after event: {}", e.message)
            }
        }, "gatrix-flag-refresh").apply {
            isDaemon = true
            start()
        }
    }

    /**
     * Emit event to registered callbacks
     */
    private fun emitEvent(eventType: String, data: JsonObject?) {
        val event = SdkEvent(
            type = eventType,
            data = data?.toString() ?: "{}",
            timestamp = System.currentTimeMillis()
        )

        // Exact match listeners
        eventCallbacks[eventType]?.forEach { callback ->
            try {
                callback(event)
            } catch (e: Exception) {
                logger.error("Error in event callback for {}: {}", eventType, e.message)
            }
        }

        // Wildcard listeners
        eventCallbacks["*"]?.forEach { callback ->
            try {
                callback(event)
            } catch (e: Exception) {
                logger.error("Error in wildcard event callback: {}", e.message)
            }
        }
    }
}

/**
 * Channel subscription context
 */
data class ChannelContext(
    val orgId: String? = null,
    val projectId: String? = null,
    val environmentId: String? = null
)

/**
 * SDK Event emitted to listeners
 */
data class SdkEvent(
    val type: String,
    val data: String,
    val timestamp: Long
)
