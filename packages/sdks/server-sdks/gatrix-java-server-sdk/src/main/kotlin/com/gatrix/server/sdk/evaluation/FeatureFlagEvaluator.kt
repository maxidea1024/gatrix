package com.gatrix.server.sdk.evaluation

import com.gatrix.server.sdk.models.*
import java.text.SimpleDateFormat
import java.util.TimeZone

/**
 * Feature Flag Evaluator
 * Central evaluation logic - Kotlin port of @gatrix/evaluator
 *
 * Key design decisions:
 * - isArchived is NOT checked here. It is a management-only field.
 * - Segment constraints are evaluated BEFORE strategy constraints.
 * - isActive on segments is for UI display only, not for evaluation.
 */
object FeatureFlagEvaluator {

    /**
     * Evaluate a single flag
     */
    fun evaluate(
        flag: FeatureFlag,
        context: EvaluationContext,
        segmentsMap: Map<String, FeatureSegment>
    ): EvaluationResult {
        var reason = EvaluationReasons.DISABLED

        if (flag.isEnabled) {
            val activeStrategies = flag.strategies?.filter { it.isEnabled } ?: emptyList()

            if (activeStrategies.isNotEmpty()) {
                for (strategy in activeStrategies) {
                    if (evaluateStrategy(strategy, context, flag, segmentsMap)) {
                        val variantData = selectVariant(flag, context, strategy)
                        val defaultEnabledName = if (flag.valueSource == "environment") {
                            ValueSource.ENV_DEFAULT_ENABLED
                        } else {
                            ValueSource.FLAG_DEFAULT_ENABLED
                        }
                        val variant = Variant(
                            name = variantData?.name ?: defaultEnabledName,
                            weight = variantData?.weight ?: 100,
                            value = getFallbackValue(variantData?.value ?: flag.enabledValue, flag.valueType),
                            enabled = true
                        )

                        return EvaluationResult(
                            id = flag.id,
                            flagName = flag.name,
                            enabled = true,
                            reason = EvaluationReasons.STRATEGY_MATCH,
                            variant = variant
                        )
                    }
                }
                // Strategies exist but none matched
                reason = EvaluationReasons.DEFAULT
            } else {
                // No strategies or all disabled - enabled by default
                val variantData = selectVariant(flag, context, null)
                val defaultEnabledName = if (flag.valueSource == "environment") {
                    ValueSource.ENV_DEFAULT_ENABLED
                } else {
                    ValueSource.FLAG_DEFAULT_ENABLED
                }
                val variant = Variant(
                    name = variantData?.name ?: defaultEnabledName,
                    weight = variantData?.weight ?: 100,
                    value = getFallbackValue(variantData?.value ?: flag.enabledValue, flag.valueType),
                    enabled = true
                )

                return EvaluationResult(
                    id = flag.id,
                    flagName = flag.name,
                    enabled = true,
                    reason = EvaluationReasons.DEFAULT,
                    variant = variant
                )
            }
        }

        // Disabled or no strategy matched
        val defaultDisabledName = if (flag.valueSource == "environment") {
            ValueSource.ENV_DEFAULT_DISABLED
        } else {
            ValueSource.FLAG_DEFAULT_DISABLED
        }
        return EvaluationResult(
            id = flag.id,
            flagName = flag.name,
            enabled = false,
            reason = reason,
            variant = Variant(
                name = defaultDisabledName,
                weight = 100,
                value = getFallbackValue(flag.disabledValue, flag.valueType),
                enabled = false
            )
        )
    }

    /**
     * Evaluate a single strategy
     * Order: segments -> constraints -> rollout
     */
    private fun evaluateStrategy(
        strategy: FeatureStrategy,
        context: EvaluationContext,
        flag: FeatureFlag,
        segmentsMap: Map<String, FeatureSegment>
    ): Boolean {
        // 1. Check segment constraints (all referenced segments must pass)
        val segments = strategy.segments
        if (!segments.isNullOrEmpty()) {
            for (segmentName in segments) {
                val segment = segmentsMap[segmentName] ?: continue
                // isActive is for UI display only, not for evaluation
                if (segment.constraints.isNotEmpty()) {
                    val segmentPass = segment.constraints.all { evaluateConstraint(it, context) }
                    if (!segmentPass) return false
                }
            }
        }

        // 2. Check strategy constraints
        val constraints = strategy.constraints
        if (!constraints.isNullOrEmpty()) {
            val allConstraintsPass = constraints.all { evaluateConstraint(it, context) }
            if (!allConstraintsPass) return false
        }

        // 3. Check rollout percentage
        val rollout = strategy.parameters?.rollout ?: 100
        if (rollout < 100) {
            val stickiness = strategy.parameters?.stickiness ?: "default"
            val groupId = strategy.parameters?.groupId ?: flag.name
            val percentage = calculatePercentage(context, stickiness, groupId)
            if (percentage > rollout) return false
        }

        return true
    }

