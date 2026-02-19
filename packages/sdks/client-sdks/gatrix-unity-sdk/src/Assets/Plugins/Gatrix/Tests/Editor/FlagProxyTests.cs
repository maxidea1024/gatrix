// FlagProxyTests - Unit tests for FlagProxy (thin shell delegation)
//
// Validates that FlagProxy correctly delegates all operations to IVariationProvider
// and returns EvaluatedFlag metadata directly.

using System.Collections.Generic;
using NUnit.Framework;

namespace Gatrix.Unity.SDK.Tests
{
    /// <summary>
    /// Mock IVariationProvider to verify FlagProxy delegation behavior.
    /// Records which methods are called and returns predefined responses.
    /// </summary>
    public class MockVariationProvider : IVariationProvider
    {
        // Track which methods were called
        public string LastMethodCalled { get; private set; }
        public string LastFlagName { get; private set; }

        // Configurable return values
        public bool IsEnabledResult { get; set; }
        public Variant GetVariantResult { get; set; }
        public string VariationResult { get; set; }
        public bool BoolVariationResult { get; set; }
        public string StringVariationResult { get; set; }
        public int IntVariationResult { get; set; }
        public float FloatVariationResult { get; set; }
        public double DoubleVariationResult { get; set; }
        public Dictionary<string, object> JsonVariationResult { get; set; }

        public bool BoolOrThrowResult { get; set; }
        public string StringOrThrowResult { get; set; }
        public int IntOrThrowResult { get; set; }
        public float FloatOrThrowResult { get; set; }
        public double DoubleOrThrowResult { get; set; }
        public Dictionary<string, object> JsonOrThrowResult { get; set; }

        public VariationResult<bool> BoolDetailsResult { get; set; }
        public VariationResult<string> StringDetailsResult { get; set; }
        public VariationResult<int> IntDetailsResult { get; set; }
        public VariationResult<float> FloatDetailsResult { get; set; }
        public VariationResult<double> DoubleDetailsResult { get; set; }
        public VariationResult<Dictionary<string, object>> JsonDetailsResult { get; set; }

        private void Record(string method, string flagName)
        {
            LastMethodCalled = method;
            LastFlagName = flagName;
        }

        // IVariationProvider implementation
        public bool IsEnabledInternal(string flagName, bool forceRealtime = false) { Record("IsEnabledInternal", flagName); return IsEnabledResult; }
        public Variant GetVariantInternal(string flagName, bool forceRealtime = false) { Record("GetVariantInternal", flagName); return GetVariantResult; }
        public string VariationInternal(string flagName, string fallbackValue, bool forceRealtime = false) { Record("VariationInternal", flagName); return VariationResult ?? fallbackValue; }
        public bool BoolVariationInternal(string flagName, bool fallbackValue, bool forceRealtime = false) { Record("BoolVariationInternal", flagName); return BoolVariationResult; }
        public string StringVariationInternal(string flagName, string fallbackValue, bool forceRealtime = false) { Record("StringVariationInternal", flagName); return StringVariationResult ?? fallbackValue; }
        public int IntVariationInternal(string flagName, int fallbackValue, bool forceRealtime = false) { Record("IntVariationInternal", flagName); return IntVariationResult; }
        public float FloatVariationInternal(string flagName, float fallbackValue, bool forceRealtime = false) { Record("FloatVariationInternal", flagName); return FloatVariationResult; }
        public double DoubleVariationInternal(string flagName, double fallbackValue, bool forceRealtime = false) { Record("DoubleVariationInternal", flagName); return DoubleVariationResult; }
        public Dictionary<string, object> JsonVariationInternal(string flagName, Dictionary<string, object> fallbackValue, bool forceRealtime = false) { Record("JsonVariationInternal", flagName); return JsonVariationResult ?? fallbackValue; }

