import 'models.dart';

/// Callback invoked on every variation/enabled call for metrics tracking.
typedef FlagAccessCallback = void Function(
  String flagName,
  EvaluatedFlag? flag,
  String eventType,
  String? variantName,
);

/// Null object for non-existent flags
final EvaluatedFlag _missingFlag = EvaluatedFlag(
  name: '',
  enabled: false,
  variant: Variant(name: '\$missing', enabled: false),
  variantType: VariantType.none,
  version: 0,
);

/// FlagProxy - Single source of truth for flag value extraction.
///
/// ALL variation logic lives here. FeaturesClient delegates to FlagProxy
/// so that value extraction + metrics tracking happen in one place.
///
/// Uses null object pattern: _flag is never null.
/// onAccess callback is invoked on every variation/enabled call.
/// Type safety: variantType is checked strictly to prevent misuse.
class FlagProxy {
  final EvaluatedFlag _flag;
  final bool _exists;
  final FlagAccessCallback? _onAccess;
  final String _flagName;

  FlagProxy(EvaluatedFlag? flag, [this._onAccess, String? flagName])
      : _exists = flag != null,
        _flag = flag ?? _missingFlag,
        _flagName = flagName ?? flag?.name ?? '';

  // ==================== Properties ====================

  String get name => _flagName;
  bool get exists => _exists;

  /// Check if the flag is enabled. Triggers metrics.
  bool get enabled {
    if (!_exists) {
      _onAccess?.call(_flagName, null, 'isEnabled', null);
      return false;
    }
    _onAccess?.call(_flagName, _flag, 'isEnabled', _flag.variant?.name);
    return _flag.enabled;
  }

  Variant get variant => _flag.variant ?? Variant(name: '\$missing', enabled: false);
  VariantType get variantType => _flag.variantType;
  int get version => _flag.version;
  bool get impressionData => _flag.impressionData;
  String? get reason => _flag.reason;
  EvaluatedFlag? get raw => _exists ? _flag : null;

  // ==================== Variation Methods ====================
  // Single source of truth. variantType checked strictly.

  /// Get boolean variation from variant payload.
  /// Strict: variantType must be boolean.
  bool boolVariation(bool missingValue) {
    if (!_exists) {
      _onAccess?.call(_flagName, null, 'getVariant', null);
      return missingValue;
    }
    _onAccess?.call(_flagName, _flag, 'getVariant', _flag.variant?.name);
    if (_flag.variantType != VariantType.none &&
        _flag.variantType != VariantType.boolean) {
      return missingValue;
    }
    final payload = _flag.variant?.payload;
    if (payload == null) return missingValue;
    if (payload is bool) return payload;
    // Handle string "true"/"false"
    if (payload is String) {
      return payload.toLowerCase() == 'true';
    }
    return missingValue;
  }

  /// Get variant name.
  String variation(String missingValue) {
    if (!_exists) {
      _onAccess?.call(_flagName, null, 'getVariant', null);
      return missingValue;
    }
    _onAccess?.call(_flagName, _flag, 'getVariant', _flag.variant?.name);
    return _flag.variant?.name ?? missingValue;
  }

  /// Get string variation. Strict: variantType must be string.
  String stringVariation(String missingValue) {
    if (!_exists) {
      _onAccess?.call(_flagName, null, 'getVariant', null);
      return missingValue;
    }
    _onAccess?.call(_flagName, _flag, 'getVariant', _flag.variant?.name);
    if (_flag.variantType != VariantType.none &&
        _flag.variantType != VariantType.string) {
      return missingValue;
    }
    final payload = _flag.variant?.payload;
    if (payload == null) return missingValue;
    return payload.toString();
  }

  /// Get number variation. Strict: variantType must be number.
  double numberVariation(double missingValue) {
    if (!_exists) {
      _onAccess?.call(_flagName, null, 'getVariant', null);
      return missingValue;
    }
    _onAccess?.call(_flagName, _flag, 'getVariant', _flag.variant?.name);
    if (_flag.variantType != VariantType.none &&
        _flag.variantType != VariantType.number) {
      return missingValue;
    }
    final payload = _flag.variant?.payload;
    if (payload == null) return missingValue;
    if (payload is num) return payload.toDouble();
    if (payload is String) {
      return double.tryParse(payload) ?? missingValue;
    }
    return missingValue;
  }

