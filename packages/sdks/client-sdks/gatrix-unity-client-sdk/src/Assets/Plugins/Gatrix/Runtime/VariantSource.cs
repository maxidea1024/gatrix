// Reserved variant source names used throughout the SDK.
// These constants define how the origin of a variant value
// is classified when returned from evaluation.

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Well-known variant source names shared across all Gatrix SDKs.
    /// </summary>
    public static class VariantSource
    {
        /// <summary>Flag not found in SDK cache</summary>
        public const string Missing = "$missing";

        /// <summary>SDK detected a type mismatch between requested and actual value type</summary>
        public const string TypeMismatch = "$type-mismatch";

        /// <summary>Value from environment-level enabledValue</summary>
        public const string EnvDefaultEnabled = "$env-default-enabled";

        /// <summary>Value from flag-level (global) enabledValue</summary>
        public const string FlagDefaultEnabled = "$flag-default-enabled";

        /// <summary>Value from environment-level disabledValue</summary>
        public const string EnvDefaultDisabled = "$env-default-disabled";

        /// <summary>Value from flag-level (global) disabledValue</summary>
        public const string FlagDefaultDisabled = "$flag-default-disabled";
    }
}