        public bool BoolVariationOrThrowInternal(string flagName, bool forceRealtime = false) { Record("BoolVariationOrThrowInternal", flagName); return BoolOrThrowResult; }
        public string StringVariationOrThrowInternal(string flagName, bool forceRealtime = false) { Record("StringVariationOrThrowInternal", flagName); return StringOrThrowResult; }
        public int IntVariationOrThrowInternal(string flagName, bool forceRealtime = false) { Record("IntVariationOrThrowInternal", flagName); return IntOrThrowResult; }
        public float FloatVariationOrThrowInternal(string flagName, bool forceRealtime = false) { Record("FloatVariationOrThrowInternal", flagName); return FloatOrThrowResult; }
        public double DoubleVariationOrThrowInternal(string flagName, bool forceRealtime = false) { Record("DoubleVariationOrThrowInternal", flagName); return DoubleOrThrowResult; }
        public Dictionary<string, object> JsonVariationOrThrowInternal(string flagName, bool forceRealtime = false) { Record("JsonVariationOrThrowInternal", flagName); return JsonOrThrowResult; }

        public VariationResult<bool> BoolVariationDetailsInternal(string flagName, bool fallbackValue, bool forceRealtime = false) { Record("BoolVariationDetailsInternal", flagName); return BoolDetailsResult; }
        public VariationResult<string> StringVariationDetailsInternal(string flagName, string fallbackValue, bool forceRealtime = false) { Record("StringVariationDetailsInternal", flagName); return StringDetailsResult; }
        public VariationResult<int> IntVariationDetailsInternal(string flagName, int fallbackValue, bool forceRealtime = false) { Record("IntVariationDetailsInternal", flagName); return IntDetailsResult; }
        public VariationResult<float> FloatVariationDetailsInternal(string flagName, float fallbackValue, bool forceRealtime = false) { Record("FloatVariationDetailsInternal", flagName); return FloatDetailsResult; }
        public VariationResult<double> DoubleVariationDetailsInternal(string flagName, double fallbackValue, bool forceRealtime = false) { Record("DoubleVariationDetailsInternal", flagName); return DoubleDetailsResult; }
        public VariationResult<Dictionary<string, object>> JsonVariationDetailsInternal(string flagName, Dictionary<string, object> fallbackValue, bool forceRealtime = false) { Record("JsonVariationDetailsInternal", flagName); return JsonDetailsResult; }
    }

    [TestFixture]
    public class FlagProxyTests
    {
        private MockVariationProvider _mock;

        [SetUp]
        public void SetUp()
        {
            _mock = new MockVariationProvider();
        }

        // ==================== Construction ====================

        [Test]
        public void Constructor_WithNullFlag_SetsExistsFalse()
        {
            var proxy = new FlagProxy(null, _mock, "test-flag");

            Assert.IsFalse(proxy.Exists);
            Assert.AreEqual("test-flag", proxy.Name);
        }

        [Test]
        public void Constructor_WithFlag_SetsExistsTrue()
        {
            var flag = new EvaluatedFlag { Name = "my-flag", Enabled = true };
            var proxy = new FlagProxy(flag, _mock, "my-flag");

            Assert.IsTrue(proxy.Exists);
            Assert.AreEqual("my-flag", proxy.Name);
        }

        // ==================== Metadata Access ====================

        [Test]
        public void ValueType_ReturnsFromFlag()
        {
            var flag = new EvaluatedFlag { Name = "f", ValueType = ValueType.Boolean };
            var proxy = new FlagProxy(flag, _mock, "f");

            Assert.AreEqual(ValueType.Boolean, proxy.ValueType);
        }

        [Test]
        public void Version_ReturnsFromFlag()
        {
            var flag = new EvaluatedFlag { Name = "f", Version = 42 };
            var proxy = new FlagProxy(flag, _mock, "f");

            Assert.AreEqual(42, proxy.Version);
        }

