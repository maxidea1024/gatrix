// TypesTests - Unit tests for core data types
//
// Validates GatrixContext, Variant, EvaluatedFlag, ValueType, and sentinel values.

using System.Collections.Generic;
using NUnit.Framework;

namespace Gatrix.Unity.SDK.Tests
{
    [TestFixture]
    public class TypesTests
    {
        // ==================== GatrixContext ====================

        [Test]
        public void GatrixContext_Clone_CopiesAllFields()
        {
            var original = new GatrixContext
            {
                AppName = "app",
                Environment = "prod",
                UserId = "user1",
                SessionId = "sess1",
                CurrentTime = "2026-01-01",
                Properties = new Dictionary<string, object>
                {
                    { "region", "kr" },
                    { "level", 10 }
                }
            };

            var clone = original.Clone();

            Assert.AreEqual("app", clone.AppName);
            Assert.AreEqual("prod", clone.Environment);
            Assert.AreEqual("user1", clone.UserId);
            Assert.AreEqual("sess1", clone.SessionId);
            Assert.AreEqual("2026-01-01", clone.CurrentTime);
            Assert.AreEqual("kr", clone.Properties["region"]);
            Assert.AreEqual(10, clone.Properties["level"]);
        }

        [Test]
        public void GatrixContext_Clone_PropertiesAreIndependent()
        {
            var original = new GatrixContext
            {
                Properties = new Dictionary<string, object> { { "a", 1 } }
            };

            var clone = original.Clone();
            clone.Properties["b"] = 2;

            Assert.IsFalse(original.Properties.ContainsKey("b"));
        }

        [Test]
        public void GatrixContext_Clone_NullProperties_DoesNotThrow()
        {
            var original = new GatrixContext { AppName = "test" };
            var clone = original.Clone();

            Assert.IsNull(clone.Properties);
        }

        [Test]
        public void GatrixContext_NoDeviceId()
        {
            // Verify DeviceId is no longer a property - compiles without it
            var ctx = new GatrixContext
            {
                AppName = "test",
                UserId = "u",
                SessionId = "s",
                CurrentTime = "t"
            };

            Assert.AreEqual("test", ctx.AppName);
            Assert.AreEqual("u", ctx.UserId);
            Assert.AreEqual("s", ctx.SessionId);
            Assert.AreEqual("t", ctx.CurrentTime);
        }

        // ==================== Variant ====================

        [Test]
        public void Variant_Value_CanBeBool()
        {
            var v = new Variant { Name = "on", Enabled = true, Value = true };

            Assert.IsTrue((bool)v.Value);
        }

        [Test]
        public void Variant_Value_CanBeString()
        {
            var v = new Variant { Name = "color", Value = "blue" };

            Assert.AreEqual("blue", v.Value);
        }

        [Test]
        public void Variant_Value_CanBeNumber()
        {
            var v = new Variant { Name = "rate", Value = 0.75 };

            Assert.AreEqual(0.75, (double)v.Value);
        }

        [Test]
        public void Variant_Value_CanBeNull()
        {
            var v = new Variant { Name = "empty", Value = null };

            Assert.IsNull(v.Value);
        }

        // ==================== ValueType ====================

        [Test]
        public void ValueType_IncludesBoolean()
        {
            Assert.AreEqual(ValueType.Boolean, (ValueType)4);
        }

        [Test]
        public void ValueTypeHelper_BooleanToString()
        {
            Assert.AreEqual("boolean", ValueTypeHelper.ToApiString(ValueType.Boolean));
        }

        [Test]
        public void ValueTypeHelper_StringToString()
        {
            Assert.AreEqual("string", ValueTypeHelper.ToApiString(ValueType.String));
        }

        [Test]
        public void ValueTypeHelper_NumberToString()
        {
            Assert.AreEqual("number", ValueTypeHelper.ToApiString(ValueType.Number));
        }

        [Test]
        public void ValueTypeHelper_JsonToString()
        {
            Assert.AreEqual("json", ValueTypeHelper.ToApiString(ValueType.Json));
        }

        [Test]
        public void ValueTypeHelper_FromApiString_Boolean()
        {
            Assert.AreEqual(ValueType.Boolean, ValueTypeHelper.FromApiString("boolean"));
        }

        [Test]
        public void ValueTypeHelper_FromApiString_CaseInsensitive()
        {
            Assert.AreEqual(ValueType.Boolean, ValueTypeHelper.FromApiString("Boolean"));
            Assert.AreEqual(ValueType.String, ValueTypeHelper.FromApiString("STRING"));
        }

        // ==================== EvaluatedFlag ====================

        [Test]
        public void EvaluatedFlag_HasAllFields()
        {
            var variant = new Variant { Name = "dark", Enabled = true, Value = "#000" };
            var flag = new EvaluatedFlag
            {
                Name = "theme",
                Enabled = true,
                Version = 3,
                ValueType = ValueType.String,
                Variant = variant,
                Reason = "rollout",
                ImpressionData = true
            };

            Assert.AreEqual("theme", flag.Name);
            Assert.IsTrue(flag.Enabled);
            Assert.AreEqual(3, flag.Version);
            Assert.AreEqual(ValueType.String, flag.ValueType);
            Assert.AreEqual("dark", flag.Variant.Name);
            Assert.AreEqual("#000", flag.Variant.Value);
            Assert.AreEqual("rollout", flag.Reason);
            Assert.IsTrue(flag.ImpressionData);
        }

        // ==================== VariationResult ====================

        [Test]
        public void VariationResult_Bool_HasAllFields()
        {
            var result = new VariationResult<bool>
            {
                Value = true,
                Reason = "evaluated",
                FlagExists = true,
                Enabled = true
            };

            Assert.IsTrue(result.Value);
            Assert.AreEqual("evaluated", result.Reason);
            Assert.IsTrue(result.FlagExists);
            Assert.IsTrue(result.Enabled);
        }

        [Test]
        public void VariationResult_String_FlagNotFound()
        {
            var result = new VariationResult<string>
            {
                Value = "default",
                Reason = "flag_not_found",
                FlagExists = false,
                Enabled = false
            };

            Assert.AreEqual("default", result.Value);
            Assert.AreEqual("flag_not_found", result.Reason);
            Assert.IsFalse(result.FlagExists);
            Assert.IsFalse(result.Enabled);
        }
    }
}
