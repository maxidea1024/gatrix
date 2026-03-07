import 'models.dart';

/// Interface for variation logic delegation.
/// FlagProxy delegates variation calls to this interface,
/// which is implemented by FeaturesClient.
/// This prevents circular dependencies between FlagProxy and FeaturesClient.
///
/// All methods accept an optional [forceRealtime] parameter (default: false).
/// When true, reads from realtimeFlags directly, bypassing explicitSyncMode.
abstract class VariationProvider {
  bool isEnabledInternal(String flagName, {bool forceRealtime = true});
  Variant getVariantInternal(String flagName, {bool forceRealtime = true});

  // Metadata access (no metrics tracking)
  bool hasFlagInternal(String flagName, {bool forceRealtime = true});
  ValueType getValueTypeInternal(String flagName, {bool forceRealtime = true});
  int getVersionInternal(String flagName, {bool forceRealtime = true});
  String? getReasonInternal(String flagName, {bool forceRealtime = true});
  bool getImpressionDataInternal(String flagName, {bool forceRealtime = true});
  EvaluatedFlag? getRawFlagInternal(String flagName, {bool forceRealtime = true});
  String variationInternal(String flagName, String fallbackValue,
      {bool forceRealtime = true});
  bool boolVariationInternal(String flagName, bool fallbackValue,
      {bool forceRealtime = true});
  String stringVariationInternal(String flagName, String fallbackValue,
      {bool forceRealtime = true});
  int intVariationInternal(String flagName, int fallbackValue,
      {bool forceRealtime = true});
  double doubleVariationInternal(String flagName, double fallbackValue,
      {bool forceRealtime = true});
  T jsonVariationInternal<T>(String flagName, T fallbackValue,
      {bool forceRealtime = true});

  VariationResult<bool> boolVariationDetailsInternal(
      String flagName, bool fallbackValue,
      {bool forceRealtime = true});
  VariationResult<String> stringVariationDetailsInternal(
      String flagName, String fallbackValue,
      {bool forceRealtime = true});
  VariationResult<int> intVariationDetailsInternal(
      String flagName, int fallbackValue,
      {bool forceRealtime = true});
  VariationResult<double> doubleVariationDetailsInternal(
      String flagName, double fallbackValue,
      {bool forceRealtime = true});
  VariationResult<T> jsonVariationDetailsInternal<T>(
      String flagName, T fallbackValue,
      {bool forceRealtime = true});

  bool boolVariationOrThrowInternal(String flagName, {bool forceRealtime = true});
  String stringVariationOrThrowInternal(String flagName,
      {bool forceRealtime = true});
  int intVariationOrThrowInternal(String flagName, {bool forceRealtime = true});
  double doubleVariationOrThrowInternal(String flagName,
      {bool forceRealtime = true});
  T jsonVariationOrThrowInternal<T>(String flagName, {bool forceRealtime = true});
}
