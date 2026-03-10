package com.gatrix.server.sdk.cache

import com.gatrix.server.sdk.models.FeatureFlag
import com.gatrix.server.sdk.models.FeatureSegment
import java.util.concurrent.ConcurrentHashMap

/**
 * Thread-safe in-memory cache for feature flag definitions and segments.
 * Supports per-environment flag storage and per-project segment storage.
 *
 * Segments are per-project (not global) — each project has its own segment namespace.
 * Environment-to-project mapping is maintained to resolve the correct segments.
 */
class FlagDefinitionCache {

    // Per-environment flag cache: envId -> (flagName -> FeatureFlag)
    private val flagsByEnv = ConcurrentHashMap<String, ConcurrentHashMap<String, FeatureFlag>>()

    // Per-project segment cache: projectId -> (segmentName -> FeatureSegment)
    private val segmentsByProject = ConcurrentHashMap<String, ConcurrentHashMap<String, FeatureSegment>>()

    // Environment-to-project mapping: environmentId -> projectId
    private val envToProjectMap = ConcurrentHashMap<String, String>()

    /**
     * Get a flag definition by name for a specific environment
     */
    fun getFlag(flagName: String, environmentId: String): FeatureFlag? {
        return flagsByEnv[environmentId]?.get(flagName)
    }

    /**
     * Get all cached flags for a specific environment (snapshot)
     */
    fun getCached(environmentId: String): List<FeatureFlag> {
        return flagsByEnv[environmentId]?.values?.toList() ?: emptyList()
    }

    /**
     * Get segments for a specific project
     */
    fun getSegments(projectId: String): Map<String, FeatureSegment> {
        return segmentsByProject[projectId]?.let { HashMap(it) } ?: emptyMap()
    }

    /**
     * Get segments for a specific environment (resolves via env->project mapping)
     */
    fun getSegmentsForEnvironment(environmentId: String): Map<String, FeatureSegment> {
        val projectId = envToProjectMap[environmentId] ?: return emptyMap()
        return getSegments(projectId)
    }

    /**
     * Get all segments merged across all projects (fallback for backward compat)
     */
    fun getAllSegments(): Map<String, FeatureSegment> {
        val merged = HashMap<String, FeatureSegment>()
        for (segmentMap in segmentsByProject.values) {
            merged.putAll(segmentMap)
        }
        return merged
    }

    /**
     * Replace all flags atomically for a specific environment
     * and update segments for the associated project
     */
    fun update(
        flags: List<FeatureFlag>,
        newSegments: List<FeatureSegment>,
        environmentId: String,
        projectId: String? = null
    ) {
        val newFlags = ConcurrentHashMap<String, FeatureFlag>()
        for (flag in flags) {
            newFlags[flag.name] = flag
        }
        flagsByEnv[environmentId] = newFlags

        // Track environment-to-project mapping and cache segments per project
        if (projectId != null) {
            envToProjectMap[environmentId] = projectId

            val projectSegments = segmentsByProject.computeIfAbsent(projectId) { ConcurrentHashMap() }
            // Replace all segments for this project
            projectSegments.clear()
            for (segment in newSegments) {
                projectSegments[segment.name] = segment
            }
        }
    }

    /**
     * Upsert a single flag in a specific environment
     */
    fun upsertFlag(flag: FeatureFlag, environmentId: String) {
        val flags = flagsByEnv.computeIfAbsent(environmentId) { ConcurrentHashMap() }
        flags[flag.name] = flag
    }

    /**
     * Remove a single flag by name from a specific environment
     */
    fun removeFlag(flagName: String, environmentId: String) {
        flagsByEnv[environmentId]?.remove(flagName)
    }

    /**
     * Upsert a single segment for a specific project
     */
    fun upsertSegment(segment: FeatureSegment, projectId: String) {
        val segments = segmentsByProject.computeIfAbsent(projectId) { ConcurrentHashMap() }
        segments[segment.name] = segment
    }

    /**
     * Remove a single segment by name from a specific project
     */
    fun removeSegment(segmentName: String, projectId: String) {
        segmentsByProject[projectId]?.remove(segmentName)
    }

    /**
     * Remove a segment from all projects (when projectId is unknown)
     */
    fun removeSegmentFromAll(segmentName: String) {
        for (segmentMap in segmentsByProject.values) {
            segmentMap.remove(segmentName)
        }
    }

    /**
     * Get project ID for a given environment
     */
    fun getProjectId(environmentId: String): String? {
        return envToProjectMap[environmentId]
    }

    /**
     * Total number of flags across all environments
     */
    val flagCount: Int
        get() = flagsByEnv.values.sumOf { it.size }

    /**
     * Get list of cached environment IDs
     */
    fun getEnvironmentIds(): List<String> {
        return flagsByEnv.keys().toList()
    }

    /**
     * Clear all cached data
     */
    fun clear() {
        flagsByEnv.clear()
        segmentsByProject.clear()
        envToProjectMap.clear()
    }
}
