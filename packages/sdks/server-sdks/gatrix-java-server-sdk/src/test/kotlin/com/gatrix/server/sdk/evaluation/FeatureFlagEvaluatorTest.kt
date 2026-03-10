package com.gatrix.server.sdk.evaluation

import com.gatrix.server.sdk.models.*
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test

/**
 * Comprehensive unit tests for FeatureFlagEvaluator constraint operators.
 * Ported from @gatrix/evaluator feature-flag-evaluator.test.ts (1214 lines)
 * Tests all operators with normal and inverted cases, edge cases, and type coercion.
 */
class FeatureFlagEvaluatorTest {

    // Helper to create a minimal flag with a single constraint
    private fun createFlagWithConstraint(constraint: Constraint): FeatureFlag {
        return FeatureFlag(
            name = "test-flag",
            isEnabled = true,
            strategies = listOf(
                FeatureStrategy(
                    name = "test-strategy",
                    isEnabled = true,
                    sortOrder = 0,
                    constraints = listOf(constraint)
                )
            ),
            variants = emptyList()
        )
    }

    // Helper to evaluate a single constraint against a context
    private fun evalConstraint(constraint: Constraint, context: EvaluationContext): Boolean {
        val flag = createFlagWithConstraint(constraint)
        val result = FeatureFlagEvaluator.evaluate(flag, context, emptyMap())
        return result.enabled
    }

    // Helper to create a constraint
    private fun c(
        operator: String,
        contextName: String,
        value: String? = null,
        values: List<String>? = null,
        inverted: Boolean = false,
        caseInsensitive: Boolean = false
    ): Constraint = Constraint(
        contextName = contextName,
        operator = operator,
        value = value,
        values = values,
        inverted = inverted,
        caseInsensitive = caseInsensitive
    )

    private val defaultContext = EvaluationContext(appName = "test-app")

    // ===================== STRING OPERATORS =====================