        [Test]
        public void Reason_ReturnsFromFlag()
        {
            var flag = new EvaluatedFlag { Name = "f", Reason = "rollout" };
            var proxy = new FlagProxy(flag, _mock, "f");

            Assert.AreEqual("rollout", proxy.Reason);
        }

        [Test]
        public void MissingFlag_MetadataDefaults()
        {
            var proxy = new FlagProxy(null, _mock, "missing");

            Assert.AreEqual(ValueType.String, proxy.ValueType);
            Assert.AreEqual(0, proxy.Version);
            Assert.IsNull(proxy.Reason);
        }

        // ==================== Enabled (delegates to client) ====================

        [Test]
        public void Enabled_DelegatesToClient()
        {
            _mock.IsEnabledResult = true;
            var flag = new EvaluatedFlag { Name = "f", Enabled = true };
            var proxy = new FlagProxy(flag, _mock, "f");

            var result = proxy.Enabled;

            Assert.IsTrue(result);
            Assert.AreEqual("IsEnabledInternal", _mock.LastMethodCalled);
            Assert.AreEqual("f", _mock.LastFlagName);
        }

        [Test]
        public void Enabled_MissingFlag_DelegatesToClient()
        {
            _mock.IsEnabledResult = false;
            var proxy = new FlagProxy(null, _mock, "missing");

            Assert.IsFalse(proxy.Enabled);
            Assert.AreEqual("IsEnabledInternal", _mock.LastMethodCalled);
        }

        // ==================== Variant (delegates to client) ====================

        [Test]
        public void Variant_DelegatesToClient()
        {
            var expected = new Variant { Name = "blue", Enabled = true, Value = "sky" };
            _mock.GetVariantResult = expected;
            var proxy = new FlagProxy(new EvaluatedFlag { Name = "f" }, _mock, "f");

            var result = proxy.Variant;

            Assert.AreSame(expected, result);
            Assert.AreEqual("GetVariantInternal", _mock.LastMethodCalled);
        }

        // ==================== Variation Methods (delegation) ====================

        [Test]
        public void Variation_DelegatesToClient()
        {
            _mock.VariationResult = "dark";
            var proxy = new FlagProxy(new EvaluatedFlag { Name = "f" }, _mock, "f");

            Assert.AreEqual("dark", proxy.Variation("fallback"));
            Assert.AreEqual("VariationInternal", _mock.LastMethodCalled);
        }

        [Test]
        public void BoolVariation_DelegatesToClient()
        {
            _mock.BoolVariationResult = true;
            var proxy = new FlagProxy(new EvaluatedFlag { Name = "f" }, _mock, "f");

            Assert.IsTrue(proxy.BoolVariation(false));
            Assert.AreEqual("BoolVariationInternal", _mock.LastMethodCalled);
        }

        [Test]
        public void StringVariation_DelegatesToClient()
        {
            _mock.StringVariationResult = "hello";
            var proxy = new FlagProxy(new EvaluatedFlag { Name = "f" }, _mock, "f");

            Assert.AreEqual("hello", proxy.StringVariation("default"));
            Assert.AreEqual("StringVariationInternal", _mock.LastMethodCalled);
        }

        [Test]
        public void IntVariation_DelegatesToClient()
        {
            _mock.IntVariationResult = 99;
            var proxy = new FlagProxy(new EvaluatedFlag { Name = "f" }, _mock, "f");

            Assert.AreEqual(99, proxy.IntVariation(0));
            Assert.AreEqual("IntVariationInternal", _mock.LastMethodCalled);
        }

        [Test]
        public void FloatVariation_DelegatesToClient()
        {
            _mock.FloatVariationResult = 3.14f;
            var proxy = new FlagProxy(new EvaluatedFlag { Name = "f" }, _mock, "f");

            Assert.AreEqual(3.14f, proxy.FloatVariation(0f));
            Assert.AreEqual("FloatVariationInternal", _mock.LastMethodCalled);
        }

