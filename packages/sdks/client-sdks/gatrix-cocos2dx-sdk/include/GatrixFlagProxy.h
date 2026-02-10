#ifndef GATRIX_FLAG_PROXY_H
#define GATRIX_FLAG_PROXY_H

#include "GatrixTypes.h"
#include <algorithm>
#include <cstdlib>
#include <functional>
#include <stdexcept>

namespace gatrix {

/**
 * Callback invoked on every variation/enabled call for metrics tracking.
 */
using FlagAccessCallback = std::function<void(
    const std::string &flagName, const EvaluatedFlag *flag,
    const std::string &eventType, const std::string &variantName)>;

/**
 * FlagProxy - Single source of truth for flag value extraction.
 *
 * Uses null object pattern: _flag is never null internally.
 * onAccess callback is injected by FeaturesClient for metrics tracking.
 * Type safety: valueType is checked strictly to prevent misuse.
 *
 * boolVariation returns variant.value (NOT flag.enabled).
 */
class FlagProxy {
public:
  explicit FlagProxy(const EvaluatedFlag *flag = nullptr,
                     FlagAccessCallback onAccess = nullptr,
                     const std::string &flagName = "")
      : _flag(flag), _exists(flag != nullptr), _onAccess(onAccess),
        _flagName(flagName.empty() ? (flag ? flag->name : "") : flagName) {}

  // ==================== Properties ====================

  bool exists() const { return _exists; }

  /// Check if the flag is enabled. Triggers metrics.
  bool enabled() const {
    if (!_exists) {
      if (_onAccess)
        _onAccess(_flagName, nullptr, "isEnabled", "");
      return false;
    }
    if (_onAccess)
      _onAccess(_flagName, _flag, "isEnabled", _flag->variant.name);
    return _flag->enabled;
  }

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
  // Single source of truth. valueType checked strictly.

  std::string variation(const std::string &missingValue) const {
    if (!_exists) {
      if (_onAccess)
        _onAccess(_flagName, nullptr, "getVariant", "");
      return missingValue;
    }
    if (_onAccess)
      _onAccess(_flagName, _flag, "getVariant", _flag->variant.name);
    return _flag->variant.name.empty() ? missingValue : _flag->variant.name;
  }

  /// Get boolean variation from variant payload.
  /// Strict: valueType must be BOOLEAN.
  /// Returns actual variant value, NOT flag.enabled.
  bool boolVariation(bool missingValue) const {
    if (!_exists) {
      if (_onAccess)
        _onAccess(_flagName, nullptr, "getVariant", "");
      return missingValue;
    }
    if (_onAccess)
      _onAccess(_flagName, _flag, "getVariant", _flag->variant.name);
    if (_flag->valueType != ValueType::NONE &&
        _flag->valueType != ValueType::BOOLEAN) {
      return missingValue;
    }
    const std::string &val = _flag->variant.value;
    if (val.empty())
      return missingValue;
    // Case-insensitive "true"/"false" check
    std::string lower = val;
    std::transform(lower.begin(), lower.end(), lower.begin(), ::tolower);
    return lower == "true";
  }

  /// Get string variation. Strict: valueType must be STRING.
  std::string stringVariation(const std::string &missingValue) const {
    if (!_exists) {
      if (_onAccess)
        _onAccess(_flagName, nullptr, "getVariant", "");
      return missingValue;
    }
    if (_onAccess)
      _onAccess(_flagName, _flag, "getVariant", _flag->variant.name);
    if (_flag->valueType != ValueType::NONE &&
        _flag->valueType != ValueType::STRING) {
      return missingValue;
    }
    return _flag->variant.value;
  }

  /// Get number variation. Strict: valueType must be NUMBER.
  double numberVariation(double missingValue) const {
    if (!_exists) {
      if (_onAccess)
        _onAccess(_flagName, nullptr, "getVariant", "");
      return missingValue;
    }
    if (_onAccess)
      _onAccess(_flagName, _flag, "getVariant", _flag->variant.name);
    if (_flag->valueType != ValueType::NONE &&
        _flag->valueType != ValueType::NUMBER) {
      return missingValue;
    }
    char *end;
    double val = std::strtod(_flag->variant.value.c_str(), &end);
    if (end == _flag->variant.value.c_str())
      return missingValue;
    return val;
  }

  int intVariation(int missingValue) const {
    return static_cast<int>(numberVariation(static_cast<double>(missingValue)));
  }

  float floatVariation(float missingValue) const {
    return static_cast<float>(
        numberVariation(static_cast<double>(missingValue)));
  }

  double doubleVariation(double missingValue) const {
    return numberVariation(missingValue);
  }

  /// Get JSON variation. Strict: valueType must be JSON.
  std::string jsonVariation(const std::string &missingValue) const {
    if (!_exists) {
      if (_onAccess)
        _onAccess(_flagName, nullptr, "getVariant", "");
      return missingValue;
    }
    if (_onAccess)
      _onAccess(_flagName, _flag, "getVariant", _flag->variant.name);
    if (_flag->valueType != ValueType::NONE &&
        _flag->valueType != ValueType::JSON) {
      return missingValue;
    }
    return _flag->variant.value;
  }

  // ==================== Variation Details ====================