    @Nested
    @DisplayName("String Operators")
    inner class StringOperators {

        @Nested
        @DisplayName("str_eq")
        inner class StrEq {
            @Test fun `should match equal strings`() {
                assertTrue(evalConstraint(
                    c("str_eq", "region", value = "us-east"),
                    defaultContext.copy(properties = mapOf("region" to "us-east"))
                ))
            }

            @Test fun `should not match different strings`() {
                assertFalse(evalConstraint(
                    c("str_eq", "region", value = "us-east"),
                    defaultContext.copy(properties = mapOf("region" to "eu-west"))
                ))
            }

            @Test fun `should support case insensitive`() {
                assertTrue(evalConstraint(
                    c("str_eq", "region", value = "US-EAST", caseInsensitive = true),
                    defaultContext.copy(properties = mapOf("region" to "us-east"))
                ))
            }

            @Test fun `should invert result`() {
                assertFalse(evalConstraint(
                    c("str_eq", "region", value = "us-east", inverted = true),
                    defaultContext.copy(properties = mapOf("region" to "us-east"))
                ))
            }

            @Test fun `should invert non-match (becomes true)`() {
                assertTrue(evalConstraint(
                    c("str_eq", "region", value = "us-east", inverted = true),
                    defaultContext.copy(properties = mapOf("region" to "eu-west"))
                ))
            }
        }

        @Nested
        @DisplayName("str_contains")
        inner class StrContains {
            @Test fun `should match substring`() {
                assertTrue(evalConstraint(
                    c("str_contains", "email", value = "@example.com"),
                    defaultContext.copy(properties = mapOf("email" to "user@example.com"))
                ))
            }

            @Test fun `should not match missing substring`() {
                assertFalse(evalConstraint(
                    c("str_contains", "email", value = "@example.com"),
                    defaultContext.copy(properties = mapOf("email" to "user@other.com"))
                ))
            }

            @Test fun `should support case insensitive`() {
                assertTrue(evalConstraint(
                    c("str_contains", "name", value = "ADMIN", caseInsensitive = true),
                    defaultContext.copy(properties = mapOf("name" to "SuperAdmin"))
                ))
            }

            @Test fun `should invert result`() {
                assertFalse(evalConstraint(
                    c("str_contains", "email", value = "@example.com", inverted = true),
                    defaultContext.copy(properties = mapOf("email" to "user@example.com"))
                ))
            }
        }

        @Nested
        @DisplayName("str_starts_with")
        inner class StrStartsWith {
            @Test fun `should match prefix`() {
                assertTrue(evalConstraint(
                    c("str_starts_with", "path", value = "/api/"),
                    defaultContext.copy(properties = mapOf("path" to "/api/v1/users"))
                ))
            }

            @Test fun `should not match non-prefix`() {
                assertFalse(evalConstraint(
                    c("str_starts_with", "path", value = "/api/"),
                    defaultContext.copy(properties = mapOf("path" to "/web/page"))
                ))
            }

            @Test fun `should invert result`() {
                assertFalse(evalConstraint(
                    c("str_starts_with", "path", value = "/api/", inverted = true),
                    defaultContext.copy(properties = mapOf("path" to "/api/v1/users"))
                ))
            }
        }

        @Nested
        @DisplayName("str_ends_with")
        inner class StrEndsWith {
            @Test fun `should match suffix`() {
                assertTrue(evalConstraint(
                    c("str_ends_with", "file", value = ".json"),
                    defaultContext.copy(properties = mapOf("file" to "config.json"))
                ))
            }

            @Test fun `should not match non-suffix`() {
                assertFalse(evalConstraint(
                    c("str_ends_with", "file", value = ".json"),
                    defaultContext.copy(properties = mapOf("file" to "config.yaml"))
                ))
            }
        }

        @Nested
        @DisplayName("str_in")
        inner class StrIn {
            @Test fun `should match value in list`() {
                assertTrue(evalConstraint(
                    c("str_in", "country", values = listOf("US", "CA", "MX")),
                    defaultContext.copy(properties = mapOf("country" to "CA"))
                ))
            }

            @Test fun `should not match value not in list`() {
                assertFalse(evalConstraint(
                    c("str_in", "country", values = listOf("US", "CA", "MX")),
                    defaultContext.copy(properties = mapOf("country" to "JP"))
                ))
            }

            @Test fun `should support case insensitive`() {
                assertTrue(evalConstraint(
                    c("str_in", "country", values = listOf("us", "ca"), caseInsensitive = true),
                    defaultContext.copy(properties = mapOf("country" to "US"))
                ))
            }

            @Test fun `should invert result (str_not_in equivalent)`() {
                assertFalse(evalConstraint(
                    c("str_in", "country", values = listOf("US", "CA", "MX"), inverted = true),
                    defaultContext.copy(properties = mapOf("country" to "CA"))
                ))
            }

            @Test fun `should invert result for non-member (becomes true)`() {
                assertTrue(evalConstraint(
                    c("str_in", "country", values = listOf("US", "CA", "MX"), inverted = true),
                    defaultContext.copy(properties = mapOf("country" to "JP"))
                ))
            }
        }

        @Nested
        @DisplayName("str_regex")
        inner class StrRegex {
            @Test fun `should match regex pattern`() {
                assertTrue(evalConstraint(
                    c("str_regex", "version", value = "^\\d+\\.\\d+\\.\\d+$"),
                    defaultContext.copy(properties = mapOf("version" to "1.2.3"))
                ))
            }

            @Test fun `should not match non-matching pattern`() {
                assertFalse(evalConstraint(
                    c("str_regex", "version", value = "^\\d+\\.\\d+\\.\\d+$"),
                    defaultContext.copy(properties = mapOf("version" to "v1.2.3"))
                ))
            }

            @Test fun `should handle invalid regex gracefully`() {
                assertFalse(evalConstraint(
                    c("str_regex", "value", value = "[invalid("),
                    defaultContext.copy(properties = mapOf("value" to "test"))
                ))
            }

            @Test fun `should support case insensitive flag`() {
                assertTrue(evalConstraint(
                    c("str_regex", "name", value = "^admin", caseInsensitive = true),
                    defaultContext.copy(properties = mapOf("name" to "ADMIN_USER"))
                ))
            }
        }
    }

