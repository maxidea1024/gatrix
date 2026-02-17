import 'package:collection/collection.dart';
import 'variant_source.dart';

enum ValueType {
  none,
  string,
  number,
  boolean,
  json;

  static ValueType parse(String? value) {
    if (value == null) return ValueType.none;
    switch (value.toLowerCase()) {
      case 'string':
        return ValueType.string;
      case 'number':
        return ValueType.number;
      case 'boolean':
        return ValueType.boolean;
      case 'json':
        return ValueType.json;
      default:
        return ValueType.none;
    }
  }

  String toApiString() {
    return name;
  }
}

class Variant {
  final String name;
  final bool enabled;
  final dynamic value;

  const Variant({
    required this.name,
    required this.enabled,
    this.value,
  });

  factory Variant.fromJson(Map<String, dynamic> json) {
    return Variant(
      name: json['name'] as String,
      enabled: json['enabled'] as bool,
      value: json['value'] ?? json['payload'],
    );
  }

  Map<String, dynamic> toJson() => {
        'name': name,
        'enabled': enabled,
        'value': value,
      };
}



/// Sentinel variant for disabled flags
const Variant disabledVariant = Variant(name: r'$disabled', enabled: false);

class EvaluatedFlag {
  final String name;
  final bool enabled;
  final Variant variant;
  final ValueType valueType;
  final int version;
  final String? reason;
  final bool impressionData;

  EvaluatedFlag({
    required this.name,
    required this.enabled,
    Variant? variant,
    this.valueType = ValueType.none,
    this.version = 0,
    this.reason,
    this.impressionData = false,
  }) : variant = variant ?? disabledVariant;

  factory EvaluatedFlag.fromJson(Map<String, dynamic> json) {
    return EvaluatedFlag(
      name: json['name'] as String,
      enabled: json['enabled'] as bool,
      variant: json['variant'] != null
          ? Variant.fromJson(json['variant'] as Map<String, dynamic>)
          : null,
      valueType: ValueType.parse(
          (json['valueType'] ?? json['variantType']) as String?),
      version: json['version'] as int? ?? 0,
      reason: json['reason'] as String?,
      impressionData: json['impressionData'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() => {
        'name': name,
        'enabled': enabled,
        'variant': variant.toJson(),
        'valueType': valueType.toApiString(),
        'version': version,
        'reason': reason,
        'impressionData': impressionData,
      };
}


/// Create a missing flag sentinel with per-flag context
EvaluatedFlag createMissingFlag(String flagName) {
  return EvaluatedFlag(
    name: flagName,
    enabled: false,
    variant: Variant(name: VariantSource.missing, enabled: false),
    valueType: ValueType.none,
    version: 0,
  );
}

class VariationResult<T> {
  final T value;
  final String reason;
  final bool flagExists;
  final bool enabled;
  final Variant? variant;

  VariationResult({
    required this.value,
    required this.reason,
    required this.flagExists,
    required this.enabled,
    this.variant,
  });
}

enum SdkState {
  initializing,
  ready,
  error,
  stopped,
}

class GatrixContext {
  String? userId;
  String? sessionId;
  String? currentTime;
  Map<String, dynamic>? properties;

  GatrixContext({
    this.userId,
    this.sessionId,
    this.currentTime,
    this.properties,
  });

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> data = <String, dynamic>{};
    if (userId != null) data['userId'] = userId;
    if (sessionId != null) data['sessionId'] = sessionId;
    if (currentTime != null) data['currentTime'] = currentTime;
    if (properties != null) {
      properties!.forEach((key, value) {
        data[key] = value;
      });
    }
    return data;
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is GatrixContext &&
          userId == other.userId &&
          sessionId == other.sessionId &&
          currentTime == other.currentTime &&
          const DeepCollectionEquality().equals(properties, other.properties);

  @override
  int get hashCode =>
      userId.hashCode ^
      sessionId.hashCode ^
      currentTime.hashCode ^
      const DeepCollectionEquality().hash(properties);

  GatrixContext clone() {
    return GatrixContext(
      userId: userId,
      sessionId: sessionId,
      currentTime: currentTime,
      properties: properties != null
          ? Map<String, dynamic>.from(properties!)
          : null,
    );
  }
}

class GatrixException implements Exception {
  final String message;
  final String? code;

  GatrixException(this.message, {this.code});

  @override
  String toString() =>
      'GatrixException: $message ${code != null ? '($code)' : ''}';
}
