#ifndef GATRIX_VARIATION_PROVIDER_H
#define GATRIX_VARIATION_PROVIDER_H

#include "GatrixTypes.h"
#include <string>

namespace gatrix {

/**
 * Interface for feature flag variation resolution.
 * FlagProxy delegates all variation calls to an implementation of this
 * interface (typically FeaturesClient) to ensure consistent metrics tracking
 * and logic.
 */
class IVariationProvider {
public:
  virtual ~IVariationProvider() = default;

  virtual bool isEnabledInternal(const std::string& flagName, bool forceRealtime = false) = 0;
  virtual Variant getVariantInternal(const std::string& flagName, bool forceRealtime = false) = 0;

  // Metadata access (no metrics tracking)
  virtual bool hasFlagInternal(const std::string& flagName, bool forceRealtime = false) const = 0;
  virtual ValueType getValueTypeInternal(const std::string& flagName,
                                         bool forceRealtime = false) const = 0;
  virtual int getVersionInternal(const std::string& flagName, bool forceRealtime = false) const = 0;
  virtual std::string getReasonInternal(const std::string& flagName,
                                        bool forceRealtime = false) const = 0;
  virtual bool getImpressionDataInternal(const std::string& flagName,
                                         bool forceRealtime = false) const = 0;
  virtual const EvaluatedFlag* getRawFlagInternal(const std::string& flagName,
                                                  bool forceRealtime = false) const = 0;

  virtual std::string variationInternal(const std::string& flagName,
                                        const std::string& fallbackValue,
                                        bool forceRealtime = false) = 0;
  virtual bool boolVariationInternal(const std::string& flagName, bool fallbackValue,
                                     bool forceRealtime = false) = 0;
  virtual std::string stringVariationInternal(const std::string& flagName,
                                              const std::string& fallbackValue,
                                              bool forceRealtime = false) = 0;
  virtual float floatVariationInternal(const std::string& flagName, float fallbackValue,
                                       bool forceRealtime = false) = 0;
  virtual int intVariationInternal(const std::string& flagName, int fallbackValue,
                                   bool forceRealtime = false) = 0;
  virtual double doubleVariationInternal(const std::string& flagName, double fallbackValue,
                                         bool forceRealtime = false) = 0;
  virtual std::string jsonVariationInternal(const std::string& flagName,
                                            const std::string& fallbackValue,
                                            bool forceRealtime = false) = 0;

  virtual VariationResult<bool> boolVariationDetailsInternal(const std::string& flagName,
                                                             bool fallbackValue,
                                                             bool forceRealtime = false) = 0;
  virtual VariationResult<std::string>
  stringVariationDetailsInternal(const std::string& flagName, const std::string& fallbackValue,
                                 bool forceRealtime = false) = 0;
  virtual VariationResult<float> floatVariationDetailsInternal(const std::string& flagName,
                                                               float fallbackValue,
                                                               bool forceRealtime = false) = 0;
  virtual VariationResult<int> intVariationDetailsInternal(const std::string& flagName,
                                                           int fallbackValue,
                                                           bool forceRealtime = false) = 0;
  virtual VariationResult<double> doubleVariationDetailsInternal(const std::string& flagName,
                                                                 double fallbackValue,
                                                                 bool forceRealtime = false) = 0;
  virtual VariationResult<std::string>
  jsonVariationDetailsInternal(const std::string& flagName, const std::string& fallbackValue,
                               bool forceRealtime = false) = 0;

  virtual bool boolVariationOrThrowInternal(const std::string& flagName,
                                            bool forceRealtime = false) = 0;
  virtual std::string stringVariationOrThrowInternal(const std::string& flagName,
                                                     bool forceRealtime = false) = 0;
  virtual float floatVariationOrThrowInternal(const std::string& flagName,
                                              bool forceRealtime = false) = 0;
  virtual int intVariationOrThrowInternal(const std::string& flagName,
                                          bool forceRealtime = false) = 0;
  virtual double doubleVariationOrThrowInternal(const std::string& flagName,
                                                bool forceRealtime = false) = 0;
  virtual std::string jsonVariationOrThrowInternal(const std::string& flagName,
                                                   bool forceRealtime = false) = 0;
};

} // namespace gatrix

#endif // GATRIX_VARIATION_PROVIDER_H