    // ===================== NUMBER OPERATORS =====================

    @Nested
    @DisplayName("Number Operators")
    inner class NumberOperators {

        @Nested
        @DisplayName("num_eq")
        inner class NumEq {
            @Test fun `should match equal numbers`() {
                assertTrue(evalConstraint(
                    c("num_eq", "level", value = "10"),
                    defaultContext.copy(properties = mapOf("level" to 10))
                ))
            }

            @Test fun `should not match different numbers`() {
                assertFalse(evalConstraint(
                    c("num_eq", "level", value = "10"),
                    defaultContext.copy(properties = mapOf("level" to 20))
                ))
            }

            @Test fun `should handle string-to-number coercion`() {
                assertTrue(evalConstraint(
                    c("num_eq", "level", value = "10"),
                    defaultContext.copy(properties = mapOf("level" to "10"))
                ))
            }

            @Test fun `should invert result`() {
                assertFalse(evalConstraint(
                    c("num_eq", "level", value = "10", inverted = true),
                    defaultContext.copy(properties = mapOf("level" to 10))
                ))
            }
        }

        @Nested
        @DisplayName("num_gt")
        inner class NumGt {
            @Test fun `should match greater values`() {
                assertTrue(evalConstraint(
                    c("num_gt", "age", value = "18"),
                    defaultContext.copy(properties = mapOf("age" to 25))
                ))
            }

            @Test fun `should not match equal values`() {
                assertFalse(evalConstraint(
                    c("num_gt", "age", value = "18"),
                    defaultContext.copy(properties = mapOf("age" to 18))
                ))
            }

            @Test fun `should not match lesser values`() {
                assertFalse(evalConstraint(
                    c("num_gt", "age", value = "18"),
                    defaultContext.copy(properties = mapOf("age" to 10))
                ))
            }
        }

        @Nested @DisplayName("num_gte") inner class NumGte {
            @Test fun `should match equal values`() {
                assertTrue(evalConstraint(c("num_gte", "age", value = "18"), defaultContext.copy(properties = mapOf("age" to 18))))
            }
            @Test fun `should match greater values`() {
                assertTrue(evalConstraint(c("num_gte", "age", value = "18"), defaultContext.copy(properties = mapOf("age" to 25))))
            }
        }

        @Nested @DisplayName("num_lt") inner class NumLt {
            @Test fun `should match lesser values`() {
                assertTrue(evalConstraint(c("num_lt", "age", value = "18"), defaultContext.copy(properties = mapOf("age" to 10))))
            }
            @Test fun `should not match equal values`() {
                assertFalse(evalConstraint(c("num_lt", "age", value = "18"), defaultContext.copy(properties = mapOf("age" to 18))))
            }
        }

        @Nested @DisplayName("num_lte") inner class NumLte {
            @Test fun `should match equal values`() {
                assertTrue(evalConstraint(c("num_lte", "age", value = "18"), defaultContext.copy(properties = mapOf("age" to 18))))
            }
            @Test fun `should match lesser values`() {
                assertTrue(evalConstraint(c("num_lte", "age", value = "18"), defaultContext.copy(properties = mapOf("age" to 10))))
            }
        }

        @Nested @DisplayName("num_in") inner class NumIn {
            @Test fun `should match value in list`() {
                assertTrue(evalConstraint(c("num_in", "tier", values = listOf("1", "2", "3")), defaultContext.copy(properties = mapOf("tier" to 2))))
            }
            @Test fun `should not match value not in list`() {
                assertFalse(evalConstraint(c("num_in", "tier", values = listOf("1", "2", "3")), defaultContext.copy(properties = mapOf("tier" to 5))))
            }
            @Test fun `should invert result (num_not_in equivalent)`() {
                assertFalse(evalConstraint(c("num_in", "tier", values = listOf("1", "2", "3"), inverted = true), defaultContext.copy(properties = mapOf("tier" to 2))))
            }
        }
    }

