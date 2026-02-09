#ifndef GATRIX_FLAG_PROXY_H
#define GATRIX_FLAG_PROXY_H

#include "GatrixTypes.h"
#include <cstdlib>
#include <stdexcept>

namespace gatrix {

/**
 * FlagProxy - Convenience wrapper for accessing flag values.
 * Matches the CLIENT_SDK_SPEC.md FlagProxy class definition.
 */
class FlagProxy {
public:
  explicit FlagProxy(const EvaluatedFlag *flag = nullptr) : _flag(flag) {}

  // ==================== Getters (from spec) ====================

  bool exists() const { return _flag != nullptr; }
  bool enabled() const { return _flag ? _flag->enabled : false; }
  const std::string &name() const {
    static std::string empty;
    return _flag ? _flag->name : empty;
  }
  const Variant &variant() const {
    static Variant fallback = Variant::fallbackDisabled();
    return _flag ? _flag->variant : fallback;
  }
  VariantType variantType() const {
    return _flag ? _flag->variantType : VariantType::NONE;
  }
  int version() const { return _flag ? _flag->version : 0; }
  const std::string &reason() const {
    static std::string empty;
    return _flag ? _flag->reason : empty;
  }
  bool impressionData() const { return _flag ? _flag->impressionData : false; }
  const EvaluatedFlag *raw() const { return _flag; }

  // ==================== Variation Methods (defaultValue REQUIRED)
  // ====================

  std::string variation(const std::string &defaultValue) const {
    if (!_flag)
      return defaultValue;
    return _flag->variant.name.empty() ? defaultValue : _flag->variant.name;
  }

  bool boolVariation(bool defaultValue) const {
    if (!_flag)
      return defaultValue;
    return _flag->enabled;
  }

  std::string stringVariation(const std::string &defaultValue) const {
    if (!_flag)
      return defaultValue;
    return _flag->variant.payload.empty() ? defaultValue
                                          : _flag->variant.payload;
  }

  double numberVariation(double defaultValue) const {
    if (!_flag)
      return defaultValue;
    if (_flag->variant.payload.empty())
      return defaultValue;
    char *end;
    double val = std::strtod(_flag->variant.payload.c_str(), &end);
    if (end == _flag->variant.payload.c_str())
      return defaultValue;
    return val;
  }

  int intVariation(int defaultValue) const {
    return static_cast<int>(numberVariation(static_cast<double>(defaultValue)));
  }

  // jsonVariation returns raw payload string (caller parses)
  std::string jsonVariation(const std::string &defaultValue) const {
    if (!_flag)
      return defaultValue;
    return _flag->variant.payload.empty() ? defaultValue
                                          : _flag->variant.payload;
  }

  // ==================== Variation Details (defaultValue REQUIRED)
  // ====================

  VariationResult<bool> boolVariationDetails(bool defaultValue) const {
    if (!_flag)
      return {defaultValue, "flag_not_found", false, false};
    return {_flag->enabled, _flag->reason.empty() ? "evaluated" : _flag->reason,
            true, _flag->enabled};
  }

  VariationResult<std::string>
  stringVariationDetails(const std::string &defaultValue) const {
    if (!_flag)
      return {defaultValue, "flag_not_found", false, false};
    std::string val =
        _flag->variant.payload.empty() ? defaultValue : _flag->variant.payload;
    std::string reason =
        _flag->reason.empty()
            ? (_flag->variant.payload.empty() ? "no_payload" : "evaluated")
            : _flag->reason;
    return {val, reason, true, _flag->enabled};
  }

  VariationResult<double> numberVariationDetails(double defaultValue) const {
    if (!_flag)
      return {defaultValue, "flag_not_found", false, false};
    double val = numberVariation(defaultValue);
    return {val, _flag->reason.empty() ? "evaluated" : _flag->reason, true,
            _flag->enabled};
  }

  // ==================== OrThrow Methods ====================

  bool boolVariationOrThrow() const {
    if (!_flag)
      throw GatrixFeatureError("Flag not found", "FLAG_NOT_FOUND");
    return _flag->enabled;
  }

  std::string stringVariationOrThrow() const {
    if (!_flag)
      throw GatrixFeatureError("Flag not found", "FLAG_NOT_FOUND");
    if (_flag->variant.payload.empty())
      throw GatrixFeatureError("No payload", "NO_PAYLOAD");
    return _flag->variant.payload;
  }

  double numberVariationOrThrow() const {
    if (!_flag)
      throw GatrixFeatureError("Flag not found", "FLAG_NOT_FOUND");
    if (_flag->variant.payload.empty())
      throw GatrixFeatureError("No payload", "NO_PAYLOAD");
    char *end;
    double val = std::strtod(_flag->variant.payload.c_str(), &end);
    if (end == _flag->variant.payload.c_str())
      throw GatrixFeatureError("Invalid number payload", "INVALID_TYPE");
    return val;
  }

  std::string jsonVariationOrThrow() const {
    if (!_flag)
      throw GatrixFeatureError("Flag not found", "FLAG_NOT_FOUND");
    if (_flag->variant.payload.empty())
      throw GatrixFeatureError("No payload", "NO_PAYLOAD");
    return _flag->variant.payload;
  }

private:
  const EvaluatedFlag *_flag;
};

} // namespace gatrix

#endif // GATRIX_FLAG_PROXY_H
