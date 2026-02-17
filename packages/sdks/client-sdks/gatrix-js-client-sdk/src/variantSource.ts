/**
 * Reserved variant source names used throughout the SDK.
 *
 * These mirror the definitions in @gatrix/shared so that
 * the client SDK (which does not depend on @gatrix/shared) uses
 * the same well-known names as the server.
 */
export const VARIANT_SOURCE = {
    /** Flag not found in SDK cache */
    MISSING: '$missing',
    /** SDK detected a type mismatch between requested and actual value type */
    TYPE_MISMATCH: '$type-mismatch',
    /** Value from environment-level enabledValue */
    ENV_DEFAULT_ENABLED: '$env-default-enabled',
    /** Value from flag-level (global) enabledValue */
    FLAG_DEFAULT_ENABLED: '$flag-default-enabled',
    /** Value from environment-level disabledValue */
    ENV_DEFAULT_DISABLED: '$env-default-disabled',
    /** Value from flag-level (global) disabledValue */
    FLAG_DEFAULT_DISABLED: '$flag-default-disabled',
} as const;
