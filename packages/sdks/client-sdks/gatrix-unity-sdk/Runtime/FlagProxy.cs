// FlagProxy - Thin shell that delegates ALL variation logic to VariationProvider.
//
// Architecture per CLIENT_SDK_SPEC:
// - Property accessors: enabled/variant delegate to client for metrics tracking.
//   Other properties read flag data directly (read-only).
// - ALL variation / details / orThrow methods delegate to VariationProvider (FeaturesClient).
// - No type checking logic here - that's the VariationProvider's job.
// - Client is always present (never null).

using System;
using System.Collections.Generic;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Convenience wrapper for accessing flag values.
    /// Delegates all variation logic to FeaturesClient via *Internal methods.
    /// </summary>
    public class FlagProxy
    {
        internal static readonly Variant MissingVariant = new Variant
        {
            Name = "$missing",
            Enabled = false,
            Value = null
        };

        internal static readonly EvaluatedFlag MissingFlag = new EvaluatedFlag
        {
            Name = "",
            Enabled = false,
            Variant = MissingVariant,
            ValueType = ValueType.None,
            Version = 0,
            ImpressionData = false
        };

        private readonly EvaluatedFlag _flag;
        private readonly bool _exists;
        private readonly IVariationProvider _client;
        private readonly string _flagName;

        public FlagProxy(EvaluatedFlag flag, IVariationProvider client, string flagName)
        {
            _exists = flag != null;
            _flag = flag ?? MissingFlag;
            _client = client;
            _flagName = flagName ?? _flag.Name;
        }

        #region Properties

        public bool Exists => _exists;
        public string Name => _flagName;

        /// <summary>Check if flag is enabled. Delegates to client for metrics tracking.</summary>
        public bool Enabled => _client.IsEnabledInternal(_flagName);

        /// <summary>Get variant object. Delegates to client for metrics tracking.</summary>
        public Variant Variant => _client.GetVariantInternal(_flagName);

        // Read-only metadata (no metrics needed)
        public ValueType ValueType => _flag.ValueType;
        public int Version => _flag.Version;
        public string Reason => _flag.Reason;
        public bool ImpressionData => _flag.ImpressionData;
        public EvaluatedFlag Raw => _exists ? _flag : null;

        #endregion

        #region Variations (pure delegation)

        public string Variation(string missingValue)
            => _client.VariationInternal(_flagName, missingValue);

        public bool BoolVariation(bool missingValue)
            => _client.BoolVariationInternal(_flagName, missingValue);

        public string StringVariation(string missingValue)
            => _client.StringVariationInternal(_flagName, missingValue);

        public int IntVariation(int missingValue)
            => _client.IntVariationInternal(_flagName, missingValue);

        public float FloatVariation(float missingValue)
            => _client.FloatVariationInternal(_flagName, missingValue);

        public double DoubleVariation(double missingValue)
            => _client.DoubleVariationInternal(_flagName, missingValue);

        public Dictionary<string, object> JsonVariation(Dictionary<string, object> missingValue)
            => _client.JsonVariationInternal(_flagName, missingValue);

        #endregion

        #region Variation Details (pure delegation)

        public VariationResult<bool> BoolVariationDetails(bool missingValue)
            => _client.BoolVariationDetailsInternal(_flagName, missingValue);

        public VariationResult<string> StringVariationDetails(string missingValue)
            => _client.StringVariationDetailsInternal(_flagName, missingValue);

        public VariationResult<int> IntVariationDetails(int missingValue)
            => _client.IntVariationDetailsInternal(_flagName, missingValue);

        public VariationResult<float> FloatVariationDetails(float missingValue)
            => _client.FloatVariationDetailsInternal(_flagName, missingValue);

        public VariationResult<double> DoubleVariationDetails(double missingValue)
            => _client.DoubleVariationDetailsInternal(_flagName, missingValue);

        public VariationResult<Dictionary<string, object>> JsonVariationDetails(Dictionary<string, object> missingValue)
            => _client.JsonVariationDetailsInternal(_flagName, missingValue);

        #endregion

        #region OrThrow (pure delegation)

        public bool BoolVariationOrThrow()
            => _client.BoolVariationOrThrowInternal(_flagName);

        public string StringVariationOrThrow()
            => _client.StringVariationOrThrowInternal(_flagName);

        public int IntVariationOrThrow()
            => _client.IntVariationOrThrowInternal(_flagName);

        public float FloatVariationOrThrow()
            => _client.FloatVariationOrThrowInternal(_flagName);

        public double DoubleVariationOrThrow()
            => _client.DoubleVariationOrThrowInternal(_flagName);

        public Dictionary<string, object> JsonVariationOrThrow()
            => _client.JsonVariationOrThrowInternal(_flagName);

        #endregion
    }
}
