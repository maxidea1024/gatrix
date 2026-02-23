/// Well-known variant source names shared across all Gatrix SDKs.
class VariantSource {
  VariantSource._();

  /// Flag not found in SDK cache
  static const String missing = r'$missing';

  /// SDK detected a type mismatch between requested and actual value type
  static const String typeMismatch = r'$type-mismatch';

  /// Value from environment-level enabledValue
  static const String envDefaultEnabled = r'$env-default-enabled';

  /// Value from flag-level (global) enabledValue
  static const String flagDefaultEnabled = r'$flag-default-enabled';

  /// Value from environment-level disabledValue
  static const String envDefaultDisabled = r'$env-default-disabled';

  /// Value from flag-level (global) disabledValue
  static const String flagDefaultDisabled = r'$flag-default-disabled';
}
