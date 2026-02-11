// IVariationProvider - Interface for flag variation resolution.
//
// FlagProxy depends on this interface (not FeaturesClient concrete class),
// enabling testability and proper architectural separation per CLIENT_SDK_SPEC.
//
// FeaturesClient implements this interface. All *Internal methods contain
// flag lookup + value extraction + type checking + metrics tracking.

using System.Collections.Generic;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Provides typed flag variation resolution with integrated metrics tracking.
    /// FlagProxy delegates ALL variation logic to this interface.
    /// </summary>
    public interface IVariationProvider
    {
        // ==================== Core Access ====================

        /// <summary>Check if flag is enabled (with metrics tracking)</summary>
        bool IsEnabledInternal(string flagName);

        /// <summary>Get variant object (with metrics tracking)</summary>
        Variant GetVariantInternal(string flagName);

        // ==================== Variations ====================

        string VariationInternal(string flagName, string missingValue);
        bool BoolVariationInternal(string flagName, bool missingValue);
        string StringVariationInternal(string flagName, string missingValue);
        int IntVariationInternal(string flagName, int missingValue);
        float FloatVariationInternal(string flagName, float missingValue);
        double DoubleVariationInternal(string flagName, double missingValue);
        Dictionary<string, object> JsonVariationInternal(string flagName, Dictionary<string, object> missingValue);

        // ==================== Variation Details ====================

        VariationResult<bool> BoolVariationDetailsInternal(string flagName, bool missingValue);
        VariationResult<string> StringVariationDetailsInternal(string flagName, string missingValue);
        VariationResult<int> IntVariationDetailsInternal(string flagName, int missingValue);
        VariationResult<float> FloatVariationDetailsInternal(string flagName, float missingValue);
        VariationResult<double> DoubleVariationDetailsInternal(string flagName, double missingValue);
        VariationResult<Dictionary<string, object>> JsonVariationDetailsInternal(
            string flagName, Dictionary<string, object> missingValue);

        // ==================== OrThrow ====================

        bool BoolVariationOrThrowInternal(string flagName);
        string StringVariationOrThrowInternal(string flagName);
        int IntVariationOrThrowInternal(string flagName);
        float FloatVariationOrThrowInternal(string flagName);
        double DoubleVariationOrThrowInternal(string flagName);
        Dictionary<string, object> JsonVariationOrThrowInternal(string flagName);
    }
}
