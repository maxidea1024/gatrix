"""
Well-known variant source names shared across all Gatrix SDKs.
"""


class VariantSource:
    """Well-known variant source name constants."""

    MISSING = "$missing"
    """Flag not found in SDK cache"""

    TYPE_MISMATCH = "$type-mismatch"
    """SDK detected a type mismatch between requested and actual value type"""

    ENV_DEFAULT_ENABLED = "$env-default-enabled"
    """Value from environment-level enabledValue"""

    FLAG_DEFAULT_ENABLED = "$flag-default-enabled"
    """Value from flag-level (global) enabledValue"""

    ENV_DEFAULT_DISABLED = "$env-default-disabled"
    """Value from environment-level disabledValue"""

    FLAG_DEFAULT_DISABLED = "$flag-default-disabled"
    """Value from flag-level (global) disabledValue"""
