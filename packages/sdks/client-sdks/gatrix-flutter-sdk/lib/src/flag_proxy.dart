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
class FlagProxy {
  final EvaluatedFlag _flag;
  final bool _exists;
  final VariationProvider _client;
  final String _flagName;

  FlagProxy(EvaluatedFlag? flag,
      {required VariationProvider client, String? flagName})
      : _exists = flag != null,
        _flag = flag ?? missingFlag,
        _client = client,
        _flagName = flagName ?? flag?.name ?? '';

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

  String variation(String missingValue) =>
      _client.variationInternal(_flagName, missingValue);

  bool boolVariation(bool missingValue) =>
      _client.boolVariationInternal(_flagName, missingValue);

  String stringVariation(String missingValue) =>
      _client.stringVariationInternal(_flagName, missingValue);

  int intVariation(int missingValue) =>
      _client.intVariationInternal(_flagName, missingValue);

  double doubleVariation(double missingValue) =>
      _client.doubleVariationInternal(_flagName, missingValue);

  T jsonVariation<T>(T missingValue) =>
      _client.jsonVariationInternal<T>(_flagName, missingValue);

  // ==================== Variation Details (pure delegation) ====================

  VariationResult<bool> boolVariationDetails(bool missingValue) =>
      _client.boolVariationDetailsInternal(_flagName, missingValue);

  VariationResult<String> stringVariationDetails(String missingValue) =>
      _client.stringVariationDetailsInternal(_flagName, missingValue);

  VariationResult<int> intVariationDetails(int missingValue) =>
      _client.intVariationDetailsInternal(_flagName, missingValue);

  VariationResult<double> doubleVariationDetails(double missingValue) =>
      _client.doubleVariationDetailsInternal(_flagName, missingValue);

  VariationResult<T> jsonVariationDetails<T>(T missingValue) =>
      _client.jsonVariationDetailsInternal<T>(_flagName, missingValue);

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