    // ===================== BOOLEAN OPERATORS =====================

    @Nested
    @DisplayName("Boolean Operators")
    inner class BooleanOperators {
        @Test fun `should match true`() {
            assertTrue(evalConstraint(c("bool_is", "premium", value = "true"), defaultContext.copy(properties = mapOf("premium" to true))))
        }
        @Test fun `should match false`() {
            assertTrue(evalConstraint(c("bool_is", "premium", value = "false"), defaultContext.copy(properties = mapOf("premium" to false))))
        }
        @Test fun `should not match when different`() {
            assertFalse(evalConstraint(c("bool_is", "premium", value = "true"), defaultContext.copy(properties = mapOf("premium" to false))))
        }
        @Test fun `should invert result`() {
            assertFalse(evalConstraint(c("bool_is", "premium", value = "true", inverted = true), defaultContext.copy(properties = mapOf("premium" to true))))
        }
    }

    // ===================== DATE OPERATORS =====================

    @Nested
    @DisplayName("Date Operators")
    inner class DateOperators {
        private val testDate = "2025-06-15T12:00:00.000Z"
        private val beforeDate = "2025-06-14T12:00:00.000Z"
        private val afterDate = "2025-06-16T12:00:00.000Z"

        @Test fun `date_eq should match equal dates`() {
            assertTrue(evalConstraint(c("date_eq", "signup", value = testDate), defaultContext.copy(properties = mapOf("signup" to testDate))))
        }
        @Test fun `date_eq should not match different dates`() {
            assertFalse(evalConstraint(c("date_eq", "signup", value = testDate), defaultContext.copy(properties = mapOf("signup" to beforeDate))))
        }
        @Test fun `date_eq should invert result`() {
            assertFalse(evalConstraint(c("date_eq", "signup", value = testDate, inverted = true), defaultContext.copy(properties = mapOf("signup" to testDate))))
        }
        @Test fun `date_gt should match later dates`() {
            assertTrue(evalConstraint(c("date_gt", "signup", value = testDate), defaultContext.copy(properties = mapOf("signup" to afterDate))))
        }
        @Test fun `date_gt should not match equal dates`() {
            assertFalse(evalConstraint(c("date_gt", "signup", value = testDate), defaultContext.copy(properties = mapOf("signup" to testDate))))
        }
        @Test fun `date_gt should not match earlier dates`() {
            assertFalse(evalConstraint(c("date_gt", "signup", value = testDate), defaultContext.copy(properties = mapOf("signup" to beforeDate))))
        }
        @Test fun `date_gte should match equal dates`() {
            assertTrue(evalConstraint(c("date_gte", "signup", value = testDate), defaultContext.copy(properties = mapOf("signup" to testDate))))
        }
        @Test fun `date_gte should match later dates`() {
            assertTrue(evalConstraint(c("date_gte", "signup", value = testDate), defaultContext.copy(properties = mapOf("signup" to afterDate))))
        }
        @Test fun `date_lt should match earlier dates`() {
            assertTrue(evalConstraint(c("date_lt", "signup", value = testDate), defaultContext.copy(properties = mapOf("signup" to beforeDate))))
        }
        @Test fun `date_lt should not match equal dates`() {
            assertFalse(evalConstraint(c("date_lt", "signup", value = testDate), defaultContext.copy(properties = mapOf("signup" to testDate))))
        }
        @Test fun `date_lte should match equal dates`() {
            assertTrue(evalConstraint(c("date_lte", "signup", value = testDate), defaultContext.copy(properties = mapOf("signup" to testDate))))
        }
        @Test fun `date_lte should match earlier dates`() {
            assertTrue(evalConstraint(c("date_lte", "signup", value = testDate), defaultContext.copy(properties = mapOf("signup" to beforeDate))))
        }
    }

    // ===================== SEMVER OPERATORS =====================

