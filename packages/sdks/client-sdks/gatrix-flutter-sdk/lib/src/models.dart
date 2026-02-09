import 'package:collection/collection.dart';

enum VariantType {
  none,
  string,
  number,
  json;

  static VariantType parse(String? value) {
    if (value == null) return VariantType.none;
    switch (value.toLowerCase()) {
      case 'string':
        return VariantType.string;
      case 'number':
        return VariantType.number;
      case 'json':
        return VariantType.json;
      default:
        return VariantType.none;
    }
  }

  String toApiString() {
    return name;
  }
}

class Variant {
  final String name;
  final bool enabled;
  final dynamic payload;

  Variant({
    required this.name,
    required this.enabled,
    this.payload,
  });

  factory Variant.fromJson(Map<String, dynamic> json) {
    return Variant(
      name: json['name'] as String,
      enabled: json['enabled'] as bool,
      payload: json['payload'],
    );
  }

  Map<String, dynamic> toJson() => {
        'name': name,
        'enabled': enabled,
        'payload': payload,
      };
}

class EvaluatedFlag {
  final String name;
  final bool enabled;
  final Variant? variant;
  final VariantType variantType;
  final int version;
  final String? reason;
  final bool impressionData;

  EvaluatedFlag({
    required this.name,
    required this.enabled,
    this.variant,
    this.variantType = VariantType.none,
    this.version = 0,
    this.reason,
    this.impressionData = false,
  });

  factory EvaluatedFlag.fromJson(Map<String, dynamic> json) {
    return EvaluatedFlag(
      name: json['name'] as String,
      enabled: json['enabled'] as bool,
      variant: json['variant'] != null ? Variant.fromJson(json['variant'] as Map<String, dynamic>) : null,
      variantType: VariantType.parse(json['variantType'] as String?),
      version: json['version'] as int? ?? 0,
      reason: json['reason'] as String?,
      impressionData: json['impressionData'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() => {
        'name': name,
        'enabled': enabled,
        'variant': variant?.toJson(),
        'variantType': variantType.toApiString(),
        'version': version,
        'reason': reason,
        'impressionData': impressionData,
      };
}

class GatrixContext {
  String? userId;
  String? sessionId;
  String? deviceId;
  String? currentTime;
  Map<String, dynamic>? properties;

  GatrixContext({
    this.userId,
    this.sessionId,
    this.deviceId,
    this.currentTime,
    this.properties,
  });

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> data = <String, dynamic>{};
    if (userId != null) data['userId'] = userId;
    if (sessionId != null) data['sessionId'] = sessionId;
    if (deviceId != null) data['deviceId'] = deviceId;
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
          deviceId == other.deviceId &&
          currentTime == other.currentTime &&
          const DeepCollectionEquality().equals(properties, other.properties);

  @override
  int get hashCode =>
      userId.hashCode ^ sessionId.hashCode ^ deviceId.hashCode ^ currentTime.hashCode ^ const DeepCollectionEquality().hash(properties);

  GatrixContext clone() {
    return GatrixContext(
      userId: userId,
      sessionId: sessionId,
      deviceId: deviceId,
      currentTime: currentTime,
      properties: properties != null ? Map<String, dynamic>.from(properties!) : null,
    );
  }
}
