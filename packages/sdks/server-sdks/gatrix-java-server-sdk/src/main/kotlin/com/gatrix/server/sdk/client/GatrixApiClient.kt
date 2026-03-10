package com.gatrix.server.sdk.client

import com.gatrix.server.sdk.config.RetryConfig
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.slf4j.LoggerFactory
import java.io.IOException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit

/**
 * HTTP API Client for Gatrix backend
 * Handles authentication, standard headers, ETag optimization, and retry with exponential backoff
 */
class GatrixApiClient(
    private val baseUrl: String,
    private val apiToken: String,
    private val applicationName: String,
    private val sdkVersion: String = "1.0.0",
    private val retryConfig: RetryConfig = RetryConfig(),
    private val httpClient: OkHttpClient = createDefaultClient()
) {
    private val logger = LoggerFactory.getLogger(GatrixApiClient::class.java)
    private val gson = Gson()

    // ETag cache: endpoint -> (etag, cached response body)
    private val etagCache = ConcurrentHashMap<String, Pair<String, Any?>>()

    // Connection recovery callbacks
    private val connectionRecoveryCallbacks = mutableListOf<() -> Unit>()
    private var consecutiveFailures = 0

    companion object {
        private fun createDefaultClient(): OkHttpClient {
            return OkHttpClient.Builder()
                .connectTimeout(10, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .writeTimeout(30, TimeUnit.SECONDS)
                .build()
        }
    }

    /**
     * GET request with retry and ETag support
     */
    fun <T> get(endpoint: String, typeToken: TypeToken<T>): ApiResult<T> {
        return executeWithRetry("GET", endpoint) {
            val requestBuilder = Request.Builder()
                .url("$baseUrl$endpoint")
                .get()
            addStandardHeaders(requestBuilder)
            addEtagHeader(requestBuilder, endpoint)

            val response = httpClient.newCall(requestBuilder.build()).execute()

            // Handle 304 Not Modified
            if (response.code == 304) {
                val cached = etagCache[endpoint]
                if (cached != null) {
                    @Suppress("UNCHECKED_CAST")
                    return@executeWithRetry ApiResult(
                        success = true,
                        data = cached.second as? T,
                        statusCode = 304
                    )
                }
            }

            handleResponse(response, endpoint, typeToken)
        }
    }

    /**
     * POST request with retry
     */
    fun <T> post(endpoint: String, body: Any?, typeToken: TypeToken<T>): ApiResult<T> {
        return executeWithRetry("POST", endpoint) {
            val jsonBody = gson.toJson(body)
            val requestBuilder = Request.Builder()
                .url("$baseUrl$endpoint")
                .post(jsonBody.toRequestBody("application/json".toMediaType()))
            addStandardHeaders(requestBuilder)

            val response = httpClient.newCall(requestBuilder.build()).execute()
            handleResponse(response, endpoint, typeToken)
        }
    }

    /**
     * Invalidate ETag cache for an endpoint (force fresh fetch)
     */
    fun invalidateEtagCache(endpoint: String) {
        etagCache.remove(endpoint)
    }

    /**
     * Set ETag cache entry (for restoring from local storage)
     */
    fun setCache(endpoint: String, etag: String, body: Any?) {
        etagCache[endpoint] = Pair(etag, body)
    }

    /**
     * Get current ETag for an endpoint
     */
    fun getEtag(endpoint: String): String? {
        return etagCache[endpoint]?.first
    }

    /**
     * Register a callback for connection recovery events
     */
    fun onConnectionRecovered(callback: () -> Unit): () -> Unit {
        connectionRecoveryCallbacks.add(callback)
        return { connectionRecoveryCallbacks.remove(callback) }
    }

    private fun addStandardHeaders(builder: Request.Builder) {
        builder.addHeader("X-API-Token", apiToken)
        builder.addHeader("X-Application-Name", applicationName)
        builder.addHeader("X-SDK-Version", "gatrix-java-server-sdk/$sdkVersion")
        builder.addHeader("Accept", "application/json")
    }

    private fun addEtagHeader(builder: Request.Builder, endpoint: String) {
        val cached = etagCache[endpoint]
        if (cached != null) {
            builder.addHeader("If-None-Match", cached.first)
        }
    }

    private fun <T> handleResponse(
        response: Response,
        endpoint: String,
        typeToken: TypeToken<T>
    ): ApiResult<T> {
        val body = response.body?.string()

        if (!response.isSuccessful) {
            return ApiResult(
                success = false,
                statusCode = response.code,
                error = "HTTP ${response.code}: ${body ?: response.message}"
            )
        }

        // Cache ETag if present
        val etag = response.header("ETag")

        return try {
            val data = gson.fromJson<T>(body, typeToken.type)

            // Update ETag cache
            if (etag != null && data != null) {
                etagCache[endpoint] = Pair(etag, data)
            }

            ApiResult(success = true, data = data, statusCode = response.code)
        } catch (e: Exception) {
            ApiResult(
                success = false,
                statusCode = response.code,
                error = "Failed to parse response: ${e.message}"
            )
        }
    }

    private fun <T> executeWithRetry(
        method: String,
        endpoint: String,
        block: () -> ApiResult<T>
    ): ApiResult<T> {
        var lastError: String? = null
        val maxRetries = if (retryConfig.enabled) retryConfig.maxRetries else 0

        for (attempt in 0..maxRetries) {
            try {
                val result = block()

                if (result.success || result.statusCode == 304) {
                    // Mark connection recovery if we had consecutive failures
                    if (consecutiveFailures > 0) {
                        consecutiveFailures = 0
                        notifyConnectionRecovered()
                    }
                    return result
                }

                // Check if status code is retryable
                if (!retryConfig.retryableStatusCodes.contains(result.statusCode)) {
                    return result
                }

                lastError = result.error
                consecutiveFailures++
            } catch (e: IOException) {
                lastError = e.message ?: "Network error"
                consecutiveFailures++
                logger.warn("$method $endpoint failed (attempt ${attempt + 1}): ${e.message}")
            }

            // Wait before retry (exponential backoff)
            if (attempt < maxRetries) {
                val delay = minOf(
                    (retryConfig.retryDelay * Math.pow(retryConfig.retryDelayMultiplier, attempt.toDouble())).toLong(),
                    retryConfig.maxRetryDelay
                )
                logger.debug("Retrying in ${delay}ms (attempt ${attempt + 1}/$maxRetries)")
                Thread.sleep(delay)
            }
        }

        return ApiResult(success = false, error = lastError ?: "Max retries exceeded")
    }

    private fun notifyConnectionRecovered() {
        logger.info("Connection recovered after $consecutiveFailures failures")
        for (callback in connectionRecoveryCallbacks) {
            try {
                callback()
            } catch (e: Exception) {
                logger.error("Error in connection recovery callback", e)
            }
        }
    }

    fun close() {
        httpClient.dispatcher.executorService.shutdown()
        httpClient.connectionPool.evictAll()
    }
}

/**
 * Result of an API call
 */
data class ApiResult<T>(
    val success: Boolean,
    val data: T? = null,
    val statusCode: Int = 0,
    val error: String? = null
)