    @Nested
    @DisplayName("Semver Operators")
    inner class SemverOperators {
        @Test fun `semver_eq should match equal versions`() {
            assertTrue(evalConstraint(c("semver_eq", "appVersion", value = "1.2.3"), defaultContext.copy(appVersion = "1.2.3")))
        }
        @Test fun `semver_eq should not match different versions`() {
            assertFalse(evalConstraint(c("semver_eq", "appVersion", value = "1.2.3"), defaultContext.copy(appVersion = "1.2.4")))
        }
        @Test fun `semver_gt should match greater versions`() {
            assertTrue(evalConstraint(c("semver_gt", "appVersion", value = "1.2.3"), defaultContext.copy(appVersion = "1.3.0")))
        }
        @Test fun `semver_gt should detect major version difference`() {
            assertTrue(evalConstraint(c("semver_gt", "appVersion", value = "1.2.3"), defaultContext.copy(appVersion = "2.0.0")))
        }
        @Test fun `semver_gt should not match equal versions`() {
            assertFalse(evalConstraint(c("semver_gt", "appVersion", value = "1.2.3"), defaultContext.copy(appVersion = "1.2.3")))
        }
        @Test fun `semver_gte should match equal versions`() {
            assertTrue(evalConstraint(c("semver_gte", "appVersion", value = "1.2.3"), defaultContext.copy(appVersion = "1.2.3")))
        }
        @Test fun `semver_lt should match lesser versions`() {
            assertTrue(evalConstraint(c("semver_lt", "appVersion", value = "2.0.0"), defaultContext.copy(appVersion = "1.9.9")))
        }
        @Test fun `semver_lte should match equal versions`() {
            assertTrue(evalConstraint(c("semver_lte", "appVersion", value = "1.2.3"), defaultContext.copy(appVersion = "1.2.3")))
        }
        @Test fun `semver_in should match version in list`() {
            assertTrue(evalConstraint(c("semver_in", "appVersion", values = listOf("1.0.0", "1.1.0", "1.2.0")), defaultContext.copy(appVersion = "1.1.0")))
        }
        @Test fun `semver_in should not match version not in list`() {
            assertFalse(evalConstraint(c("semver_in", "appVersion", values = listOf("1.0.0", "1.1.0", "1.2.0")), defaultContext.copy(appVersion = "2.0.0")))
        }
        @Test fun `semver_in should invert result`() {
            assertFalse(evalConstraint(c("semver_in", "appVersion", values = listOf("1.0.0", "1.1.0"), inverted = true), defaultContext.copy(appVersion = "1.1.0")))
        }
    }

    // ===================== COMMON OPERATORS (EXISTS / NOT_EXISTS) =====================

    @Nested
    @DisplayName("Common Operators")
    inner class CommonOperators {

        @Nested @DisplayName("exists") inner class Exists {
            @Test fun `should return true when property exists`() {
                assertTrue(evalConstraint(c("exists", "region"), defaultContext.copy(properties = mapOf("region" to "us-east"))))
            }
            @Test fun `should return true for empty string`() {
                assertTrue(evalConstraint(c("exists", "region"), defaultContext.copy(properties = mapOf("region" to ""))))
            }
            @Test fun `should return true for zero`() {
                assertTrue(evalConstraint(c("exists", "count"), defaultContext.copy(properties = mapOf("count" to 0))))
            }
            @Test fun `should return true for false`() {
                assertTrue(evalConstraint(c("exists", "active"), defaultContext.copy(properties = mapOf("active" to false))))
            }
            @Test fun `should return false when property does not exist`() {
                assertFalse(evalConstraint(c("exists", "region"), defaultContext.copy(properties = emptyMap())))
            }
            @Test fun `should return false for missing properties`() {
                assertFalse(evalConstraint(c("exists", "region"), defaultContext))
            }
            @Test fun `should invert result`() {
                assertFalse(evalConstraint(c("exists", "region", inverted = true), defaultContext.copy(properties = mapOf("region" to "us-east"))))
            }
            @Test fun `should work with built-in context fields`() {
                assertTrue(evalConstraint(c("exists", "userId"), defaultContext.copy(userId = "user-1")))
            }
            @Test fun `should return false for missing built-in context fields`() {
                assertFalse(evalConstraint(c("exists", "userId"), defaultContext))
            }
        }

        @Nested @DisplayName("not_exists") inner class NotExists {
            @Test fun `should return true when property does not exist`() {
                assertTrue(evalConstraint(c("not_exists", "region"), defaultContext.copy(properties = emptyMap())))
            }
            @Test fun `should return false when property exists`() {
                assertFalse(evalConstraint(c("not_exists", "region"), defaultContext.copy(properties = mapOf("region" to "us-east"))))
            }
            @Test fun `should invert result (becomes exists)`() {
                assertFalse(evalConstraint(c("not_exists", "region", inverted = true), defaultContext.copy(properties = emptyMap())))
            }
        }
    }

