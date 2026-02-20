#ifndef GATRIX_FLAG_PROXY_H
#define GATRIX_FLAG_PROXY_H

#include "GatrixTypes.h"
#include "GatrixVariationProvider.h"
#include <cassert>
#include <string>

namespace gatrix {

/**
 * FlagProxy - Thin shell that delegates ALL logic to IVariationProvider.
 *
 * Architecture per CLIENT_SDK_SPEC:
 * - Holds only flagName + forceRealtime + provider pointer.
 * - ALL property reads and variation methods delegate to the provider.
 * - No deep copy of flag data - always reads live state from FeaturesClient
 * cache.
 * - isRealtime() indicates the proxy's operational mode.
 * - Provider is always present (never null).
 */
class FlagProxy {
public:
  FlagProxy(IVariationProvider* provider, const std::string& flagName, bool forceRealtime = false)
      : _provider(provider), _flagName(flagName), _forceRealtime(forceRealtime) {
    assert(_provider != nullptr);
  }

  /// Default constructor for use as local variable (e.g. captured in lambda)
  FlagProxy() : _provider(nullptr), _forceRealtime(false) {}

  // ==================== Properties ====================

  const std::string& name() const { return _flagName; }

  /// Whether this proxy was created in realtime mode.
  bool isRealtime() const { return _forceRealtime; }

  /// Whether the flag exists in the current cache.
  bool exists() const { return _provider->hasFlagInternal(_flagName, _forceRealtime); }

  /// Check if the flag is enabled. Delegates to provider for metrics tracking.
  bool enabled() const { return _provider->isEnabledInternal(_flagName, _forceRealtime); }

  Variant variant() const { return _provider->getVariantInternal(_flagName, _forceRealtime); }

  ValueType valueType() const { return _provider->getValueTypeInternal(_flagName, _forceRealtime); }

  int version() const { return _provider->getVersionInternal(_flagName, _forceRealtime); }

  std::string reason() const { return _provider->getReasonInternal(_flagName, _forceRealtime); }

  bool impressionData() const {
    return _provider->getImpressionDataInternal(_flagName, _forceRealtime);
  }

  const EvaluatedFlag* raw() const {
    return _provider->getRawFlagInternal(_flagName, _forceRealtime);
  }

  // ==================== Variation Methods ====================
  // No per-method forceRealtime — uses constructor value.

  std::string variation(const std::string& fallbackValue) const {
    return _provider->variationInternal(_flagName, fallbackValue, _forceRealtime);
  }

  bool boolVariation(bool fallbackValue) const {
    return _provider->boolVariationInternal(_flagName, fallbackValue, _forceRealtime);
  }

  std::string stringVariation(const std::string& fallbackValue) const {
    return _provider->stringVariationInternal(_flagName, fallbackValue, _forceRealtime);
  }

  int intVariation(int fallbackValue) const {
    return _provider->intVariationInternal(_flagName, fallbackValue, _forceRealtime);
  }

  float floatVariation(float fallbackValue) const {
    return _provider->floatVariationInternal(_flagName, fallbackValue, _forceRealtime);
  }

  double doubleVariation(double fallbackValue) const {
    return _provider->doubleVariationInternal(_flagName, fallbackValue, _forceRealtime);
  }

  std::string jsonVariation(const std::string& fallbackValue) const {
    return _provider->jsonVariationInternal(_flagName, fallbackValue, _forceRealtime);
  }

  // ==================== Variation Details ====================

  VariationResult<bool> boolVariationDetails(bool fallbackValue) const {
    return _provider->boolVariationDetailsInternal(_flagName, fallbackValue, _forceRealtime);
  }

  VariationResult<std::string> stringVariationDetails(const std::string& fallbackValue) const {
    return _provider->stringVariationDetailsInternal(_flagName, fallbackValue, _forceRealtime);
  }

  VariationResult<float> floatVariationDetails(float fallbackValue) const {
    return _provider->floatVariationDetailsInternal(_flagName, fallbackValue, _forceRealtime);
  }

  VariationResult<int> intVariationDetails(int fallbackValue) const {
    return _provider->intVariationDetailsInternal(_flagName, fallbackValue, _forceRealtime);
  }

  VariationResult<double> doubleVariationDetails(double fallbackValue) const {
    return _provider->doubleVariationDetailsInternal(_flagName, fallbackValue, _forceRealtime);
  }

  VariationResult<std::string> jsonVariationDetails(const std::string& fallbackValue) const {
    return _provider->jsonVariationDetailsInternal(_flagName, fallbackValue, _forceRealtime);
  }

  // ==================== OrThrow Methods ====================

  bool boolVariationOrThrow() const {
    return _provider->boolVariationOrThrowInternal(_flagName, _forceRealtime);
  }

  std::string stringVariationOrThrow() const {
    return _provider->stringVariationOrThrowInternal(_flagName, _forceRealtime);
  }

  float floatVariationOrThrow() const {
    return _provider->floatVariationOrThrowInternal(_flagName, _forceRealtime);
  }

  int intVariationOrThrow() const {
    return _provider->intVariationOrThrowInternal(_flagName, _forceRealtime);
  }

  double doubleVariationOrThrow() const {
    return _provider->doubleVariationOrThrowInternal(_flagName, _forceRealtime);
  }

  std::string jsonVariationOrThrow() const {
    return _provider->jsonVariationOrThrowInternal(_flagName, _forceRealtime);
  }

private:
  IVariationProvider* _provider;
  std::string _flagName;
  bool _forceRealtime;
};

} // namespace gatrix

#endif // GATRIX_FLAG_PROXY_H
