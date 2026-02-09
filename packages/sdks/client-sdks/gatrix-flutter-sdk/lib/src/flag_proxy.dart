import 'models.dart';

class FlagProxy {
  final EvaluatedFlag? _flag;
  final Function(String, Map<String, dynamic>)? _onTrack;

  FlagProxy(this._flag, [this._onTrack]);

  static final Variant _fallbackVariant = Variant(
    name: 'disabled',
    enabled: false,
  );

  String get name => _flag?.name ?? '';
  bool get exists => _flag != null;
  bool get enabled => _flag?.enabled ?? false;
  Variant get variant => _flag?.variant ?? _fallbackVariant;
  VariantType get variantType => _flag?.variantType ?? VariantType.none;
  int get version => _flag?.version ?? 0;
  bool get impressionData => _flag?.impressionData ?? false;
  String? get reason => _flag?.reason;
  EvaluatedFlag? get raw => _flag;

  void _track(String method, [dynamic value]) {
    if (_flag != null && _onTrack != null) {
      _onTrack!(name, {
        'method': method,
        'enabled': _flag!.enabled,
        'variant': _flag!.variant?.name,
        'value': value,
      });
    }
  }

  // ==================== Variation Methods ====================

  bool boolVariation(bool defaultValue) {
    _track('boolVariation');
    if (_flag == null) return defaultValue;
    return _flag!.enabled;
  }

  String variation(String defaultValue) {
    _track('variation');
    if (_flag == null) return defaultValue;
    return _flag!.variant?.name ?? defaultValue;
  }

  String stringVariation(String defaultValue) {
    _track('stringVariation');
    final payload = _flag?.variant?.payload;
    if (payload == null) return defaultValue;
    return payload.toString();
  }

  double numberVariation(double defaultValue) {
    _track('numberVariation');
    final payload = _flag?.variant?.payload;
    if (payload == null) return defaultValue;
    if (payload is num) return payload.toDouble();
    if (payload is String) {
      return double.tryParse(payload) ?? defaultValue;
    }
    return defaultValue;
  }

  int intVariation(int defaultValue) {
    return numberVariation(defaultValue.toDouble()).toInt();
  }

  T jsonVariation<T>(T defaultValue) {
    _track('jsonVariation');
    final payload = _flag?.variant?.payload;
    if (payload == null) return defaultValue;
    if (payload is T) return payload;
    return defaultValue;
  }

  // ==================== Variation Details ====================

  VariationResult<bool> boolVariationDetails(bool defaultValue) {
    _track('boolVariationDetails');
    if (_flag == null) {
      return VariationResult(value: defaultValue, reason: 'flag_not_found', flagExists: false, enabled: false);
    }
    return VariationResult(
      value: _flag!.enabled,
      reason: _flag!.reason ?? 'evaluated',
      flagExists: true,
      enabled: _flag!.enabled,
      variant: _flag!.variant,
    );
  }

  VariationResult<String> stringVariationDetails(String defaultValue) {
    _track('stringVariationDetails');
    if (_flag == null) {
      return VariationResult(value: defaultValue, reason: 'flag_not_found', flagExists: false, enabled: false);
    }
    final payload = _flag!.variant?.payload;
    return VariationResult(
      value: payload?.toString() ?? defaultValue,
      reason: _flag!.reason ?? (payload == null ? 'no_payload' : 'evaluated'),
      flagExists: true,
      enabled: _flag!.enabled,
      variant: _flag!.variant,
    );
  }

  // ==================== OrThrow Methods ====================

  bool boolVariationOrThrow() {
    if (_flag == null) throw GatrixException('Flag $name not found', code: 'FLAG_NOT_FOUND');
    return boolVariation(false);
  }

  String stringVariationOrThrow() {
    if (_flag == null) throw GatrixException('Flag $name not found', code: 'FLAG_NOT_FOUND');
    final val = stringVariation('');
    if (val.isEmpty && _flag!.variant?.payload == null) {
       throw GatrixException('Flag $name has no payload', code: 'NO_PAYLOAD');
    }
    return val;
  }
}