  VariationResult<bool> boolVariationDetails(bool missingValue) const {
    if (!_exists) {
      if (_onAccess)
        _onAccess(_flagName, nullptr, "getVariant", "");
      return {missingValue, "flag_not_found", false, false};
    }
    if (_onAccess)
      _onAccess(_flagName, _flag, "getVariant", _flag->variant.name);
    if (_flag->valueType != ValueType::NONE &&
        _flag->valueType != ValueType::BOOLEAN) {
      return {missingValue, "type_mismatch:expected_boolean", true,
              _flag->enabled};
    }
    bool val = boolVariation(missingValue);
    return {val, _flag->reason.empty() ? "evaluated" : _flag->reason, true,
            _flag->enabled};
  }

  VariationResult<std::string>
  stringVariationDetails(const std::string &missingValue) const {
    if (!_exists) {
      if (_onAccess)
        _onAccess(_flagName, nullptr, "getVariant", "");
      return {missingValue, "flag_not_found", false, false};
    }
    if (_onAccess)
      _onAccess(_flagName, _flag, "getVariant", _flag->variant.name);
    if (_flag->valueType != ValueType::NONE &&
        _flag->valueType != ValueType::STRING) {
      return {missingValue, "type_mismatch:expected_string", true,
              _flag->enabled};
    }
    return {_flag->variant.value,
            _flag->reason.empty() ? "evaluated" : _flag->reason, true,
            _flag->enabled};
  }

  VariationResult<double> numberVariationDetails(double missingValue) const {
    if (!_exists) {
      if (_onAccess)
        _onAccess(_flagName, nullptr, "getVariant", "");
      return {missingValue, "flag_not_found", false, false};
    }
    if (_onAccess)
      _onAccess(_flagName, _flag, "getVariant", _flag->variant.name);
    if (_flag->valueType != ValueType::NONE &&
        _flag->valueType != ValueType::NUMBER) {
      return {missingValue, "type_mismatch:expected_number", true,
              _flag->enabled};
    }
    double val = numberVariation(missingValue);
    return {val, _flag->reason.empty() ? "evaluated" : _flag->reason, true,
            _flag->enabled};
  }

  // ==================== OrThrow Methods ====================

  bool boolVariationOrThrow() const {
    if (!_exists) {
      if (_onAccess)
        _onAccess(_flagName, nullptr, "getVariant", "");
      throw GatrixFeatureError("Flag '" + _flagName + "' not found",
                               "FLAG_NOT_FOUND");
    }
    if (_onAccess)
      _onAccess(_flagName, _flag, "getVariant", _flag->variant.name);
    if (_flag->valueType != ValueType::NONE &&
        _flag->valueType != ValueType::BOOLEAN) {
      throw GatrixFeatureError("Flag '" + _flagName +
                                   "' type mismatch: expected boolean",
                               "TYPE_MISMATCH");
    }
    const std::string &val = _flag->variant.value;
    if (val.empty()) {
      throw GatrixFeatureError(
          "Flag '" + _flagName + "' has no boolean payload", "NO_PAYLOAD");
    }
    std::string lower = val;
    std::transform(lower.begin(), lower.end(), lower.begin(), ::tolower);
    return lower == "true";
  }

  std::string stringVariationOrThrow() const {
    if (!_exists) {
      if (_onAccess)
        _onAccess(_flagName, nullptr, "getVariant", "");
      throw GatrixFeatureError("Flag '" + _flagName + "' not found",
                               "FLAG_NOT_FOUND");
    }
    if (_onAccess)
      _onAccess(_flagName, _flag, "getVariant", _flag->variant.name);
    if (_flag->valueType != ValueType::NONE &&
        _flag->valueType != ValueType::STRING) {
      throw GatrixFeatureError("Flag '" + _flagName +
                                   "' type mismatch: expected string",
                               "TYPE_MISMATCH");
    }
    return _flag->variant.value;
  }

  double numberVariationOrThrow() const {
    if (!_exists) {
      if (_onAccess)
        _onAccess(_flagName, nullptr, "getVariant", "");
      throw GatrixFeatureError("Flag '" + _flagName + "' not found",
                               "FLAG_NOT_FOUND");
    }
    if (_onAccess)
      _onAccess(_flagName, _flag, "getVariant", _flag->variant.name);
    if (_flag->valueType != ValueType::NONE &&
        _flag->valueType != ValueType::NUMBER) {
      throw GatrixFeatureError("Flag '" + _flagName +
                                   "' type mismatch: expected number",
                               "TYPE_MISMATCH");
    }
    char *end;
    double val = std::strtod(_flag->variant.value.c_str(), &end);
    if (end == _flag->variant.value.c_str())
      throw GatrixFeatureError("Invalid number value", "INVALID_TYPE");
    return val;
  }

  std::string jsonVariationOrThrow() const {
    if (!_exists) {
      if (_onAccess)
        _onAccess(_flagName, nullptr, "getVariant", "");
      throw GatrixFeatureError("Flag '" + _flagName + "' not found",
                               "FLAG_NOT_FOUND");
    }
    if (_onAccess)
      _onAccess(_flagName, _flag, "getVariant", _flag->variant.name);
    if (_flag->valueType != ValueType::NONE &&
        _flag->valueType != ValueType::JSON) {
      throw GatrixFeatureError("Flag '" + _flagName +
                                   "' type mismatch: expected json",
                               "TYPE_MISMATCH");
    }
    return _flag->variant.value;
  }

private:
  const EvaluatedFlag *_flag;
  bool _exists;
  FlagAccessCallback _onAccess;
  std::string _flagName;
};

} // namespace gatrix

#endif // GATRIX_FLAG_PROXY_H
