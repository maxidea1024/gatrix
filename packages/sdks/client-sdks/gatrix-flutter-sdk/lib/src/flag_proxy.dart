import 'models.dart';

class FlagProxy {
  final EvaluatedFlag? _flag;

  FlagProxy(this._flag);

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

  // ==================== Variation Methods ====================

  bool boolVariation(bool defaultValue) {
    if (_flag == null) return defaultValue;
    return _flag!.enabled;
  }

  String variation(String defaultValue) {
    if (_flag == null) return defaultValue;
    return _flag!.variant?.name ?? defaultValue;
  }

  String stringVariation(String defaultValue) {
    final payload = _flag?.variant?.payload;
    if (payload == null) return defaultValue;
    return payload.toString();
  }

  double numberVariation(double defaultValue) {
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
    final payload = _flag?.variant?.payload;
    if (payload == null) return defaultValue;
    if (payload is T) return payload;
    return defaultValue;
  }

  //Details... (skipped for brevity unless needed)
}
