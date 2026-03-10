package com.gatrix.server.sdk.services

import com.gatrix.server.sdk.cache.FlagDefinitionCache
import com.gatrix.server.sdk.client.GatrixApiClient
import com.gatrix.server.sdk.evaluation.FeatureFlagEvaluator
import com.gatrix.server.sdk.models.*
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import org.slf4j.LoggerFactory

/**
 * Feature Flag Service
 * Handles feature flag retrieval and local evaluation.
 *
 * DESIGN PRINCIPLES:
 * - All methods that access cached data receive environment explicitly
 * - Evaluations are performed locally using cached flags
 * - Segments are cached separately and referenced by name
 */
class FeatureFlagService(
    private val apiClient: GatrixApiClient,
    private val defaultEnvironmentId: String
) {
    private val logger = LoggerFactory.getLogger(FeatureFlagService::class.java)
    private val cache = FlagDefinitionCache()
    private val gson = Gson()

    // Static context merged with per-evaluation context
    private var staticContext: EvaluationContext = EvaluationContext()

    // Compact mode: strip evaluation data from disabled flags to reduce bandwidth
    var compactFlags: Boolean = true

    /**
     * Set static context (default context merged with per-evaluation context)
     */
    fun setStaticContext(context: EvaluationContext) {
        this.staticContext = context
        logger.debug("Static context set with keys: {}", context.properties.keys)
    }

    /**
     * Get static context
     */
    fun getStaticContext(): EvaluationContext = staticContext.copy()

    /**
     * Merge static context with per-evaluation context
     * Per-evaluation context takes precedence
     */
    private fun mergeContext(context: EvaluationContext?): EvaluationContext {
        if (context == null) return staticContext

        return EvaluationContext(
            userId = context.userId ?: staticContext.userId,
            sessionId = context.sessionId ?: staticContext.sessionId,
            appName = context.appName ?: staticContext.appName,
            appVersion = context.appVersion ?: staticContext.appVersion,
            remoteAddress = context.remoteAddress ?: staticContext.remoteAddress,
            environment = context.environment ?: staticContext.environment,
            currentTime = context.currentTime ?: staticContext.currentTime,
            properties = staticContext.properties + context.properties
        )
    }

    // ==================== API Methods ====================

    /**
     * Fetch all flags for a specific environment
     * GET /api/v1/server/features
     */
    fun fetchFlags(environmentId: String = defaultEnvironmentId): List<FeatureFlag> {
        var endpoint = "/api/v1/server/features"
        if (compactFlags) {
            endpoint += "?compact=true"
        }

        logger.debug("Fetching feature flags for environment: {}", environmentId)

        val typeToken = object : TypeToken<FlagsResponse>() {}
        val result = apiClient.get(endpoint, typeToken)

        if (!result.success || result.data == null) {
            throw RuntimeException(result.error ?: "Failed to fetch feature flags")
        }

        val response = result.data
        val flags = response.flags ?: emptyList()
        val segments = response.segments ?: emptyList()

        // Update cache atomically
        cache.update(flags, segments, environmentId, response.projectId)

        logger.info("Feature flags fetched: count={}, environment={}", flags.size, environmentId)
        return flags
    }

    /**
     * Refresh cached flags for a specific environment
     */
    fun refreshFlags(environmentId: String = defaultEnvironmentId): List<FeatureFlag> {
        logger.info("Refreshing feature flags cache for environment: {}", environmentId)
        apiClient.invalidateEtagCache("/api/v1/server/features")
        return fetchFlags(environmentId)
    }

    // ==================== Cache Access ====================

    /**
     * Get all cached flags for an environment
     */
    fun getCached(environmentId: String = defaultEnvironmentId): List<FeatureFlag> {
        return cache.getCached(environmentId)
    }

    /**
     * Get a single flag by name from cache
     */
    fun getFlagByName(flagName: String, environmentId: String = defaultEnvironmentId): FeatureFlag? {
        return cache.getFlag(flagName, environmentId)
    }

    /**
     * Check if a flag exists in cache
     */
    fun hasFlag(flagName: String, environmentId: String = defaultEnvironmentId): Boolean {
        return cache.getFlag(flagName, environmentId) != null
    }

    /**
     * Get the underlying cache for direct event handler access
     */
    internal fun getCache(): FlagDefinitionCache = cache

    // ==================== Evaluation Methods ====================

    /**
     * Core evaluation method
     */
    fun evaluate(
        flagName: String,
        context: EvaluationContext? = null,
        environmentId: String = defaultEnvironmentId
    ): EvaluationResult {
        val flag = cache.getFlag(flagName, environmentId)
            ?: return EvaluationResult(
                flagName = flagName,
                enabled = false,
                reason = EvaluationReasons.NOT_FOUND,
                variant = Variant(name = ValueSource.MISSING, weight = 100, enabled = false)
            )

        val mergedContext = mergeContext(context)
        // Use per-project segments: resolve environmentId -> projectId -> segments
        val segmentsMap = cache.getSegmentsForEnvironment(environmentId)
        return FeatureFlagEvaluator.evaluate(flag, mergedContext, segmentsMap)
    }

    /**
     * Check if a feature flag is enabled
     */
    fun isEnabled(
        flagName: String,
        fallbackValue: Boolean,
        context: EvaluationContext? = null,
        environmentId: String = defaultEnvironmentId
    ): Boolean {
        val result = evaluate(flagName, context, environmentId)
        if (result.reason == EvaluationReasons.NOT_FOUND) {
            return fallbackValue
        }
        return result.enabled
    }

    // ==================== Typed Variation Methods ====================

    /**
     * Get boolean variation
     */
    fun boolVariation(
        flagName: String,
        fallbackValue: Boolean,
        context: EvaluationContext? = null,
        environmentId: String = defaultEnvironmentId
    ): Boolean {
        return isEnabled(flagName, fallbackValue, context, environmentId)
    }

    /**
     * Get boolean variation with evaluation details
     */
    fun boolVariationDetail(
        flagName: String,
        fallbackValue: Boolean,
        context: EvaluationContext? = null,
        environmentId: String = defaultEnvironmentId
    ): EvaluationDetail<Boolean> {
        val result = evaluate(flagName, context, environmentId)
        return EvaluationDetail(
            flagName = result.flagName,
            value = if (result.reason == EvaluationReasons.NOT_FOUND) fallbackValue else result.enabled,
            reason = result.reason,
            variantName = result.variant.name
        )
    }

    /**
     * Get string variation from variant value
     */
    fun stringVariation(
        flagName: String,
        fallbackValue: String,
        context: EvaluationContext? = null,
        environmentId: String = defaultEnvironmentId
    ): String {
        val result = evaluate(flagName, context, environmentId)
        if (result.reason == EvaluationReasons.NOT_FOUND || result.variant.value == null) {
            return fallbackValue
        }
        return result.variant.value.toString()
    }

    /**
     * Get string variation with evaluation details
     */
    fun stringVariationDetail(
        flagName: String,
        fallbackValue: String,
        context: EvaluationContext? = null,
        environmentId: String = defaultEnvironmentId
    ): EvaluationDetail<String> {
        val result = evaluate(flagName, context, environmentId)
        val value = if (result.reason == EvaluationReasons.NOT_FOUND || result.variant.value == null) {
            fallbackValue
        } else {
            result.variant.value.toString()
        }
        return EvaluationDetail(
            flagName = result.flagName,
            value = value,
            reason = result.reason,
            variantName = result.variant.name
        )
    }

    /**
     * Get number variation (as Double)
     */
    fun numberVariation(
        flagName: String,
        fallbackValue: Double,
        context: EvaluationContext? = null,
        environmentId: String = defaultEnvironmentId
    ): Double {
        val result = evaluate(flagName, context, environmentId)
        if (result.reason == EvaluationReasons.NOT_FOUND || result.variant.value == null) {
            return fallbackValue
        }
        return when (val v = result.variant.value) {
            is Number -> v.toDouble()
            else -> v.toString().toDoubleOrNull() ?: fallbackValue
        }
    }

    /**
     * Get number variation with evaluation details
     */
    fun numberVariationDetail(
        flagName: String,
        fallbackValue: Double,
        context: EvaluationContext? = null,
        environmentId: String = defaultEnvironmentId
    ): EvaluationDetail<Double> {
        val result = evaluate(flagName, context, environmentId)
        val value = if (result.reason == EvaluationReasons.NOT_FOUND || result.variant.value == null) {
            fallbackValue
        } else {
            when (val v = result.variant.value) {
                is Number -> v.toDouble()
                else -> v.toString().toDoubleOrNull() ?: fallbackValue
            }
        }
        return EvaluationDetail(
            flagName = result.flagName,
            value = value,
            reason = result.reason,
            variantName = result.variant.name
        )
    }

    /**
     * Get integer variation
     */
    fun intVariation(
        flagName: String,
        fallbackValue: Int,
        context: EvaluationContext? = null,
        environmentId: String = defaultEnvironmentId
    ): Int {
        return numberVariation(flagName, fallbackValue.toDouble(), context, environmentId).toInt()
    }

    /**
     * Get JSON variation (as Map)
     */
    @Suppress("UNCHECKED_CAST")
    fun jsonVariation(
        flagName: String,
        fallbackValue: Map<String, Any?>,
        context: EvaluationContext? = null,
        environmentId: String = defaultEnvironmentId
    ): Map<String, Any?> {
        val result = evaluate(flagName, context, environmentId)
        if (result.reason == EvaluationReasons.NOT_FOUND || result.variant.value == null) {
            return fallbackValue
        }
        return when (val v = result.variant.value) {
            is Map<*, *> -> v as Map<String, Any?>
            is String -> {
                try {
                    gson.fromJson(v, Map::class.java) as? Map<String, Any?> ?: fallbackValue
                } catch (_: Exception) {
                    fallbackValue
                }
            }
            else -> fallbackValue
        }
    }
}

// ==================== Internal Response Types ====================

internal data class FlagsResponse(
    val flags: List<FeatureFlag>? = null,
    val segments: List<FeatureSegment>? = null,
    val projectId: String? = null
)
