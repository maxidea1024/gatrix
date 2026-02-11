import 'models.dart';

/// Interface for variation logic delegation.
/// FlagProxy delegates variation calls to this interface,
/// which is implemented by FeaturesClient.
/// This prevents circular dependencies between FlagProxy and FeaturesClient.
abstract class VariationProvider {
  bool isEnabledInternal(String flagName);
  Variant getVariantInternal(String flagName);
  String variationInternal(String flagName, String missingValue);
  bool boolVariationInternal(String flagName, bool missingValue);
  String stringVariationInternal(String flagName, String missingValue);
  int intVariationInternal(String flagName, int missingValue);
  double doubleVariationInternal(String flagName, double missingValue);
  T jsonVariationInternal<T>(String flagName, T missingValue);

  VariationResult<bool> boolVariationDetailsInternal(
      String flagName, bool missingValue);
  VariationResult<String> stringVariationDetailsInternal(
      String flagName, String missingValue);
  VariationResult<int> intVariationDetailsInternal(
      String flagName, int missingValue);
  VariationResult<double> doubleVariationDetailsInternal(
      String flagName, double missingValue);
  VariationResult<T> jsonVariationDetailsInternal<T>(
      String flagName, T missingValue);

  bool boolVariationOrThrowInternal(String flagName);
  String stringVariationOrThrowInternal(String flagName);
  int intVariationOrThrowInternal(String flagName);
  double doubleVariationOrThrowInternal(String flagName);
  T jsonVariationOrThrowInternal<T>(String flagName);
}
