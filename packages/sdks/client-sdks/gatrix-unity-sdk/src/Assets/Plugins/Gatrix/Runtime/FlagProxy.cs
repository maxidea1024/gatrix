// FlagProxy - Thin shell that delegates ALL logic to VariationProvider.
//
// Architecture per CLIENT_SDK_SPEC:
// - Holds only flagName + forceRealtime + client reference.
// - ALL property reads and variation methods delegate to the client.
// - No deep copy of flag data — always reads live state from FeaturesClient cache.
// - isRealtime property indicates the proxy's operational mode.
// - Client is always present (never null).

using System.Collections.Generic;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Convenience wrapper for accessing flag values.
    /// Delegates all logic to FeaturesClient via IVariationProvider.
    /// No internal flag copy — always reads from the client's cache.
    /// </summary>
    public class FlagProxy
    {
        private readonly IVariationProvider _client;
        private readonly string _flagName;
        private readonly bool _forceRealtime;

        public FlagProxy(IVariationProvider client, string flagName, bool forceRealtime = false)
        {
            _client = client;
            _flagName = flagName ?? "";
            _forceRealtime = forceRealtime;
        }

        #region Properties

        public string Name => _flagName;

        /// <summary>Whether this proxy was created in realtime mode.</summary>
        public bool IsRealtime => _forceRealtime;

        /// <summary>Whether the flag exists in the current cache.</summary>
        public bool Exists => _client.HasFlagInternal(_flagName, _forceRealtime);

        /// <summary>Check if flag is enabled. Delegates to client for metrics tracking.</summary>
        public bool Enabled => _client.IsEnabledInternal(_flagName, _forceRealtime);

        /// <summary>Get variant object. Delegates to client for metrics tracking.</summary>
        public Variant Variant => _client.GetVariantInternal(_flagName, _forceRealtime);

        // Read-only metadata (no metrics needed)
        public ValueType ValueType => _client.GetValueTypeInternal(_flagName, _forceRealtime);
        public int Version => _client.GetVersionInternal(_flagName, _forceRealtime);
        public string Reason => _client.GetReasonInternal(_flagName, _forceRealtime);
        public bool ImpressionData => _client.GetImpressionDataInternal(_flagName, _forceRealtime);
        public EvaluatedFlag Raw => _client.GetRawFlagInternal(_flagName, _forceRealtime);

        #endregion

        #region Variations (pure delegation)

        public string Variation(string fallbackValue)
            => _client.VariationInternal(_flagName, fallbackValue, _forceRealtime);

        public bool BoolVariation(bool fallbackValue)
            => _client.BoolVariationInternal(_flagName, fallbackValue, _forceRealtime);

        public string StringVariation(string fallbackValue)
            => _client.StringVariationInternal(_flagName, fallbackValue, _forceRealtime);

        public int IntVariation(int fallbackValue)
            => _client.IntVariationInternal(_flagName, fallbackValue, _forceRealtime);

        public float FloatVariation(float fallbackValue)
            => _client.FloatVariationInternal(_flagName, fallbackValue, _forceRealtime);

        public double DoubleVariation(double fallbackValue)
            => _client.DoubleVariationInternal(_flagName, fallbackValue, _forceRealtime);

        public Dictionary<string, object> JsonVariation(Dictionary<string, object> fallbackValue)
            => _client.JsonVariationInternal(_flagName, fallbackValue, _forceRealtime);

        #endregion

        #region Variation Details (pure delegation)

        public VariationResult<bool> BoolVariationDetails(bool fallbackValue)
            => _client.BoolVariationDetailsInternal(_flagName, fallbackValue, _forceRealtime);

        public VariationResult<string> StringVariationDetails(string fallbackValue)
            => _client.StringVariationDetailsInternal(_flagName, fallbackValue, _forceRealtime);

        public VariationResult<int> IntVariationDetails(int fallbackValue)
            => _client.IntVariationDetailsInternal(_flagName, fallbackValue, _forceRealtime);

        public VariationResult<float> FloatVariationDetails(float fallbackValue)
            => _client.FloatVariationDetailsInternal(_flagName, fallbackValue, _forceRealtime);

        public VariationResult<double> DoubleVariationDetails(double fallbackValue)
            => _client.DoubleVariationDetailsInternal(_flagName, fallbackValue, _forceRealtime);

        public VariationResult<Dictionary<string, object>> JsonVariationDetails(Dictionary<string, object> fallbackValue)
            => _client.JsonVariationDetailsInternal(_flagName, fallbackValue, _forceRealtime);

        #endregion

        #region OrThrow (pure delegation)

        public bool BoolVariationOrThrow()
            => _client.BoolVariationOrThrowInternal(_flagName, _forceRealtime);

        public string StringVariationOrThrow()
            => _client.StringVariationOrThrowInternal(_flagName, _forceRealtime);

        public int IntVariationOrThrow()
            => _client.IntVariationOrThrowInternal(_flagName, _forceRealtime);

        public float FloatVariationOrThrow()
            => _client.FloatVariationOrThrowInternal(_flagName, _forceRealtime);

        public double DoubleVariationOrThrow()
            => _client.DoubleVariationOrThrowInternal(_flagName, _forceRealtime);

        public Dictionary<string, object> JsonVariationOrThrow()
            => _client.JsonVariationOrThrowInternal(_flagName, _forceRealtime);

        #endregion
    }
}
