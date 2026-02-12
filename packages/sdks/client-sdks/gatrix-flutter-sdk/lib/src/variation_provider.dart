import 'models.dart';

/// Interface for variation logic delegation.
/// FlagProxy delegates variation calls to this interface,
/// which is implemented by FeaturesClient.
/// This prevents circular dependencies between FlagProxy and FeaturesClient.
///
/// All methods accept an optional [forceRealtime] parameter (default: false).
/// When true, reads from realtimeFlags directly, bypassing explicitSyncMode.
abstract class VariationProvider {
  bool isEnabledInternal(String flagName, {bool forceRealtime = false});
  Variant getVariantInternal(String flagName, {bool forceRealtime = false});
  String variationInternal(String flagName, String fallbackValue,
      {bool forceRealtime = false});
  bool boolVariationInternal(String flagName, bool fallbackValue,
      {bool forceRealtime = false});
  String stringVariationInternal(String flagName, String fallbackValue,
      {bool forceRealtime = false});
  int intVariationInternal(String flagName, int fallbackValue,
      {bool forceRealtime = false});
  double doubleVariationInternal(String flagName, double fallbackValue,
      {bool forceRealtime = false});
  T jsonVariationInternal<T>(String flagName, T fallbackValue,
      {bool forceRealtime = false});

  VariationResult<bool> boolVariationDetailsInternal(
      String flagName, bool fallbackValue,
      {bool forceRealtime = false});
  VariationResult<String> stringVariationDetailsInternal(
      String flagName, String fallbackValue,
      {bool forceRealtime = false});
  VariationResult<int> intVariationDetailsInternal(
      String flagName, int fallbackValue,
      {bool forceRealtime = false});
  VariationResult<double> doubleVariationDetailsInternal(
      String flagName, double fallbackValue,
      {bool forceRealtime = false});
  VariationResult<T> jsonVariationDetailsInternal<T>(
      String flagName, T fallbackValue,
      {bool forceRealtime = false});

  bool boolVariationOrThrowInternal(String flagName, {bool forceRealtime = false});
  String stringVariationOrThrowInternal(String flagName,
      {bool forceRealtime = false});
  int intVariationOrThrowInternal(String flagName, {bool forceRealtime = false});
  double doubleVariationOrThrowInternal(String flagName,
      {bool forceRealtime = false});
  T jsonVariationOrThrowInternal<T>(String flagName, {bool forceRealtime = false});
}