    /**
     * Evaluate a single constraint against the evaluation context
     */
    internal fun evaluateConstraint(
        constraint: Constraint,
        context: EvaluationContext
    ): Boolean {
        val contextValue = getContextValue(constraint.contextName, context)

        // Handle exists/not_exists BEFORE undefined check
        if (constraint.operator == "exists") {
            val result = contextValue != null
            return if (constraint.inverted) !result else result
        }
        if (constraint.operator == "not_exists") {
            val result = contextValue == null
            return if (constraint.inverted) !result else result
        }

        // Handle arr_empty BEFORE undefined check (undefined is considered empty)
        if (constraint.operator == "arr_empty") {
            val result = when (contextValue) {
                null -> true
                is List<*> -> contextValue.isEmpty()
                else -> true // Non-array values are treated as empty
            }
            return if (constraint.inverted) !result else result
        }

        if (contextValue == null) {
            return if (constraint.inverted) true else false
        }

        // Array operators
        if (constraint.operator == "arr_any" || constraint.operator == "arr_all") {
            val arr = if (contextValue is List<*>) {
                contextValue.map { it.toString() }
            } else {
                emptyList()
            }
            val targetValues = constraint.values?.map {
                if (constraint.caseInsensitive) it.lowercase() else it
            } ?: emptyList()
            val compareArr = if (constraint.caseInsensitive) {
                arr.map { it.lowercase() }
            } else {
                arr
            }

            val result = if (constraint.operator == "arr_any") {
                // At least one target value is in the array
                targetValues.any { tv -> compareArr.contains(tv) }
            } else {
                // All target values are in the array
                targetValues.isNotEmpty() && targetValues.all { tv -> compareArr.contains(tv) }
            }
            return if (constraint.inverted) !result else result
        }

        val stringValue = contextValue.toString()
        val compareValue = if (constraint.caseInsensitive) stringValue.lowercase() else stringValue
        val targetValue = if (constraint.caseInsensitive) {
            (constraint.value ?: "").lowercase()
        } else {
            constraint.value ?: ""
        }
        val targetValues = constraint.values?.map {
            if (constraint.caseInsensitive) it.lowercase() else it
        } ?: emptyList()

        val result = when (constraint.operator) {
            // String operators
            "str_eq" -> compareValue == targetValue
            "str_contains" -> compareValue.contains(targetValue)
            "str_starts_with" -> compareValue.startsWith(targetValue)
            "str_ends_with" -> compareValue.endsWith(targetValue)
            "str_in" -> targetValues.contains(compareValue)
            "str_regex" -> {
                try {
                    val options = if (constraint.caseInsensitive) {
                        setOf(RegexOption.IGNORE_CASE)
                    } else {
                        emptySet()
                    }
                    val regex = Regex(constraint.value ?: "", options)
                    regex.containsMatchIn(stringValue)
                } catch (_: Exception) {
                    false
                }
            }

            // Number operators
            "num_eq" -> toDouble(contextValue) == toDouble(constraint.value)
            "num_gt" -> toDouble(contextValue) > toDouble(constraint.value)
            "num_gte" -> toDouble(contextValue) >= toDouble(constraint.value)
            "num_lt" -> toDouble(contextValue) < toDouble(constraint.value)
            "num_lte" -> toDouble(contextValue) <= toDouble(constraint.value)
            "num_in" -> {
                val numValue = toDouble(contextValue)
                targetValues.any { toDouble(it) == numValue }
            }

            // Boolean operators
            "bool_is" -> {
                val boolValue = toBool(contextValue)
                boolValue == (constraint.value == "true")
            }

            // Date operators
            "date_eq" -> parseDate(stringValue) == parseDate(targetValue)
            "date_gt" -> {
                val d1 = parseDate(stringValue)
                val d2 = parseDate(targetValue)
                d1 != null && d2 != null && d1 > d2
            }
            "date_gte" -> {
                val d1 = parseDate(stringValue)
                val d2 = parseDate(targetValue)
                d1 != null && d2 != null && d1 >= d2
            }
            "date_lt" -> {
                val d1 = parseDate(stringValue)
                val d2 = parseDate(targetValue)
                d1 != null && d2 != null && d1 < d2
            }
            "date_lte" -> {
                val d1 = parseDate(stringValue)
                val d2 = parseDate(targetValue)
                d1 != null && d2 != null && d1 <= d2
            }

            // Semver operators
            "semver_eq" -> compareSemver(stringValue, targetValue) == 0
            "semver_gt" -> compareSemver(stringValue, targetValue) > 0
            "semver_gte" -> compareSemver(stringValue, targetValue) >= 0
            "semver_lt" -> compareSemver(stringValue, targetValue) < 0
            "semver_lte" -> compareSemver(stringValue, targetValue) <= 0
            "semver_in" -> targetValues.any { compareSemver(stringValue, it) == 0 }

            else -> false
        }

        return if (constraint.inverted) !result else result
    }