        [Test]
        public void DoubleVariation_DelegatesToClient()
        {
            _mock.DoubleVariationResult = 2.718;
            var proxy = new FlagProxy(new EvaluatedFlag { Name = "f" }, _mock, "f");

            Assert.AreEqual(2.718, proxy.DoubleVariation(0.0));
            Assert.AreEqual("DoubleVariationInternal", _mock.LastMethodCalled);
        }

        [Test]
        public void JsonVariation_DelegatesToClient()
        {
            var expected = new Dictionary<string, object> { { "key", "val" } };
            _mock.JsonVariationResult = expected;
            var proxy = new FlagProxy(new EvaluatedFlag { Name = "f" }, _mock, "f");

            var result = proxy.JsonVariation(null);
            Assert.AreSame(expected, result);
            Assert.AreEqual("JsonVariationInternal", _mock.LastMethodCalled);
        }

        // ==================== OrThrow Methods (delegation) ====================

        [Test]
        public void BoolVariationOrThrow_DelegatesToClient()
        {
            _mock.BoolOrThrowResult = true;
            var proxy = new FlagProxy(new EvaluatedFlag { Name = "f" }, _mock, "f");

            Assert.IsTrue(proxy.BoolVariationOrThrow());
            Assert.AreEqual("BoolVariationOrThrowInternal", _mock.LastMethodCalled);
        }

        [Test]
        public void StringVariationOrThrow_DelegatesToClient()
        {
            _mock.StringOrThrowResult = "strict";
            var proxy = new FlagProxy(new EvaluatedFlag { Name = "f" }, _mock, "f");

            Assert.AreEqual("strict", proxy.StringVariationOrThrow());
            Assert.AreEqual("StringVariationOrThrowInternal", _mock.LastMethodCalled);
        }

        [Test]
        public void IntVariationOrThrow_DelegatesToClient()
        {
            _mock.IntOrThrowResult = 42;
            var proxy = new FlagProxy(new EvaluatedFlag { Name = "f" }, _mock, "f");

            Assert.AreEqual(42, proxy.IntVariationOrThrow());
            Assert.AreEqual("IntVariationOrThrowInternal", _mock.LastMethodCalled);
        }

        [Test]
        public void FloatVariationOrThrow_DelegatesToClient()
        {
            _mock.FloatOrThrowResult = 1.5f;
            var proxy = new FlagProxy(new EvaluatedFlag { Name = "f" }, _mock, "f");

            Assert.AreEqual(1.5f, proxy.FloatVariationOrThrow());
            Assert.AreEqual("FloatVariationOrThrowInternal", _mock.LastMethodCalled);
        }

        [Test]
        public void DoubleVariationOrThrow_DelegatesToClient()
        {
            _mock.DoubleOrThrowResult = 9.99;
            var proxy = new FlagProxy(new EvaluatedFlag { Name = "f" }, _mock, "f");

            Assert.AreEqual(9.99, proxy.DoubleVariationOrThrow());
            Assert.AreEqual("DoubleVariationOrThrowInternal", _mock.LastMethodCalled);
        }

        [Test]
        public void JsonVariationOrThrow_DelegatesToClient()
        {
            var expected = new Dictionary<string, object> { { "a", 1 } };
            _mock.JsonOrThrowResult = expected;
            var proxy = new FlagProxy(new EvaluatedFlag { Name = "f" }, _mock, "f");

            var result = proxy.JsonVariationOrThrow();
            Assert.AreSame(expected, result);
            Assert.AreEqual("JsonVariationOrThrowInternal", _mock.LastMethodCalled);
        }

        // ==================== Details Methods (delegation) ====================

        [Test]
        public void BoolVariationDetails_DelegatesToClient()
        {
            _mock.BoolDetailsResult = new VariationResult<bool>
            {
                Value = true, Reason = "evaluated", FlagExists = true, Enabled = true
            };
            var proxy = new FlagProxy(new EvaluatedFlag { Name = "f" }, _mock, "f");

            var result = proxy.BoolVariationDetails(false);
            Assert.IsTrue(result.Value);
            Assert.AreEqual("evaluated", result.Reason);
            Assert.AreEqual("BoolVariationDetailsInternal", _mock.LastMethodCalled);
        }

