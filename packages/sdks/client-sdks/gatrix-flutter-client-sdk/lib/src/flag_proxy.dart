import 'models.dart';
import 'variation_provider.dart';

/// FlagProxy - Thin shell that delegates ALL logic to VariationProvider.
///
/// Architecture per CLIENT_SDK_SPEC:
/// - Holds only flagName + forceRealtime + client reference.
/// - ALL property reads and variation methods delegate to the client.
/// - No deep copy of flag data - always reads live state from FeaturesClient cache.
/// - isRealtime property indicates the proxy's operational mode.
/// - Client is always present (never null).
class FlagProxy {
  final VariationProvider _client;
  final String _flagName;
  final bool _forceRealtime;

  /// Primary constructor used by FeaturesClient internally.
  FlagProxy(this._client, this._flagName, {bool forceRealtime = false})
      : _forceRealtime = forceRealtime;

  /// Named-parameter constructor for test/mock use.
  /// [flag] is optional (null means flag doesn't exist).
  /// [client] is the VariationProvider to delegate to.
  /// [flagName] overrides the flag name (otherwise uses flag.name or '').
  FlagProxy.withFlag(
    EvaluatedFlag? flag, {
    required VariationProvider client,
    String? flagName,
    bool forceRealtime = false,
  })  : _client = client,
        _flagName = flagName ?? flag?.name ?? '',
        _forceRealtime = forceRealtime;

  // ==================== Properties ====================

  String get name => _flagName;

  /// Whether this proxy was created in realtime mode.
  bool get isRealtime => _forceRealtime;

  /// Whether the flag exists in the current cache.
  bool get exists =>
      _client.hasFlagInternal(_flagName, forceRealtime: _forceRealtime);

  /// Check if flag is enabled. Delegates to client for metrics tracking.
  bool get enabled =>
      _client.isEnabledInternal(_flagName, forceRealtime: _forceRealtime);

  Variant get variant =>
      _client.getVariantInternal(_flagName, forceRealtime: _forceRealtime);

  ValueType get valueType =>
      _client.getValueTypeInternal(_flagName, forceRealtime: _forceRealtime);

  int get version =>
      _client.getVersionInternal(_flagName, forceRealtime: _forceRealtime);

  bool get impressionData =>
      _client.getImpressionDataInternal(_flagName,
          forceRealtime: _forceRealtime);

  EvaluatedFlag? get raw =>
      _client.getRawFlagInternal(_flagName, forceRealtime: _forceRealtime);

  String? get reason =>
      _client.getReasonInternal(_flagName, forceRealtime: _forceRealtime);

  // ==================== Variation Methods ====================
  // All methods delegate to client's internal methods.
  // FlagProxy is a convenience shell - no own logic.

  String variation(String fallbackValue) => _client.variationInternal(
      _flagName, fallbackValue,
      forceRealtime: _forceRealtime);

  bool boolVariation(bool fallbackValue) => _client.boolVariationInternal(
      _flagName, fallbackValue,
      forceRealtime: _forceRealtime);

  String stringVariation(String fallbackValue) =>
      _client.stringVariationInternal(_flagName, fallbackValue,
          forceRealtime: _forceRealtime);

  int intVariation(int fallbackValue) => _client.intVariationInternal(
      _flagName, fallbackValue,
      forceRealtime: _forceRealtime);

  double doubleVariation(double fallbackValue) =>
      _client.doubleVariationInternal(_flagName, fallbackValue,
          forceRealtime: _forceRealtime);

  T jsonVariation<T>(T fallbackValue) => _client.jsonVariationInternal<T>(
      _flagName, fallbackValue,
      forceRealtime: _forceRealtime);

  // ==================== Variation Details ====================

  VariationResult<bool> boolVariationDetails(bool fallbackValue) =>
      _client.boolVariationDetailsInternal(_flagName, fallbackValue,
          forceRealtime: _forceRealtime);

  VariationResult<String> stringVariationDetails(String fallbackValue) =>
      _client.stringVariationDetailsInternal(_flagName, fallbackValue,
          forceRealtime: _forceRealtime);

  VariationResult<int> intVariationDetails(int fallbackValue) =>
      _client.intVariationDetailsInternal(_flagName, fallbackValue,
          forceRealtime: _forceRealtime);

  VariationResult<double> doubleVariationDetails(double fallbackValue) =>
      _client.doubleVariationDetailsInternal(_flagName, fallbackValue,
          forceRealtime: _forceRealtime);

  VariationResult<T> jsonVariationDetails<T>(T fallbackValue) =>
      _client.jsonVariationDetailsInternal<T>(_flagName, fallbackValue,
          forceRealtime: _forceRealtime);

  // ==================== Strict Variation Methods (OrThrow) ====================

  bool boolVariationOrThrow() => _client.boolVariationOrThrowInternal(
      _flagName,
      forceRealtime: _forceRealtime);

  String stringVariationOrThrow() => _client.stringVariationOrThrowInternal(
      _flagName,
      forceRealtime: _forceRealtime);

  int intVariationOrThrow() => _client.intVariationOrThrowInternal(_flagName,
      forceRealtime: _forceRealtime);

  double doubleVariationOrThrow() => _client.doubleVariationOrThrowInternal(
      _flagName,
      forceRealtime: _forceRealtime);

  T jsonVariationOrThrow<T>() => _client.jsonVariationOrThrowInternal<T>(
      _flagName,
      forceRealtime: _forceRealtime);
}
