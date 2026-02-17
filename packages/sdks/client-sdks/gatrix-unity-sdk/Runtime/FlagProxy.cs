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
        /// <summary>Create a missing flag sentinel with per-flag context</summary>
        internal static EvaluatedFlag CreateMissingFlag(string flagName)
        {
            return new EvaluatedFlag
            {
                Name = flagName,
                Enabled = false,
                Variant = new Variant { Name = VariantSource.Missing, Enabled = false, Value = null },
                ValueType = ValueType.None,
                Version = 0,
                ImpressionData = false
            };
        }

        private readonly EvaluatedFlag _flag;
        private readonly bool _exists;
        private readonly IVariationProvider _client;
        private readonly string _flagName;

        public FlagProxy(EvaluatedFlag flag, IVariationProvider client, string flagName)
        {
            _exists = flag != null;
            _flagName = flagName ?? flag?.Name ?? "";
            // Deep-clone for immutable snapshot safety
            _flag = flag != null
                ? new EvaluatedFlag
                {
                    Name = flag.Name,
                    Enabled = flag.Enabled,
                    Variant = flag.Variant != null
                        ? new Variant { Name = flag.Variant.Name, Enabled = flag.Variant.Enabled, Value = flag.Variant.Value }
                        : null,
                    ValueType = flag.ValueType,
                    Version = flag.Version,
                    Reason = flag.Reason,
                    ImpressionData = flag.ImpressionData
                }
                : CreateMissingFlag(_flagName);
            _client = client;
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

        public string Variation(string fallbackValue, bool forceRealtime = false)
            => _client.VariationInternal(_flagName, fallbackValue, forceRealtime);

        public bool BoolVariation(bool fallbackValue, bool forceRealtime = false)
            => _client.BoolVariationInternal(_flagName, fallbackValue, forceRealtime);

        public string StringVariation(string fallbackValue, bool forceRealtime = false)
            => _client.StringVariationInternal(_flagName, fallbackValue, forceRealtime);

        public int IntVariation(int fallbackValue, bool forceRealtime = false)
            => _client.IntVariationInternal(_flagName, fallbackValue, forceRealtime);

        public float FloatVariation(float fallbackValue, bool forceRealtime = false)
            => _client.FloatVariationInternal(_flagName, fallbackValue, forceRealtime);

        public double DoubleVariation(double fallbackValue, bool forceRealtime = false)
            => _client.DoubleVariationInternal(_flagName, fallbackValue, forceRealtime);

        public Dictionary<string, object> JsonVariation(Dictionary<string, object> fallbackValue, bool forceRealtime = false)
            => _client.JsonVariationInternal(_flagName, fallbackValue, forceRealtime);

        #endregion

        #region Variation Details (pure delegation)

        public VariationResult<bool> BoolVariationDetails(bool fallbackValue, bool forceRealtime = false)
            => _client.BoolVariationDetailsInternal(_flagName, fallbackValue, forceRealtime);

        public VariationResult<string> StringVariationDetails(string fallbackValue, bool forceRealtime = false)
            => _client.StringVariationDetailsInternal(_flagName, fallbackValue, forceRealtime);

        public VariationResult<int> IntVariationDetails(int fallbackValue, bool forceRealtime = false)
            => _client.IntVariationDetailsInternal(_flagName, fallbackValue, forceRealtime);

        public VariationResult<float> FloatVariationDetails(float fallbackValue, bool forceRealtime = false)
            => _client.FloatVariationDetailsInternal(_flagName, fallbackValue, forceRealtime);

        public VariationResult<double> DoubleVariationDetails(double fallbackValue, bool forceRealtime = false)
            => _client.DoubleVariationDetailsInternal(_flagName, fallbackValue, forceRealtime);

        public VariationResult<Dictionary<string, object>> JsonVariationDetails(Dictionary<string, object> fallbackValue, bool forceRealtime = false)
            => _client.JsonVariationDetailsInternal(_flagName, fallbackValue, forceRealtime);

        #endregion

        #region OrThrow (pure delegation)

        public bool BoolVariationOrThrow(bool forceRealtime = false)
            => _client.BoolVariationOrThrowInternal(_flagName, forceRealtime);

        public string StringVariationOrThrow(bool forceRealtime = false)
            => _client.StringVariationOrThrowInternal(_flagName, forceRealtime);

        public int IntVariationOrThrow(bool forceRealtime = false)
            => _client.IntVariationOrThrowInternal(_flagName, forceRealtime);

        public float FloatVariationOrThrow(bool forceRealtime = false)
            => _client.FloatVariationOrThrowInternal(_flagName, forceRealtime);

        public double DoubleVariationOrThrow(bool forceRealtime = false)
            => _client.DoubleVariationOrThrowInternal(_flagName, forceRealtime);

        public Dictionary<string, object> JsonVariationOrThrow(bool forceRealtime = false)
            => _client.JsonVariationOrThrowInternal(_flagName, forceRealtime);

        #endregion
    }
}
