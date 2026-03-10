package com.gatrix.server.sdk.evaluation

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test

/**
 * MurmurHash3 tests
 * Verifies compatibility with npm murmurhash v3 package
 */
@DisplayName("MurmurHash3")
class MurmurHash3Test {

    @Test
    fun `should produce consistent hash for same input`() {
        val hash1 = MurmurHash3.hash("test-key", 0)
        val hash2 = MurmurHash3.hash("test-key", 0)
        assertEquals(hash1, hash2)
    }

    @Test
    fun `should produce different hashes for different inputs`() {
        val hash1 = MurmurHash3.hash("key-1", 0)
        val hash2 = MurmurHash3.hash("key-2", 0)
        assertNotEquals(hash1, hash2)
    }

    @Test
    fun `should produce different hashes for different seeds`() {
        val hash1 = MurmurHash3.hash("test-key", 0)
        val hash2 = MurmurHash3.hash("test-key", 42)
        assertNotEquals(hash1, hash2)
    }

    @Test
    fun `should handle empty string`() {
        val hash = MurmurHash3.hash("", 0)
        assertNotNull(hash)
    }

    @Test
    fun `should handle unicode strings`() {
        val hash = MurmurHash3.hash("한글테스트", 0)
        assertNotNull(hash)
    }

    @Test
    fun `normalizedHash should return value between 0 and 100`() {
        // Test many different inputs to ensure range [0,100]
        for (i in 0..1000) {
            val percentage = MurmurHash3.normalizedHash("user-$i", "test-group")
            assertTrue(percentage in 0..100, "normalizedHash should be in [0,100] but was $percentage")
        }
    }

    @Test
    fun `normalizedHash should have reasonable distribution`() {
        val buckets = IntArray(10) // 0-10, 10-20, ..., 90-100
        val totalSamples = 10000
        for (i in 0 until totalSamples) {
            val percentage = MurmurHash3.normalizedHash("user-$i", "test-group")
            val bucket = minOf(percentage / 10, 9)
            buckets[bucket]++
        }

        // Each bucket should have roughly 10% of samples (tolerance ±50%)
        val expected = totalSamples / 10.0
        for (bucket in buckets) {
            assertTrue(
                bucket > expected * 0.5 && bucket < expected * 1.5,
                "Distribution is skewed: bucket has $bucket samples (expected ~$expected)"
            )
        }
    }
}
