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



/// Sentinel variant for missing flags (flag not found)
const Variant missingVariant = Variant(name: r'$missing', enabled: false);

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

/// Global missing flag sentinel (anonymous)
final EvaluatedFlag missingFlag = EvaluatedFlag(
  name: '',
  enabled: false,
  variant: missingVariant,
);

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

enum StreamingTransport {
  sse,
  webSocket,
}

enum StreamingConnectionState {
  disconnected,
  connecting,
  connected,
  reconnecting,
  degraded,
}

class SseStreamingConfig {
  final String? url;
  final int reconnectBase;
  final int reconnectMax;
  final int pollingJitter;

  const SseStreamingConfig({
    this.url,
    this.reconnectBase = 1,
    this.reconnectMax = 30,
    this.pollingJitter = 5,
  });
}

class WebSocketStreamingConfig {
  final String? url;
  final int reconnectBase;
  final int reconnectMax;
  final int pingInterval;

  const WebSocketStreamingConfig({
    this.url,
    this.reconnectBase = 1,
    this.reconnectMax = 30,
    this.pingInterval = 30,
  });
}

class StreamingConfig {
  final bool enabled;
  final StreamingTransport transport;
  final SseStreamingConfig sse;
  final WebSocketStreamingConfig ws;

  const StreamingConfig({
    this.enabled = false,
    this.transport = StreamingTransport.sse,
    this.sse = const SseStreamingConfig(),
    this.ws = const WebSocketStreamingConfig(),
  });
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
