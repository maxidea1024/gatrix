"""Shared bootstrap fixtures for all tests."""
from gatrix.types import EvaluatedFlag, Variant


def make_flag(
    name: str,
    enabled: bool = True,
    variant_name: str = "disabled",
    variant_enabled: bool = False,
    payload: object = None,
    variant_type: str = "none",
    version: int = 1,
    impression_data: bool = False,
    reason: str = None,
) -> EvaluatedFlag:
    """Convenience factory for EvaluatedFlag."""
    return EvaluatedFlag(
        name=name,
        enabled=enabled,
        variant=Variant(name=variant_name, enabled=variant_enabled, payload=payload),
        variant_type=variant_type,
        version=version,
        impression_data=impression_data,
        reason=reason,
    )


# ==================== Bootstrap data sets ====================

BOOTSTRAP_SIMPLE = [
    make_flag("feature-on", enabled=True),
    make_flag("feature-off", enabled=False),
]

BOOTSTRAP_WITH_VARIANTS = [
    make_flag(
        "color-theme",
        enabled=True,
        variant_name="dark",
        variant_enabled=True,
        payload="dark-mode",
        variant_type="string",
        version=3,
    ),
    make_flag(
        "price-multiplier",
        enabled=True,
        variant_name="high",
        variant_enabled=True,
        payload=1.5,
        variant_type="number",
        version=2,
    ),
    make_flag(
        "ui-config",
        enabled=True,
        variant_name="v2",
        variant_enabled=True,
        payload={"sidebar": True, "compact": False},
        variant_type="json",
        version=5,
    ),
    make_flag(
        "disabled-variant",
        enabled=False,
        variant_name="beta",
        variant_enabled=True,
        payload="beta-value",
        variant_type="string",
    ),
]

BOOTSTRAP_IMPRESSION = [
    make_flag(
        "tracked-flag",
        enabled=True,
        variant_name="a",
        variant_enabled=True,
        payload="val-a",
        variant_type="string",
        impression_data=True,
    ),
    make_flag("untracked-flag", enabled=True),
]

BOOTSTRAP_FULL = [
    make_flag(
        "bool-flag",
        enabled=True,
        version=1,
    ),
    make_flag(
        "string-flag",
        enabled=True,
        variant_name="greeting",
        variant_enabled=True,
        payload="hello world",
        variant_type="string",
        version=2,
    ),
    make_flag(
        "number-flag",
        enabled=True,
        variant_name="rate",
        variant_enabled=True,
        payload=42,
        variant_type="number",
        version=3,
    ),
    make_flag(
        "json-flag",
        enabled=True,
        variant_name="config",
        variant_enabled=True,
        payload={"key": "value", "nested": {"a": 1}},
        variant_type="json",
        version=4,
    ),
    make_flag(
        "json-string-flag",
        enabled=True,
        variant_name="config-str",
        variant_enabled=True,
        payload='{"parsed": true}',
        variant_type="json",
        version=5,
    ),
    make_flag("disabled-flag", enabled=False, version=1),
    make_flag(
        "impression-flag",
        enabled=True,
        variant_name="imp-var",
        variant_enabled=True,
        payload="imp-val",
        variant_type="string",
        impression_data=True,
        version=6,
    ),
    make_flag(
        "variant-disabled-flag",
        enabled=True,
        variant_name="disabled",
        variant_enabled=False,
        version=7,
    ),
]
