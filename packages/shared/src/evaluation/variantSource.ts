/**
 * Reserved variant source names used throughout the system.
 *
 * These constants define how the origin of a variant value
 * is classified when returned from evaluation.
 *
 * Naming convention:
 *   $missing           - Flag not found in cache
 *   $type-mismatch     - SDK detected a type mismatch
 *   $env-default-*     - Value comes from the environment-level default
 *   $flag-default-*    - Value comes from the flag-level (global) default
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

export type VariantSourceName = (typeof VARIANT_SOURCE)[keyof typeof VARIANT_SOURCE];
