package com.gatrix.server.sdk.evaluation

import com.google.common.hash.Hashing
import java.nio.charset.StandardCharsets

/**
 * MurmurHash3 utility wrapper around Guava's Hashing.murmur3_32_fixed().
 * Must produce identical results to npm "murmurhash" v3 package used in @gatrix/evaluator.
 */
object MurmurHash3 {

    /**
     * Compute MurmurHash3 32-bit hash of a string with a given seed.
     * Returns unsigned 32-bit value as Long.
     */
    fun hash(key: String, seed: Int = 0): Long {
        val hashFunction = Hashing.murmur3_32_fixed(seed)
        val hashCode = hashFunction.hashString(key, StandardCharsets.UTF_8)
        // Convert to unsigned long
        return hashCode.asInt().toLong() and 0xFFFFFFFFL
    }

    /**
     * Compute a normalized hash (0-100) from stickiness key and group ID.
     * Used for rollout percentage calculation.
     */
    fun normalizedHash(stickinessKey: String, groupId: String, seed: Int = 0): Int {
        val combined = "$groupId:$stickinessKey"
        val hashValue = hash(combined, seed)
        return (hashValue % 101).toInt()
    }
}
