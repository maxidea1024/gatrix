"""Shared bootstrap fixtures for all tests."""
from gatrix.types import EvaluatedFlag, Variant


def make_flag(
    name: str,
    enabled: bool = True,
    variant_name: str = "disabled",
    variant_enabled: bool = False,
    value: object = None,
    value_type: str = "none",
    version: int = 1,
    impression_data: bool = False,
    reason: str = None,
) -> EvaluatedFlag:
    """Convenience factory for EvaluatedFlag."""
    return EvaluatedFlag(
        name=name,
        enabled=enabled,
        variant=Variant(name=variant_name, enabled=variant_enabled, value=value),
        value_type=value_type,
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
        value="dark-mode",
        value_type="string",
        version=3,
    ),
    make_flag(
        "price-multiplier",
        enabled=True,
        variant_name="high",
        variant_enabled=True,
        value=1.5,
        value_type="number",
        version=2,
    ),
    make_flag(
        "ui-config",
        enabled=True,
        variant_name="v2",
        variant_enabled=True,
        value={"sidebar": True, "compact": False},
        value_type="json",
        version=5,
    ),
    make_flag(
        "disabled-variant",
        enabled=False,
        variant_name="beta",
        variant_enabled=True,
        value="beta-value",
        value_type="string",
    ),
]

BOOTSTRAP_IMPRESSION = [
    make_flag(
        "tracked-flag",
        enabled=True,
        variant_name="a",
        variant_enabled=True,
        value="val-a",
        value_type="string",
        impression_data=True,
    ),
    make_flag("untracked-flag", enabled=True),
]

BOOTSTRAP_FULL = [
    make_flag(
        "bool-flag",
        enabled=True,
        variant_name="on",
        variant_enabled=True,
        value=True,
        value_type="boolean",
        version=1,
    ),
    make_flag(
        "string-flag",
        enabled=True,
        variant_name="greeting",
        variant_enabled=True,
        value="hello world",
        value_type="string",
        version=2,
    ),
    make_flag(
        "number-flag",
        enabled=True,
        variant_name="rate",
        variant_enabled=True,
        value=42,
        value_type="number",
        version=3,
    ),
    make_flag(
        "json-flag",
        enabled=True,
        variant_name="config",
        variant_enabled=True,
        value={"key": "value", "nested": {"a": 1}},
        value_type="json",
        version=4,
    ),
    make_flag(
        "json-string-flag",
        enabled=True,
        variant_name="config-str",
        variant_enabled=True,
        value='{"parsed": true}',
        value_type="json",
        version=5,
    ),
    make_flag(
        "disabled-flag",
        enabled=False,
        variant_name="disabled",
        variant_enabled=False,
        value=False,
        value_type="boolean",
        version=1,
    ),
    make_flag(
        "impression-flag",
        enabled=True,
        variant_name="imp-var",
        variant_enabled=True,
        value="imp-val",
        value_type="string",
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
