package com.gatrix.server.sdk.models

import com.google.gson.annotations.SerializedName

// ==================== Core Types ====================

/**
 * Evaluation context passed to flag evaluation
 */
data class EvaluationContext(
    @SerializedName("userId") val userId: String? = null,
    @SerializedName("sessionId") val sessionId: String? = null,
    @SerializedName("appName") val appName: String? = null,
    @SerializedName("appVersion") val appVersion: String? = null,
    @SerializedName("remoteAddress") val remoteAddress: String? = null,
    @SerializedName("environment") val environment: String? = null,
    @SerializedName("currentTime") val currentTime: java.util.Date? = null,
    /** Custom properties (string, number, boolean, or string array) */
    @SerializedName("properties") val properties: Map<String, Any?> = emptyMap()
)

/**
 * Strategy parameters for flag evaluation
 */
data class StrategyParameters(
    @SerializedName("rollout") val rollout: Int? = null,
    @SerializedName("stickiness") val stickiness: String? = null,
    @SerializedName("groupId") val groupId: String? = null,
    @SerializedName("percentage") val percentage: Int? = null,
    @SerializedName("userIds") val userIds: String? = null,
    @SerializedName("IPs") val ips: String? = null,
    @SerializedName("hostNames") val hostNames: String? = null
)

/**
 * Constraint for evaluating context values
 */
data class Constraint(
    @SerializedName("contextName") val contextName: String,
    @SerializedName("operator") val operator: String,
    @SerializedName("value") val value: String? = null,
    @SerializedName("values") val values: List<String>? = null,
    @SerializedName("caseInsensitive") val caseInsensitive: Boolean = false,
    @SerializedName("inverted") val inverted: Boolean = false
)

/**
 * Variant definition
 */
data class Variant(
    @SerializedName("name") val name: String = "",
    @SerializedName("weight") val weight: Int = 0,
    @SerializedName("value") val value: Any? = null,
    @SerializedName("enabled") val enabled: Boolean = false
)

/**
 * Feature Segment - reusable set of constraints
 * Segments are global (not environment-specific)
 * isActive is for UI display only, not for evaluation
 */
data class FeatureSegment(
    @SerializedName("name") val name: String,
    @SerializedName("constraints") val constraints: List<Constraint> = emptyList(),
    @SerializedName("isActive") val isActive: Boolean = true
)

/**
 * Feature Strategy - targeting rule
 */
data class FeatureStrategy(
    @SerializedName("name") val name: String,
    @SerializedName("parameters") val parameters: StrategyParameters? = null,
    @SerializedName("constraints") val constraints: List<Constraint>? = null,
    @SerializedName("segments") val segments: List<String>? = null,
    @SerializedName("isEnabled") val isEnabled: Boolean = true,
    @SerializedName("sortOrder") val sortOrder: Int = 0
)

/**
 * Feature Flag - core flag definition for evaluation
 */
data class FeatureFlag(
    @SerializedName("id") val id: String = "",
    @SerializedName("name") val name: String,
    @SerializedName("isEnabled") val isEnabled: Boolean = false,
    @SerializedName("impressionDataEnabled") val impressionDataEnabled: Boolean = false,
    @SerializedName("strategies") val strategies: List<FeatureStrategy>? = null,
    @SerializedName("variants") val variants: List<Variant>? = null,
    @SerializedName("valueType") val valueType: String? = null,
    @SerializedName("enabledValue") val enabledValue: Any? = null,
    @SerializedName("disabledValue") val disabledValue: Any? = null,
    /** Where enabledValue/disabledValue originate: 'environment' or 'flag' */
    @SerializedName("valueSource") val valueSource: String? = null,
    @SerializedName("version") val version: Int? = null,
    /** When true, this flag was returned in compact mode */
    @SerializedName("compact") val compact: Boolean? = null
)

// ==================== Evaluation Result ====================

/**
 * Evaluation reason constants
 */
object EvaluationReasons {
    const val ENABLED = "enabled"
    const val DISABLED = "disabled"
    const val STRATEGY_MATCH = "strategy_match"
    const val CONSTRAINT_MATCH = "constraint_match"
    const val ROLLOUT = "rollout"
    const val DEFAULT = "default"
    const val NOT_FOUND = "not_found"
    const val ERROR = "error"
}

/**
 * Value source name constants
 */
object ValueSource {
    const val FLAG_DEFAULT_ENABLED = "\$flag-default-enabled"
    const val FLAG_DEFAULT_DISABLED = "\$flag-default-disabled"
    const val ENV_DEFAULT_ENABLED = "\$env-default-enabled"
    const val ENV_DEFAULT_DISABLED = "\$env-default-disabled"
    const val MISSING = "\$missing"
    const val TYPE_MISMATCH = "\$type-mismatch"
}

/**
 * Result of a feature flag evaluation
 */
data class EvaluationResult(
    val id: String = "",
    val flagName: String = "",
    val enabled: Boolean = false,
    val variant: Variant = Variant(),
    val reason: String = ""
)

/**
 * Detailed evaluation result including the resolved typed value
 */
data class EvaluationDetail<T>(
    val flagName: String = "",
    val value: T? = null,
    val reason: String = "",
    val variantName: String? = null
)