  /// Get integer variation (convenience).
  int intVariation(int missingValue) {
    return numberVariation(missingValue.toDouble()).toInt();
  }

  /// Get JSON variation. Strict: variantType must be json, value must be Map/List.
  T jsonVariation<T>(T missingValue) {
    if (!_exists) {
      _onAccess?.call(_flagName, null, 'getVariant', null);
      return missingValue;
    }
    _onAccess?.call(_flagName, _flag, 'getVariant', _flag.variant?.name);
    if (_flag.variantType != VariantType.none &&
        _flag.variantType != VariantType.json) {
      return missingValue;
    }
    final payload = _flag.variant?.payload;
    if (payload == null) return missingValue;
    if (payload is T) return payload;
    return missingValue;
  }

  // ==================== Variation Details ====================

  VariationResult<bool> boolVariationDetails(bool missingValue) {
    if (!_exists) {
      _onAccess?.call(_flagName, null, 'getVariant', null);
      return VariationResult(
          value: missingValue,
          reason: 'flag_not_found',
          flagExists: false,
          enabled: false);
    }
    _onAccess?.call(_flagName, _flag, 'getVariant', _flag.variant?.name);
    if (_flag.variantType != VariantType.none &&
        _flag.variantType != VariantType.boolean) {
      return VariationResult(
        value: missingValue,
        reason: 'type_mismatch:expected_boolean_got_${_flag.variantType.toApiString()}',
        flagExists: true,
        enabled: _flag.enabled,
      );
    }
    final value = boolVariation(missingValue);
    return VariationResult(
      value: value,
      reason: _flag.reason ?? 'evaluated',
      flagExists: true,
      enabled: _flag.enabled,
      variant: _flag.variant,
    );
  }

  VariationResult<String> stringVariationDetails(String missingValue) {
    if (!_exists) {
      _onAccess?.call(_flagName, null, 'getVariant', null);
      return VariationResult(
          value: missingValue,
          reason: 'flag_not_found',
          flagExists: false,
          enabled: false);
    }
    _onAccess?.call(_flagName, _flag, 'getVariant', _flag.variant?.name);
    if (_flag.variantType != VariantType.none &&
        _flag.variantType != VariantType.string) {
      return VariationResult(
        value: missingValue,
        reason: 'type_mismatch:expected_string_got_${_flag.variantType.toApiString()}',
        flagExists: true,
        enabled: _flag.enabled,
      );
    }
    final payload = _flag.variant?.payload;
    return VariationResult(
      value: payload?.toString() ?? missingValue,
      reason: _flag.reason ?? (payload == null ? 'no_payload' : 'evaluated'),
      flagExists: true,
      enabled: _flag.enabled,
      variant: _flag.variant,
    );
  }

  VariationResult<double> numberVariationDetails(double missingValue) {
    if (!_exists) {
      _onAccess?.call(_flagName, null, 'getVariant', null);
      return VariationResult(
          value: missingValue,
          reason: 'flag_not_found',
          flagExists: false,
          enabled: false);
    }
    _onAccess?.call(_flagName, _flag, 'getVariant', _flag.variant?.name);
    if (_flag.variantType != VariantType.none &&
        _flag.variantType != VariantType.number) {
      return VariationResult(
        value: missingValue,
        reason: 'type_mismatch:expected_number_got_${_flag.variantType.toApiString()}',
        flagExists: true,
        enabled: _flag.enabled,
      );
    }
    final value = numberVariation(missingValue);
    return VariationResult(
      value: value,
      reason: _flag.reason ?? 'evaluated',
      flagExists: true,
      enabled: _flag.enabled,
      variant: _flag.variant,
    );
  }

  VariationResult<T> jsonVariationDetails<T>(T missingValue) {
    if (!_exists) {
      _onAccess?.call(_flagName, null, 'getVariant', null);
      return VariationResult(
          value: missingValue,
          reason: 'flag_not_found',
          flagExists: false,
          enabled: false);
    }
    _onAccess?.call(_flagName, _flag, 'getVariant', _flag.variant?.name);
    if (_flag.variantType != VariantType.none &&
        _flag.variantType != VariantType.json) {
      return VariationResult(
        value: missingValue,
        reason: 'type_mismatch:expected_json_got_${_flag.variantType.toApiString()}',
        flagExists: true,
        enabled: _flag.enabled,
      );
    }
    final payload = _flag.variant?.payload;
    if (payload == null || payload is! T) {
      return VariationResult(
        value: missingValue,
        reason: payload == null ? 'no_payload' : 'type_mismatch:payload_not_object',
        flagExists: true,
        enabled: _flag.enabled,
      );
    }
    return VariationResult(
      value: payload,
      reason: _flag.reason ?? 'evaluated',
      flagExists: true,
      enabled: _flag.enabled,
      variant: _flag.variant,
    );
  }

