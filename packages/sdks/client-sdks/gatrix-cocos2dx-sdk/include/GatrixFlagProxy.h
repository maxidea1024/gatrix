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

  std::string variation(const std::string &fallbackValue,
                        bool forceRealtime = false) const {
    return _provider->variationInternal(_flagName, fallbackValue,
                                        forceRealtime);
  }

  bool boolVariation(bool fallbackValue, bool forceRealtime = false) const {
    return _provider->boolVariationInternal(_flagName, fallbackValue,
                                            forceRealtime);
  }

  std::string stringVariation(const std::string &fallbackValue,
                              bool forceRealtime = false) const {
    return _provider->stringVariationInternal(_flagName, fallbackValue,
                                              forceRealtime);
  }

  int intVariation(int fallbackValue, bool forceRealtime = false) const {
    return _provider->intVariationInternal(_flagName, fallbackValue,
                                           forceRealtime);
  }

  float floatVariation(float fallbackValue, bool forceRealtime = false) const {
    return _provider->floatVariationInternal(_flagName, fallbackValue,
                                             forceRealtime);
  }

  double doubleVariation(double fallbackValue,
                         bool forceRealtime = false) const {
    return _provider->doubleVariationInternal(_flagName, fallbackValue,
                                              forceRealtime);
  }

  std::string jsonVariation(const std::string &fallbackValue,
                            bool forceRealtime = false) const {
    return _provider->jsonVariationInternal(_flagName, fallbackValue,
                                            forceRealtime);
  }

  // ==================== Variation Details ====================

  VariationResult<bool> boolVariationDetails(bool fallbackValue,
                                             bool forceRealtime = false) const {
    return _provider->boolVariationDetailsInternal(_flagName, fallbackValue,
                                                   forceRealtime);
  }

  VariationResult<std::string>
  stringVariationDetails(const std::string &fallbackValue,
                         bool forceRealtime = false) const {
    return _provider->stringVariationDetailsInternal(_flagName, fallbackValue,
                                                     forceRealtime);
  }

  VariationResult<float>
  floatVariationDetails(float fallbackValue, bool forceRealtime = false) const {
    return _provider->floatVariationDetailsInternal(_flagName, fallbackValue,
                                                    forceRealtime);
  }

  VariationResult<int> intVariationDetails(int fallbackValue,
                                           bool forceRealtime = false) const {
    return _provider->intVariationDetailsInternal(_flagName, fallbackValue,
                                                  forceRealtime);
  }

  VariationResult<double>
  doubleVariationDetails(double fallbackValue,
                         bool forceRealtime = false) const {
    return _provider->doubleVariationDetailsInternal(_flagName, fallbackValue,
                                                     forceRealtime);
  }

  VariationResult<std::string>
  jsonVariationDetails(const std::string &fallbackValue,
                       bool forceRealtime = false) const {
    return _provider->jsonVariationDetailsInternal(_flagName, fallbackValue,
                                                   forceRealtime);
  }

  // ==================== OrThrow Methods ====================

  bool boolVariationOrThrow(bool forceRealtime = false) const {
    return _provider->boolVariationOrThrowInternal(_flagName, forceRealtime);
  }

  std::string stringVariationOrThrow(bool forceRealtime = false) const {
    return _provider->stringVariationOrThrowInternal(_flagName, forceRealtime);
  }

  float floatVariationOrThrow(bool forceRealtime = false) const {
    return _provider->floatVariationOrThrowInternal(_flagName, forceRealtime);
  }

  int intVariationOrThrow(bool forceRealtime = false) const {
    return _provider->intVariationOrThrowInternal(_flagName, forceRealtime);
  }

  double doubleVariationOrThrow(bool forceRealtime = false) const {
    return _provider->doubleVariationOrThrowInternal(_flagName, forceRealtime);
  }

  std::string jsonVariationOrThrow(bool forceRealtime = false) const {
    return _provider->jsonVariationOrThrowInternal(_flagName, forceRealtime);
  }

private:
  const EvaluatedFlag *_flag;
  IVariationProvider *_provider;
  std::string _flagName;
  bool _exists;
};

} // namespace gatrix

#endif // GATRIX_FLAG_PROXY_H
