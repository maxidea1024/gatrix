import 'models.dart';
import 'variation_provider.dart';

/// FlagProxy - Thin convenience shell that delegates ALL variation logic
/// to FeaturesClient via VariationProvider.
///
/// Architecture per CLIENT_SDK_SPEC:
/// - Property accessors: `enabled` and `variant` delegate to client for
///   metrics tracking. Other properties read flag data directly.
/// - ALL variation / details / orThrow methods delegate to VariationProvider.
/// - No type checking logic here — that's the VariationProvider's job.
/// - No onAccess callback — metrics tracking is handled by VariationProvider.
/// - FlagProxy does NOT expose forceRealtime; it is available only through
///   FeaturesClient's public methods for direct flag access.
class FlagProxy {
  final EvaluatedFlag _flag;
  final bool _exists;
  final VariationProvider _client;
  final String _flagName;

  FlagProxy(EvaluatedFlag? flag,
      {required VariationProvider client, String? flagName})
      : _exists = flag != null,
        _flagName = flagName ?? flag?.name ?? '',
        _flag = flag ?? createMissingFlag(flagName ?? ''),
        _client = client;

  // ==================== Properties ====================

  String get name => _flagName;
  bool get exists => _exists;

  /// Delegates to client.isEnabledInternal() for metrics tracking
  bool get enabled => _client.isEnabledInternal(_flagName);

  /// Delegates to client.getVariantInternal()
  Variant get variant => _client.getVariantInternal(_flagName);

  // Read-only metadata (no metrics needed)
  ValueType get valueType => _flag.valueType;
  int get version => _flag.version;
  bool get impressionData => _flag.impressionData;
  String? get reason => _flag.reason;
  EvaluatedFlag? get raw => _exists ? _flag : null;

  // ==================== Variation Methods (pure delegation) ====================

  String variation(String fallbackValue) =>
      _client.variationInternal(_flagName, fallbackValue);

  bool boolVariation(bool fallbackValue) =>
      _client.boolVariationInternal(_flagName, fallbackValue);

  String stringVariation(String fallbackValue) =>
      _client.stringVariationInternal(_flagName, fallbackValue);

  int intVariation(int fallbackValue) =>
      _client.intVariationInternal(_flagName, fallbackValue);

  double doubleVariation(double fallbackValue) =>
      _client.doubleVariationInternal(_flagName, fallbackValue);

  T jsonVariation<T>(T fallbackValue) =>
      _client.jsonVariationInternal<T>(_flagName, fallbackValue);

  // ==================== Variation Details (pure delegation) ====================

  VariationResult<bool> boolVariationDetails(bool fallbackValue) =>
      _client.boolVariationDetailsInternal(_flagName, fallbackValue);

  VariationResult<String> stringVariationDetails(String fallbackValue) =>
      _client.stringVariationDetailsInternal(_flagName, fallbackValue);

  VariationResult<int> intVariationDetails(int fallbackValue) =>
      _client.intVariationDetailsInternal(_flagName, fallbackValue);

  VariationResult<double> doubleVariationDetails(double fallbackValue) =>
      _client.doubleVariationDetailsInternal(_flagName, fallbackValue);

  VariationResult<T> jsonVariationDetails<T>(T fallbackValue) =>
      _client.jsonVariationDetailsInternal<T>(_flagName, fallbackValue);

  // ==================== OrThrow Methods (pure delegation) ====================

  bool boolVariationOrThrow() =>
      _client.boolVariationOrThrowInternal(_flagName);

  String stringVariationOrThrow() =>
      _client.stringVariationOrThrowInternal(_flagName);

  int intVariationOrThrow() =>
      _client.intVariationOrThrowInternal(_flagName);

  double doubleVariationOrThrow() =>
      _client.doubleVariationOrThrowInternal(_flagName);

  T jsonVariationOrThrow<T>() =>
      _client.jsonVariationOrThrowInternal<T>(_flagName);
}