    // ===================== ARRAY OPERATORS =====================

    @Nested
    @DisplayName("Array Operators")
    inner class ArrayOperators {

        @Nested @DisplayName("arr_any") inner class ArrAny {
            @Test fun `should match when array includes any target value`() {
                assertTrue(evalConstraint(
                    c("arr_any", "tags", values = listOf("premium", "vip")),
                    defaultContext.copy(properties = mapOf("tags" to listOf("basic", "premium", "trial")))
                ))
            }
            @Test fun `should not match when array includes none of the target values`() {
                assertFalse(evalConstraint(
                    c("arr_any", "tags", values = listOf("premium", "vip")),
                    defaultContext.copy(properties = mapOf("tags" to listOf("basic", "trial")))
                ))
            }
            @Test fun `should handle empty arrays`() {
                assertFalse(evalConstraint(
                    c("arr_any", "tags", values = listOf("premium")),
                    defaultContext.copy(properties = mapOf("tags" to emptyList<String>()))
                ))
            }
            @Test fun `should support case insensitive`() {
                assertTrue(evalConstraint(
                    c("arr_any", "tags", values = listOf("PREMIUM"), caseInsensitive = true),
                    defaultContext.copy(properties = mapOf("tags" to listOf("basic", "premium")))
                ))
            }
            @Test fun `should invert result`() {
                assertFalse(evalConstraint(
                    c("arr_any", "tags", values = listOf("premium"), inverted = true),
                    defaultContext.copy(properties = mapOf("tags" to listOf("basic", "premium")))
                ))
            }
            @Test fun `should handle non-array values as empty arrays`() {
                assertFalse(evalConstraint(
                    c("arr_any", "tags", values = listOf("premium")),
                    defaultContext.copy(properties = mapOf("tags" to "premium"))
                ))
            }
        }

        @Nested @DisplayName("arr_all") inner class ArrAll {
            @Test fun `should match when array includes all target values`() {
                assertTrue(evalConstraint(
                    c("arr_all", "tags", values = listOf("premium", "vip")),
                    defaultContext.copy(properties = mapOf("tags" to listOf("basic", "premium", "vip")))
                ))
            }
            @Test fun `should not match when array is missing some target values`() {
                assertFalse(evalConstraint(
                    c("arr_all", "tags", values = listOf("premium", "vip")),
                    defaultContext.copy(properties = mapOf("tags" to listOf("basic", "premium")))
                ))
            }
            @Test fun `should handle empty target values`() {
                assertFalse(evalConstraint(
                    c("arr_all", "tags", values = emptyList()),
                    defaultContext.copy(properties = mapOf("tags" to listOf("basic")))
                ))
            }
            @Test fun `should support case insensitive`() {
                assertTrue(evalConstraint(
                    c("arr_all", "tags", values = listOf("PREMIUM", "VIP"), caseInsensitive = true),
                    defaultContext.copy(properties = mapOf("tags" to listOf("premium", "vip", "basic")))
                ))
            }
            @Test fun `should invert result`() {
                assertFalse(evalConstraint(
                    c("arr_all", "tags", values = listOf("premium", "vip"), inverted = true),
                    defaultContext.copy(properties = mapOf("tags" to listOf("premium", "vip")))
                ))
            }
        }

        @Nested @DisplayName("arr_empty") inner class ArrEmpty {
            @Test fun `should return true for empty array`() {
                assertTrue(evalConstraint(c("arr_empty", "tags"), defaultContext.copy(properties = mapOf("tags" to emptyList<String>()))))
            }
            @Test fun `should return false for non-empty array`() {
                assertFalse(evalConstraint(c("arr_empty", "tags"), defaultContext.copy(properties = mapOf("tags" to listOf("a")))))
            }
            @Test fun `should return true for non-array values (treated as empty)`() {
                assertTrue(evalConstraint(c("arr_empty", "tags"), defaultContext.copy(properties = mapOf("tags" to "not-array"))))
            }
            @Test fun `should return true for undefined property (treated as empty)`() {
                assertTrue(evalConstraint(c("arr_empty", "tags"), defaultContext.copy(properties = emptyMap())))
            }
            @Test fun `should invert result (arr_not_empty equivalent)`() {
                assertTrue(evalConstraint(c("arr_empty", "tags", inverted = true), defaultContext.copy(properties = mapOf("tags" to listOf("a")))))
            }
            @Test fun `should invert result for empty array`() {
                assertFalse(evalConstraint(c("arr_empty", "tags", inverted = true), defaultContext.copy(properties = mapOf("tags" to emptyList<String>()))))
            }
        }
    }

