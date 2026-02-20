#ifndef GATRIX_VARIANT_SOURCE_H
#define GATRIX_VARIANT_SOURCE_H

#include <string>

namespace gatrix {

/**
 * Well-known variant source names shared across all Gatrix SDKs.
 */
struct VariantSourceNames {
  static constexpr const char* MISSING = "$missing";
  static constexpr const char* TYPE_MISMATCH = "$type-mismatch";
  static constexpr const char* ENV_DEFAULT_ENABLED = "$env-default-enabled";
  static constexpr const char* FLAG_DEFAULT_ENABLED = "$flag-default-enabled";
  static constexpr const char* ENV_DEFAULT_DISABLED = "$env-default-disabled";
  static constexpr const char* FLAG_DEFAULT_DISABLED = "$flag-default-disabled";
};

} // namespace gatrix

#endif // GATRIX_VARIANT_SOURCE_H