        [Test]
        public void StringVariationDetails_DelegatesToClient()
        {
            _mock.StringDetailsResult = new VariationResult<string>
            {
                Value = "hello", Reason = "rollout", FlagExists = true, Enabled = true
            };
            var proxy = new FlagProxy(new EvaluatedFlag { Name = "f" }, _mock, "f");

            var result = proxy.StringVariationDetails("default");
            Assert.AreEqual("hello", result.Value);
            Assert.AreEqual("StringVariationDetailsInternal", _mock.LastMethodCalled);
        }

        [Test]
        public void IntVariationDetails_DelegatesToClient()
        {
            _mock.IntDetailsResult = new VariationResult<int>
            {
                Value = 10, Reason = "evaluated", FlagExists = true, Enabled = true
            };
            var proxy = new FlagProxy(new EvaluatedFlag { Name = "f" }, _mock, "f");

            var result = proxy.IntVariationDetails(0);
            Assert.AreEqual(10, result.Value);
            Assert.AreEqual("IntVariationDetailsInternal", _mock.LastMethodCalled);
        }

        [Test]
        public void FloatVariationDetails_DelegatesToClient()
        {
            _mock.FloatDetailsResult = new VariationResult<float>
            {
                Value = 1.5f, Reason = "evaluated", FlagExists = true, Enabled = true
            };
            var proxy = new FlagProxy(new EvaluatedFlag { Name = "f" }, _mock, "f");

            var result = proxy.FloatVariationDetails(0f);
            Assert.AreEqual(1.5f, result.Value);
            Assert.AreEqual("FloatVariationDetailsInternal", _mock.LastMethodCalled);
        }

        [Test]
        public void DoubleVariationDetails_DelegatesToClient()
        {
            _mock.DoubleDetailsResult = new VariationResult<double>
            {
                Value = 2.5, Reason = "flag_not_found", FlagExists = false, Enabled = false
            };
            var proxy = new FlagProxy(new EvaluatedFlag { Name = "f" }, _mock, "f");

            var result = proxy.DoubleVariationDetails(0.0);
            Assert.AreEqual(2.5, result.Value);
            Assert.IsFalse(result.FlagExists);
            Assert.AreEqual("DoubleVariationDetailsInternal", _mock.LastMethodCalled);
        }

        [Test]
        public void JsonVariationDetails_DelegatesToClient()
        {
            var expected = new Dictionary<string, object> { { "x", 1 } };
            _mock.JsonDetailsResult = new VariationResult<Dictionary<string, object>>
            {
                Value = expected, Reason = "evaluated", FlagExists = true, Enabled = true
            };
            var proxy = new FlagProxy(new EvaluatedFlag { Name = "f" }, _mock, "f");

            var result = proxy.JsonVariationDetails(null);
            Assert.AreSame(expected, result.Value);
            Assert.AreEqual("JsonVariationDetailsInternal", _mock.LastMethodCalled);
        }

        // ==================== FlagName Propagation ====================

        [Test]
        public void AllMethods_PassCorrectFlagName()
        {
            var proxy = new FlagProxy(new EvaluatedFlag { Name = "target" }, _mock, "target");

            proxy.BoolVariation(false);
            Assert.AreEqual("target", _mock.LastFlagName);

            proxy.StringVariation("");
            Assert.AreEqual("target", _mock.LastFlagName);

            proxy.IntVariation(0);
            Assert.AreEqual("target", _mock.LastFlagName);

            _ = proxy.Enabled;
            Assert.AreEqual("target", _mock.LastFlagName);

            _ = proxy.Variant;
            Assert.AreEqual("target", _mock.LastFlagName);
        }
    }
}