    /**
     * Extract context value by field name
     */
    internal fun getContextValue(name: String, context: EvaluationContext): Any? {
        return when (name) {
            "userId" -> context.userId
            "sessionId" -> context.sessionId
            "appName" -> context.appName
            "appVersion" -> context.appVersion
            "remoteAddress" -> context.remoteAddress
            "environment" -> context.environment
            "currentTime" -> context.currentTime?.let {
                val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")
                sdf.timeZone = TimeZone.getTimeZone("UTC")
                sdf.format(it)
            }
            else -> context.properties[name]
        }
    }

    /**
     * Calculate sticky rollout percentage using MurmurHash3
     * Must produce identical results to @gatrix/evaluator calculatePercentage()
     */
    internal fun calculatePercentage(
        context: EvaluationContext,
        stickiness: String,
        groupId: String
    ): Double {
        val stickinessValue = when (stickiness) {
            "default", "userId" -> context.userId ?: context.sessionId ?: Math.random().toString()
            "sessionId" -> context.sessionId ?: Math.random().toString()
            "random" -> Math.random().toString()
            else -> (getContextValue(stickiness, context) ?: Math.random()).toString()
        }

        val seed = "$groupId:$stickinessValue"
        val hash = MurmurHash3.hash(seed)
        return (hash % 10000).toDouble() / 100.0
    }

    /**
     * Ensure a value matches the declared valueType.
     * If the value is null/undefined, returns a type-appropriate default.
     * If the value exists but has wrong type, coerces it to match.
     */
    fun getFallbackValue(value: Any?, valueType: String?): Any? {
        if (value == null) {
            return when (valueType) {
                "boolean" -> false
                "number" -> 0.0
                "json" -> emptyMap<String, Any>()
                "string" -> ""
                else -> ""
            }
        }

        // Coerce to match declared valueType
        return when (valueType) {
            "string" -> if (value is String) value else value.toString()
            "number" -> {
                if (value is Number) value
                else {
                    val num = value.toString().toDoubleOrNull()
                    num ?: 0.0
                }
            }
            "boolean" -> {
                when (value) {
                    is Boolean -> value
                    "true", 1, 1.0 -> true
                    "false", 0, 0.0 -> false
                    else -> value.toString().toBoolean()
                }
            }
            "json" -> {
                if (value is Map<*, *>) value
                else {
                    try {
                        com.google.gson.Gson().fromJson(value.toString(), Map::class.java) ?: emptyMap<String, Any>()
                    } catch (_: Exception) {
                        emptyMap<String, Any>()
                    }
                }
            }
            else -> value
        }
    }

    /**
     * Select variant based on weighted distribution
     */
    private fun selectVariant(
        flag: FeatureFlag,
        context: EvaluationContext,
        matchedStrategy: FeatureStrategy?
    ): Variant? {
        val variants = flag.variants
        if (variants.isNullOrEmpty()) return null

        val totalWeight = variants.sumOf { it.weight }
        if (totalWeight <= 0) return null

        val stickiness = matchedStrategy?.parameters?.stickiness ?: "default"
        val percentage = calculatePercentage(context, stickiness, "${flag.name}-variant")
        val targetWeight = (percentage / 100.0) * totalWeight

        var cumulativeWeight = 0
        for (variant in variants) {
            cumulativeWeight += variant.weight
            if (targetWeight <= cumulativeWeight) return variant
        }
        return variants.last()
    }

    /**
     * Compare two semver strings
     */
    internal fun compareSemver(a: String, b: String): Int {
        val aParts = parseSemver(a)
        val bParts = parseSemver(b)
        val maxLen = maxOf(aParts.size, bParts.size)

        for (i in 0 until maxLen) {
            val aVal = aParts.getOrElse(i) { 0 }
            val bVal = bParts.getOrElse(i) { 0 }
            if (aVal < bVal) return -1
            if (aVal > bVal) return 1
        }
        return 0
    }

    private fun parseSemver(v: String): List<Int> {
        val cleaned = v.removePrefix("v")
        return cleaned.split(".").map { it.toIntOrNull() ?: 0 }
    }

    private fun toDouble(value: Any?): Double {
        return when (value) {
            null -> 0.0
            is Number -> value.toDouble()
            is String -> value.toDoubleOrNull() ?: 0.0
            else -> value.toString().toDoubleOrNull() ?: 0.0
        }
    }

    private fun toBool(value: Any?): Boolean {
        return when (value) {
            is Boolean -> value
            is Number -> value.toDouble() != 0.0
            "true" -> true
            "false" -> false
            else -> false
        }
    }

    private fun parseDate(value: String): Long? {
        return try {
            // Try ISO 8601 format
            val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")
            sdf.timeZone = TimeZone.getTimeZone("UTC")
            sdf.parse(value)?.time
        } catch (_: Exception) {
            try {
                // Try without millis
                val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'")
                sdf.timeZone = TimeZone.getTimeZone("UTC")
                sdf.parse(value)?.time
            } catch (_: Exception) {
                try {
                    // Try with timezone offset
                    val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX")
                    sdf.parse(value)?.time
                } catch (_: Exception) {
                    null
                }
            }
        }
    }
}
