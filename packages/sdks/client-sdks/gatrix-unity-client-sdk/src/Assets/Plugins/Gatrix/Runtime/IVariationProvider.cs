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
        bool IsEnabledInternal(string flagName, bool forceRealtime = false);

        /// <summary>Get variant object (with metrics tracking)</summary>
        Variant GetVariantInternal(string flagName, bool forceRealtime = false);

        // ==================== Metadata Access ====================

        /// <summary>Check if flag exists in cache</summary>
        bool HasFlagInternal(string flagName, bool forceRealtime = false);

        /// <summary>Get value type of flag</summary>
        ValueType GetValueTypeInternal(string flagName, bool forceRealtime = false);

        /// <summary>Get version of flag</summary>
        int GetVersionInternal(string flagName, bool forceRealtime = false);

        /// <summary>Get evaluation reason of flag</summary>
        string GetReasonInternal(string flagName, bool forceRealtime = false);

        /// <summary>Get whether impression data is enabled</summary>
        bool GetImpressionDataInternal(string flagName, bool forceRealtime = false);

        /// <summary>Get raw evaluated flag (or null if not found)</summary>
        EvaluatedFlag GetRawFlagInternal(string flagName, bool forceRealtime = false);

        // ==================== Variations ====================

        string VariationInternal(string flagName, string fallbackValue, bool forceRealtime = false);
        bool BoolVariationInternal(string flagName, bool fallbackValue, bool forceRealtime = false);
        string StringVariationInternal(string flagName, string fallbackValue, bool forceRealtime = false);
        int IntVariationInternal(string flagName, int fallbackValue, bool forceRealtime = false);
        float FloatVariationInternal(string flagName, float fallbackValue, bool forceRealtime = false);
        double DoubleVariationInternal(string flagName, double fallbackValue, bool forceRealtime = false);
        Dictionary<string, object> JsonVariationInternal(string flagName, Dictionary<string, object> fallbackValue, bool forceRealtime = false);

        // ==================== Variation Details ====================

        VariationResult<bool> BoolVariationDetailsInternal(string flagName, bool fallbackValue, bool forceRealtime = false);
        VariationResult<string> StringVariationDetailsInternal(string flagName, string fallbackValue, bool forceRealtime = false);
        VariationResult<int> IntVariationDetailsInternal(string flagName, int fallbackValue, bool forceRealtime = false);
        VariationResult<float> FloatVariationDetailsInternal(string flagName, float fallbackValue, bool forceRealtime = false);
        VariationResult<double> DoubleVariationDetailsInternal(string flagName, double fallbackValue, bool forceRealtime = false);
        VariationResult<Dictionary<string, object>> JsonVariationDetailsInternal(
            string flagName, Dictionary<string, object> fallbackValue, bool forceRealtime = false);

        // ==================== OrThrow ====================

        bool BoolVariationOrThrowInternal(string flagName, bool forceRealtime = false);
        string StringVariationOrThrowInternal(string flagName, bool forceRealtime = false);
        int IntVariationOrThrowInternal(string flagName, bool forceRealtime = false);
        float FloatVariationOrThrowInternal(string flagName, bool forceRealtime = false);
        double DoubleVariationOrThrowInternal(string flagName, bool forceRealtime = false);
        Dictionary<string, object> JsonVariationOrThrowInternal(string flagName, bool forceRealtime = false);
    }
}
