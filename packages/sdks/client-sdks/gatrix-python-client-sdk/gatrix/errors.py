"""Custom exception classes for the Gatrix SDK."""


class GatrixError(Exception):
    """Base error for Gatrix SDK."""
    pass


class GatrixConfigError(GatrixError):
    """Configuration validation error."""
    pass


class GatrixFeatureError(GatrixError):
    """Feature flag access error (used by *OrThrow methods)."""
    pass
