// FeaturesClientTests - Unit tests for FeaturesClient variation logic
//
// Validates type conversion, missing flag handling, and variation details.
// Note: This focuses on the logic in *Internal methods implemented via IVariationProvider.

using System.Collections.Generic;
using System.Net.Http;
using NUnit.Framework;

namespace Gatrix.Unity.SDK.Tests
{
    [TestFixture]
    public class FeaturesClientTests
    {
        private FeaturesClient _client;
        private GatrixEventEmitter _emitter;
        private GatrixClientConfig _config;

        [SetUp]
        public void SetUp()
        {
            _emitter = new GatrixEventEmitter();
            _config = new GatrixClientConfig
            {
                ApiUrl = "http://localhost",
                ApiToken = "token",
                AppName = "test-app",
                Environment = "test"
            };
            // FeaturesClient normally needs HttpClient, but for logic tests we can pass one
            // or we might need to expose a way to inject flags for testing.
            _client = new FeaturesClient(_emitter, _config, new HttpClient());
        }

        // Helper to inject flags into the client's internal cache for testing
        private void InjectFlags(List<EvaluatedFlag> flags)
        {
            // Use reflection or a test-only internal method if available. 
            // In this refactor, we can use SetFlags which is private, so we might need 
            // to make it internal for testing or use a workaround.
            // For now, let's assume we can access it or use a private reflection helper.
            var method = typeof(FeaturesClient).GetMethod("SetFlags", 
                System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
            method.Invoke(_client, new object[] { flags, true });
        }

        // ==================== IsEnabledInternal ====================

        [Test]
        public void IsEnabledInternal_FlagExistsAndEnabled_ReturnsTrue()
        {
            InjectFlags(new List<EvaluatedFlag> {
                new EvaluatedFlag { Name = "f1", Enabled = true }
            });

            Assert.IsTrue(_client.IsEnabledInternal("f1"));
        }

        [Test]
        public void IsEnabledInternal_FlagExistsAndDisabled_ReturnsFalse()
        {
            InjectFlags(new List<EvaluatedFlag> {
                new EvaluatedFlag { Name = "f1", Enabled = false }
            });

            Assert.IsFalse(_client.IsEnabledInternal("f1"));
        }

        [Test]
        public void IsEnabledInternal_FlagMissing_ReturnsFalse()
        {
            Assert.IsFalse(_client.IsEnabledInternal("non-existent"));
        }

        // ==================== BoolVariationInternal ====================

        [Test]
        public void BoolVariationInternal_ReturnsCorrectValue()
        {
            InjectFlags(new List<EvaluatedFlag> {
                new EvaluatedFlag { 
                    Name = "b1", 
                    ValueType = ValueType.Boolean, 
                    Variant = new Variant { Value = true } 
                },
                new EvaluatedFlag { 
                    Name = "b2", 
                    ValueType = ValueType.Boolean, 
                    Variant = new Variant { Value = false } 
                }
            });

            Assert.IsTrue(_client.BoolVariationInternal("b1", false));
            Assert.IsFalse(_client.BoolVariationInternal("b2", true));
        }

        [Test]
        public void BoolVariationInternal_TypeMismatch_ReturnsMissingValue()
        {
            InjectFlags(new List<EvaluatedFlag> {
                new EvaluatedFlag { 
                    Name = "not-bool", 
                    ValueType = ValueType.String, 
                    Variant = new Variant { Value = "true" } 
                }
            });

            Assert.IsFalse(_client.BoolVariationInternal("not-bool", false));
        }

        [Test]
        public void BoolVariationInternal_FromString_ReturnsTypedValue()
        {
            InjectFlags(new List<EvaluatedFlag> {
                new EvaluatedFlag { 
                    Name = "s-bool", 
                    ValueType = ValueType.Boolean, 
                    Variant = new Variant { Value = "true" } 
                }
            });

            Assert.IsTrue(_client.BoolVariationInternal("s-bool", false));
        }

        // ==================== Number Variations ====================

        [Test]
        public void IntVariationInternal_ReturnsCorrectValue()
        {
            InjectFlags(new List<EvaluatedFlag> {
                new EvaluatedFlag { 
                    Name = "i1", 
                    ValueType = ValueType.Number, 
                    Variant = new Variant { Value = 42 } 
                }
            });

            Assert.AreEqual(42, _client.IntVariationInternal("i1", 0));
        }

        [Test]
        public void DoubleVariationInternal_FromDecimalString_ReturnsCorrectValue()
        {
            InjectFlags(new List<EvaluatedFlag> {
                new EvaluatedFlag { 
                    Name = "d1", 
                    ValueType = ValueType.Number, 
                    Variant = new Variant { Value = "3.14" } 
                }
            });

            Assert.AreEqual(3.14, _client.DoubleVariationInternal("d1", 0.0), 0.001);
        }

        // ==================== Json Variations ====================

        [Test]
        public void JsonVariationInternal_FromDictionary_ReturnsDirectly()
        {
            var dict = new Dictionary<string, object> { { "key", "value" } };
            InjectFlags(new List<EvaluatedFlag> {
                new EvaluatedFlag { 
                    Name = "j1", 
                    ValueType = ValueType.Json, 
                    Variant = new Variant { Value = dict } 
                }
            });

            var result = _client.JsonVariationInternal("j1", null);
            Assert.AreSame(dict, result);
        }

        [Test]
        public void JsonVariationInternal_FromString_ParsesJson()
        {
            InjectFlags(new List<EvaluatedFlag> {
                new EvaluatedFlag { 
                    Name = "j2", 
                    ValueType = ValueType.Json, 
                    Variant = new Variant { Value = "{\"foo\": 123}" } 
                }
            });

            var result = _client.JsonVariationInternal("j2", null);
            Assert.IsNotNull(result);
            Assert.AreEqual(123, System.Convert.ToInt32(result["foo"]));
        }

        // ==================== OrThrow Variations ====================

        [Test]
        public void BoolVariationOrThrowInternal_FlagMissing_ThrowsException()
        {
            Assert.Throws<GatrixFeatureException>(() => {
                _client.BoolVariationOrThrowInternal("missing");
            });
        }

        [Test]
        public void BoolVariationOrThrowInternal_TypeMismatch_ThrowsException()
        {
            InjectFlags(new List<EvaluatedFlag> {
                new EvaluatedFlag { 
                    Name = "wrong-type", 
                    ValueType = ValueType.String, 
                    Variant = new Variant { Value = "not-a-bool" } 
                }
            });

            Assert.Throws<GatrixFeatureException>(() => {
                _client.BoolVariationOrThrowInternal("wrong-type");
            });
        }

        // ==================== Variation Details ====================

        [Test]
        public void BoolVariationDetailsInternal_FlagMissing_ReturnsReason()
        {
            var details = _client.BoolVariationDetailsInternal("missing", true);

            Assert.IsTrue(details.Value); // missingValue
            Assert.AreEqual("flag_not_found", details.Reason);
            Assert.IsFalse(details.FlagExists);
        }

        [Test]
        public void StringVariationDetailsInternal_TypeMismatch_ReturnsReason()
        {
            InjectFlags(new List<EvaluatedFlag> {
                new EvaluatedFlag { 
                    Name = "f1", 
                    ValueType = ValueType.Boolean, 
                    Variant = new Variant { Value = true } 
                }
            });

            var details = _client.StringVariationDetailsInternal("f1", "fallback");

            Assert.AreEqual("fallback", details.Value);
            Assert.IsTrue(details.Reason.Contains("type_mismatch"));
            Assert.IsTrue(details.FlagExists);
        }
    }
}