    // ===================== EDGE CASES =====================

    @Nested
    @DisplayName("Edge Cases")
    inner class EdgeCases {

        @Test fun `should return false for undefined context with normal operator`() {
            assertFalse(evalConstraint(c("str_eq", "missing_field", value = "test"), defaultContext))
        }

        @Test fun `should return true for undefined context with inverted normal operator`() {
            assertTrue(evalConstraint(c("str_eq", "missing_field", value = "test", inverted = true), defaultContext))
        }

        @Test fun `should resolve userId`() {
            assertTrue(evalConstraint(c("str_eq", "userId", value = "user-123"), defaultContext.copy(userId = "user-123")))
        }

        @Test fun `should resolve sessionId`() {
            assertTrue(evalConstraint(c("str_eq", "sessionId", value = "session-abc"), defaultContext.copy(sessionId = "session-abc")))
        }

        @Test fun `should resolve appName`() {
            assertTrue(evalConstraint(c("str_eq", "appName", value = "test-app"), defaultContext.copy(appName = "test-app")))
        }

        @Test fun `should resolve appVersion`() {
            assertTrue(evalConstraint(c("str_eq", "appVersion", value = "1.0.0"), defaultContext.copy(appVersion = "1.0.0")))
        }

        @Test fun `should resolve remoteAddress`() {
            assertTrue(evalConstraint(c("str_eq", "remoteAddress", value = "192.168.1.1"), defaultContext.copy(remoteAddress = "192.168.1.1")))
        }

        @Test fun `should return false for unknown operator`() {
            assertFalse(evalConstraint(c("unknown_op", "field", value = "test"), defaultContext.copy(properties = mapOf("field" to "test"))))
        }

        @Test fun `should require all constraints to pass (AND logic)`() {
            val flag = FeatureFlag(
                name = "test-flag",
                isEnabled = true,
                strategies = listOf(
                    FeatureStrategy(
                        name = "test-strategy",
                        isEnabled = true,
                        sortOrder = 0,
                        constraints = listOf(
                            c("str_eq", "region", value = "us-east"),
                            c("num_gte", "level", value = "10")
                        )
                    )
                ),
                variants = emptyList()
            )

            // Both match
            assertTrue(FeatureFlagEvaluator.evaluate(
                flag, defaultContext.copy(properties = mapOf("region" to "us-east", "level" to 15)), emptyMap()
            ).enabled)

            // Only one matches
            assertFalse(FeatureFlagEvaluator.evaluate(
                flag, defaultContext.copy(properties = mapOf("region" to "us-east", "level" to 5)), emptyMap()
            ).enabled)

            // Neither matches
            assertFalse(FeatureFlagEvaluator.evaluate(
                flag, defaultContext.copy(properties = mapOf("region" to "eu-west", "level" to 5)), emptyMap()
            ).enabled)
        }
    }