  // ==================== OrThrow Methods ====================

  bool boolVariationOrThrow() {
    if (!_exists) {
      _onAccess?.call(_flagName, null, 'getVariant', null);
      throw GatrixException('Flag $_flagName not found', code: 'FLAG_NOT_FOUND');
    }
    _onAccess?.call(_flagName, _flag, 'getVariant', _flag.variant?.name);
    if (_flag.variantType != VariantType.none &&
        _flag.variantType != VariantType.boolean) {
      throw GatrixException(
        'Flag $_flagName type mismatch: expected boolean, got ${_flag.variantType.toApiString()}',
        code: 'TYPE_MISMATCH',
      );
    }
    final payload = _flag.variant?.payload;
    if (payload == null) {
      throw GatrixException('Flag $_flagName has no payload', code: 'NO_PAYLOAD');
    }
    if (payload is bool) return payload;
    if (payload is String) return payload.toLowerCase() == 'true';
    throw GatrixException(
      'Flag $_flagName payload is not a valid boolean',
      code: 'TYPE_MISMATCH',
    );
  }

  String stringVariationOrThrow() {
    if (!_exists) {
      _onAccess?.call(_flagName, null, 'getVariant', null);
      throw GatrixException('Flag $_flagName not found', code: 'FLAG_NOT_FOUND');
    }
    _onAccess?.call(_flagName, _flag, 'getVariant', _flag.variant?.name);
    if (_flag.variantType != VariantType.none &&
        _flag.variantType != VariantType.string) {
      throw GatrixException(
        'Flag $_flagName type mismatch: expected string, got ${_flag.variantType.toApiString()}',
        code: 'TYPE_MISMATCH',
      );
    }
    final payload = _flag.variant?.payload;
    if (payload == null) {
      throw GatrixException('Flag $_flagName has no payload', code: 'NO_PAYLOAD');
    }
    return payload.toString();
  }

  double numberVariationOrThrow() {
    if (!_exists) {
      _onAccess?.call(_flagName, null, 'getVariant', null);
      throw GatrixException('Flag $_flagName not found', code: 'FLAG_NOT_FOUND');
    }
    _onAccess?.call(_flagName, _flag, 'getVariant', _flag.variant?.name);
    if (_flag.variantType != VariantType.none &&
        _flag.variantType != VariantType.number) {
      throw GatrixException(
        'Flag $_flagName type mismatch: expected number, got ${_flag.variantType.toApiString()}',
        code: 'TYPE_MISMATCH',
      );
    }
    final payload = _flag.variant?.payload;
    if (payload == null) {
      throw GatrixException('Flag $_flagName has no payload', code: 'NO_PAYLOAD');
    }
    if (payload is num) return payload.toDouble();
    if (payload is String) {
      final parsed = double.tryParse(payload);
      if (parsed != null) return parsed;
    }
    throw GatrixException(
      'Flag $_flagName payload is not a valid number',
      code: 'TYPE_MISMATCH',
    );
  }

  T jsonVariationOrThrow<T>() {
    if (!_exists) {
      _onAccess?.call(_flagName, null, 'getVariant', null);
      throw GatrixException('Flag $_flagName not found', code: 'FLAG_NOT_FOUND');
    }
    _onAccess?.call(_flagName, _flag, 'getVariant', _flag.variant?.name);
    if (_flag.variantType != VariantType.none &&
        _flag.variantType != VariantType.json) {
      throw GatrixException(
        'Flag $_flagName type mismatch: expected json, got ${_flag.variantType.toApiString()}',
        code: 'TYPE_MISMATCH',
      );
    }
    final payload = _flag.variant?.payload;
    if (payload == null) {
      throw GatrixException('Flag $_flagName has no payload', code: 'NO_PAYLOAD');
    }
    if (payload is T) return payload;
    throw GatrixException(
      'Flag $_flagName payload is not a valid object',
      code: 'TYPE_MISMATCH',
    );
  }
}
