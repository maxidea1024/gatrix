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
        bool IsEnabledInternal(string flagName, bool forceRealtime = true);

        /// <summary>Get variant object (with metrics tracking)</summary>
        Variant GetVariantInternal(string flagName, bool forceRealtime = true);

        // ==================== Metadata Access ====================

        /// <summary>Check if flag exists in cache</summary>
        bool HasFlagInternal(string flagName, bool forceRealtime = true);

        /// <summary>Get value type of flag</summary>
        ValueType GetValueTypeInternal(string flagName, bool forceRealtime = true);

        /// <summary>Get version of flag</summary>
        int GetVersionInternal(string flagName, bool forceRealtime = true);

        /// <summary>Get evaluation reason of flag</summary>
        string GetReasonInternal(string flagName, bool forceRealtime = true);

        /// <summary>Get whether impression data is enabled</summary>
        bool GetImpressionDataInternal(string flagName, bool forceRealtime = true);

        /// <summary>Get raw evaluated flag (or null if not found)</summary>
        EvaluatedFlag GetRawFlagInternal(string flagName, bool forceRealtime = true);

        // ==================== Variations ====================

        string VariationInternal(string flagName, string fallbackValue, bool forceRealtime = true);
        bool BoolVariationInternal(string flagName, bool fallbackValue, bool forceRealtime = true);
        string StringVariationInternal(string flagName, string fallbackValue, bool forceRealtime = true);
        int IntVariationInternal(string flagName, int fallbackValue, bool forceRealtime = true);
        float FloatVariationInternal(string flagName, float fallbackValue, bool forceRealtime = true);
        double DoubleVariationInternal(string flagName, double fallbackValue, bool forceRealtime = true);
        Dictionary<string, object> JsonVariationInternal(string flagName, Dictionary<string, object> fallbackValue, bool forceRealtime = true);

        // ==================== Variation Details ====================

        VariationResult<bool> BoolVariationDetailsInternal(string flagName, bool fallbackValue, bool forceRealtime = true);
        VariationResult<string> StringVariationDetailsInternal(string flagName, string fallbackValue, bool forceRealtime = true);
        VariationResult<int> IntVariationDetailsInternal(string flagName, int fallbackValue, bool forceRealtime = true);
        VariationResult<float> FloatVariationDetailsInternal(string flagName, float fallbackValue, bool forceRealtime = true);
        VariationResult<double> DoubleVariationDetailsInternal(string flagName, double fallbackValue, bool forceRealtime = true);
        VariationResult<Dictionary<string, object>> JsonVariationDetailsInternal(
            string flagName, Dictionary<string, object> fallbackValue, bool forceRealtime = true);

        // ==================== OrThrow ====================

        bool BoolVariationOrThrowInternal(string flagName, bool forceRealtime = true);
        string StringVariationOrThrowInternal(string flagName, bool forceRealtime = true);
        int IntVariationOrThrowInternal(string flagName, bool forceRealtime = true);
        float FloatVariationOrThrowInternal(string flagName, bool forceRealtime = true);
        double DoubleVariationOrThrowInternal(string flagName, bool forceRealtime = true);
        Dictionary<string, object> JsonVariationOrThrowInternal(string flagName, bool forceRealtime = true);
    }
}
