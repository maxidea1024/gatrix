#ifndef GATRIX_FLAG_PROXY_H
#define GATRIX_FLAG_PROXY_H

#include "GatrixTypes.h"
#include "GatrixVariationProvider.h"
#include <cassert>
#include <string>
#include <vector>

namespace gatrix {

/**
 * FlagProxy - Single source of truth for flag value extraction.
 *
 * This is a thin shell that delegates all evaluation and metrics tracking
 * to an IVariationProvider (typically the FeaturesClient).
 */
class FlagProxy {
public:
  FlagProxy(const EvaluatedFlag *flag, IVariationProvider *provider,
            const std::string &flagName)
      : _flag(flag), _provider(provider), _flagName(flagName) {
    assert(_provider != nullptr);
    _exists = (_flag != nullptr && _flag->variant.name != "$missing");
  }

  // ==================== Properties ====================

  bool exists() const { return _exists; }

  /// Check if the flag is enabled. Triggers metrics.
  bool enabled() const { return _provider->isEnabledInternal(_flagName); }

  const std::string &name() const { return _flagName; }

  const Variant &variant() const {
    static Variant fallback = Variant::fallbackMissing();
    return _exists ? _flag->variant : fallback;
  }

  ValueType valueType() const {
    return _exists ? _flag->valueType : ValueType::NONE;
  }
  int version() const { return _exists ? _flag->version : 0; }
  const std::string &reason() const {
    static std::string empty;
    return _exists ? _flag->reason : empty;
  }
  bool impressionData() const {
    return _exists ? _flag->impressionData : false;
  }
  const EvaluatedFlag *raw() const { return _exists ? _flag : nullptr; }

  // ==================== Variation Methods ====================

  std::string variation(const std::string &missingValue) const {
    return _provider->variationInternal(_flagName, missingValue);
  }

  bool boolVariation(bool missingValue) const {
    return _provider->boolVariationInternal(_flagName, missingValue);
  }

  std::string stringVariation(const std::string &missingValue) const {
    return _provider->stringVariationInternal(_flagName, missingValue);
  }

  int intVariation(int missingValue) const {
    return _provider->intVariationInternal(_flagName, missingValue);
  }

  float floatVariation(float missingValue) const {
    return _provider->floatVariationInternal(_flagName, missingValue);
  }

  double doubleVariation(double missingValue) const {
    return _provider->doubleVariationInternal(_flagName, missingValue);
  }

  std::string jsonVariation(const std::string &missingValue) const {
    return _provider->jsonVariationInternal(_flagName, missingValue);
  }

  // ==================== Variation Details ====================

  VariationResult<bool> boolVariationDetails(bool missingValue) const {
    return _provider->boolVariationDetailsInternal(_flagName, missingValue);
  }

  VariationResult<std::string>
  stringVariationDetails(const std::string &missingValue) const {
    return _provider->stringVariationDetailsInternal(_flagName, missingValue);
  }

  VariationResult<float> floatVariationDetails(float missingValue) const {
    return _provider->floatVariationDetailsInternal(_flagName, missingValue);
  }

  VariationResult<int> intVariationDetails(int missingValue) const {
    return _provider->intVariationDetailsInternal(_flagName, missingValue);
  }

  VariationResult<double> doubleVariationDetails(double missingValue) const {
    return _provider->doubleVariationDetailsInternal(_flagName, missingValue);
  }

  VariationResult<std::string>
  jsonVariationDetails(const std::string &missingValue) const {
    return _provider->jsonVariationDetailsInternal(_flagName, missingValue);
  }

  // ==================== OrThrow Methods ====================

  bool boolVariationOrThrow() const {
    return _provider->boolVariationOrThrowInternal(_flagName);
  }

  std::string stringVariationOrThrow() const {
    return _provider->stringVariationOrThrowInternal(_flagName);
  }

  float floatVariationOrThrow() const {
    return _provider->floatVariationOrThrowInternal(_flagName);
  }

  int intVariationOrThrow() const {
    return _provider->intVariationOrThrowInternal(_flagName);
  }

  double doubleVariationOrThrow() const {
    return _provider->doubleVariationOrThrowInternal(_flagName);
  }

  std::string jsonVariationOrThrow() const {
    return _provider->jsonVariationOrThrowInternal(_flagName);
  }

private:
  const EvaluatedFlag *_flag;
  IVariationProvider *_provider;
  std::string _flagName;
  bool _exists;
};

} // namespace gatrix

#endif // GATRIX_FLAG_PROXY_H