    // ===================== FLAG-LEVEL BEHAVIOR =====================

    @Nested
    @DisplayName("Flag-level Behavior")
    inner class FlagLevelBehavior {

        @Test fun `disabled flag should return disabled`() {
            val flag = FeatureFlag(name = "test", isEnabled = false)
            val result = FeatureFlagEvaluator.evaluate(flag, defaultContext, emptyMap())
            assertFalse(result.enabled)
            assertEquals(EvaluationReasons.DISABLED, result.reason)
        }

        @Test fun `enabled flag with no strategies should return enabled`() {
            val flag = FeatureFlag(name = "test", isEnabled = true, strategies = emptyList())
            val result = FeatureFlagEvaluator.evaluate(flag, defaultContext, emptyMap())
            assertTrue(result.enabled)
            assertEquals(EvaluationReasons.DEFAULT, result.reason)
        }

        @Test fun `enabled flag with matching strategy should return strategy_match`() {
            val flag = FeatureFlag(
                name = "test",
                isEnabled = true,
                strategies = listOf(
                    FeatureStrategy(name = "default", isEnabled = true, sortOrder = 0)
                )
            )
            val result = FeatureFlagEvaluator.evaluate(flag, defaultContext, emptyMap())
            assertTrue(result.enabled)
            assertEquals(EvaluationReasons.STRATEGY_MATCH, result.reason)
        }

        @Test fun `enabled flag with non-matching strategy should return default disabled`() {
            val flag = FeatureFlag(
                name = "test",
                isEnabled = true,
                strategies = listOf(
                    FeatureStrategy(
                        name = "restricted",
                        isEnabled = true,
                        sortOrder = 0,
                        constraints = listOf(c("str_eq", "userId", value = "special-user"))
                    )
                )
            )
            val result = FeatureFlagEvaluator.evaluate(flag, defaultContext, emptyMap())
            assertFalse(result.enabled)
            assertEquals(EvaluationReasons.DEFAULT, result.reason)
        }

        @Test fun `should evaluate segments before constraints`() {
            val segment = FeatureSegment(
                name = "beta-segment",
                constraints = listOf(c("str_eq", "userId", value = "beta-user")),
                isActive = true
            )
            val flag = FeatureFlag(
                name = "test",
                isEnabled = true,
                strategies = listOf(
                    FeatureStrategy(
                        name = "seg-strategy",
                        isEnabled = true,
                        sortOrder = 0,
                        segments = listOf("beta-segment")
                    )
                )
            )

            // With matching segment
            val result1 = FeatureFlagEvaluator.evaluate(
                flag, defaultContext.copy(userId = "beta-user"), mapOf("beta-segment" to segment)
            )
            assertTrue(result1.enabled)

            // Without matching segment
            val result2 = FeatureFlagEvaluator.evaluate(
                flag, defaultContext.copy(userId = "other-user"), mapOf("beta-segment" to segment)
            )
            assertFalse(result2.enabled)
        }

        @Test fun `getFallbackValue should coerce types correctly`() {
            // null -> type default
            assertEquals(false, FeatureFlagEvaluator.getFallbackValue(null, "boolean"))
            assertEquals(0.0, FeatureFlagEvaluator.getFallbackValue(null, "number"))
            assertEquals("", FeatureFlagEvaluator.getFallbackValue(null, "string"))

            // string coercion
            assertEquals("true", FeatureFlagEvaluator.getFallbackValue(true, "string"))

            // number coercion
            assertEquals(42.0, (FeatureFlagEvaluator.getFallbackValue("42", "number") as Number).toDouble())

            // boolean coercion
            assertEquals(true, FeatureFlagEvaluator.getFallbackValue("true", "boolean"))
            assertEquals(false, FeatureFlagEvaluator.getFallbackValue("false", "boolean"))
        }
    }
}
