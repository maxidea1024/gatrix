import 'package:flutter_test/flutter_test.dart';
import 'package:gatrix_flutter_sdk/src/models.dart';
import 'package:gatrix_flutter_sdk/src/flag_proxy.dart';
import 'package:gatrix_flutter_sdk/src/variation_provider.dart';

// ==================== Test Helpers ====================

EvaluatedFlag makeFlag({
  required String name,
  bool enabled = true,
  String variantName = 'disabled',
  bool variantEnabled = false,
  dynamic value,
  ValueType valueType = ValueType.none,
  int version = 1,
  bool impressionData = false,
  String? reason,
}) {
  return EvaluatedFlag(
    name: name,
    enabled: enabled,
    variant: Variant(name: variantName, enabled: variantEnabled, value: value),
    valueType: valueType,
    version: version,
    impressionData: impressionData,
    reason: reason,
  );
}

/// Simple mock VariationProvider that stores flags and delegates logic
class MockVariationProvider implements VariationProvider {
  final Map<String, EvaluatedFlag> _flags = {};

  void addFlag(EvaluatedFlag flag) => _flags[flag.name] = flag;

  EvaluatedFlag? _getFlag(String name) => _flags[name];

  @override
  bool isEnabledInternal(String flagName, {bool forceRealtime = false}) =>
      _getFlag(flagName)?.enabled ?? false;

  @override
  Variant getVariantInternal(String flagName, {bool forceRealtime = false}) =>
      _getFlag(flagName)?.variant ?? missingVariant;

  @override
  bool hasFlagInternal(String flagName, {bool forceRealtime = false}) =>
      _flags.containsKey(flagName);

  @override
  ValueType getValueTypeInternal(String flagName, {bool forceRealtime = false}) =>
      _getFlag(flagName)?.valueType ?? ValueType.none;

  @override
  int getVersionInternal(String flagName, {bool forceRealtime = false}) =>
      _getFlag(flagName)?.version ?? 0;

  @override
  String? getReasonInternal(String flagName, {bool forceRealtime = false}) =>
      _getFlag(flagName)?.reason;

  @override
  bool getImpressionDataInternal(String flagName, {bool forceRealtime = false}) =>
      _getFlag(flagName)?.impressionData ?? false;

  @override
  EvaluatedFlag? getRawFlagInternal(String flagName, {bool forceRealtime = false}) =>
      _getFlag(flagName);

  @override
  String variationInternal(String flagName, String fallbackValue,
      {bool forceRealtime = false}) {
    final flag = _getFlag(flagName);
    if (flag == null) return fallbackValue;
    return flag.variant.name;
  }

  @override
  bool boolVariationInternal(String flagName, bool fallbackValue,
      {bool forceRealtime = false}) {
    final flag = _getFlag(flagName);
    if (flag == null) return fallbackValue;
    if (flag.valueType != ValueType.boolean) return fallbackValue;
    final val = flag.variant.value;
    if (val == null) return fallbackValue;
    if (val is bool) return val;
    return fallbackValue;
  }

  @override
  String stringVariationInternal(String flagName, String fallbackValue,
      {bool forceRealtime = false}) {
    final flag = _getFlag(flagName);
    if (flag == null) return fallbackValue;
    if (flag.valueType != ValueType.string) return fallbackValue;
    final val = flag.variant.value;
    if (val == null) return fallbackValue;
    return val.toString();
  }

  @override
  int intVariationInternal(String flagName, int fallbackValue,
      {bool forceRealtime = false}) {
    final flag = _getFlag(flagName);
    if (flag == null) return fallbackValue;
    if (flag.valueType != ValueType.number) return fallbackValue;
    final val = flag.variant.value;
    if (val == null) return fallbackValue;
    if (val is num) return val.toInt();
    return fallbackValue;
  }

  @override
  double doubleVariationInternal(String flagName, double fallbackValue,
      {bool forceRealtime = false}) {
    final flag = _getFlag(flagName);
    if (flag == null) return fallbackValue;
    if (flag.valueType != ValueType.number) return fallbackValue;
    final val = flag.variant.value;
    if (val == null) return fallbackValue;
    if (val is num) return val.toDouble();
    return fallbackValue;
  }

  @override
  T jsonVariationInternal<T>(String flagName, T fallbackValue,
      {bool forceRealtime = false}) {
    final flag = _getFlag(flagName);
    if (flag == null) return fallbackValue;
    if (flag.valueType != ValueType.json) return fallbackValue;
    final val = flag.variant.value;
    if (val == null) return fallbackValue;
    if (val is T) return val;
    return fallbackValue;
  }

  @override
  VariationResult<bool> boolVariationDetailsInternal(
          String flagName, bool fallbackValue,
          {bool forceRealtime = false}) =>
      VariationResult(
          value: boolVariationInternal(flagName, fallbackValue),
          reason: _getFlag(flagName) == null ? 'flag_not_found' : 'evaluated',
          flagExists: _getFlag(flagName) != null,
          enabled: _getFlag(flagName)?.enabled ?? false);

  @override
  VariationResult<String> stringVariationDetailsInternal(
          String flagName, String fallbackValue,
          {bool forceRealtime = false}) =>
      VariationResult(
          value: stringVariationInternal(flagName, fallbackValue),
          reason: _getFlag(flagName) == null ? 'flag_not_found' : 'evaluated',
          flagExists: _getFlag(flagName) != null,
          enabled: _getFlag(flagName)?.enabled ?? false);

  @override
  VariationResult<int> intVariationDetailsInternal(
          String flagName, int fallbackValue,
          {bool forceRealtime = false}) =>
      VariationResult(
          value: intVariationInternal(flagName, fallbackValue),
          reason: _getFlag(flagName) == null ? 'flag_not_found' : 'evaluated',
          flagExists: _getFlag(flagName) != null,
          enabled: _getFlag(flagName)?.enabled ?? false);

  @override
  VariationResult<double> doubleVariationDetailsInternal(
          String flagName, double fallbackValue,
          {bool forceRealtime = false}) =>
      VariationResult(
          value: doubleVariationInternal(flagName, fallbackValue),
          reason: _getFlag(flagName) == null ? 'flag_not_found' : 'evaluated',
          flagExists: _getFlag(flagName) != null,
          enabled: _getFlag(flagName)?.enabled ?? false);

  @override
  VariationResult<T> jsonVariationDetailsInternal<T>(
          String flagName, T fallbackValue,
          {bool forceRealtime = false}) =>
      VariationResult(
          value: jsonVariationInternal<T>(flagName, fallbackValue),
          reason: _getFlag(flagName) == null ? 'flag_not_found' : 'evaluated',
          flagExists: _getFlag(flagName) != null,
          enabled: _getFlag(flagName)?.enabled ?? false);

  @override
  bool boolVariationOrThrowInternal(String flagName,
      {bool forceRealtime = false}) {
    final flag = _getFlag(flagName);
    if (flag == null) throw GatrixException('Not found');
    if (flag.valueType != ValueType.boolean) throw GatrixException('Type mismatch');
    final val = flag.variant.value;
    if (val == null) throw GatrixException('No value');
    if (val is bool) return val;
    throw GatrixException('Invalid');
  }

  @override
  String stringVariationOrThrowInternal(String flagName,
      {bool forceRealtime = false}) {
    final flag = _getFlag(flagName);
    if (flag == null) throw GatrixException('Not found');
    if (flag.valueType != ValueType.string) throw GatrixException('Type mismatch');
    final val = flag.variant.value;
    if (val == null) throw GatrixException('No value');
    return val.toString();
  }

  @override
  int intVariationOrThrowInternal(String flagName,
      {bool forceRealtime = false}) {
    final flag = _getFlag(flagName);
    if (flag == null) throw GatrixException('Not found');
    if (flag.valueType != ValueType.number) throw GatrixException('Type mismatch');
    final val = flag.variant.value;
    if (val == null) throw GatrixException('No value');
    if (val is num) return val.toInt();
    throw GatrixException('Invalid');
  }

  @override
  double doubleVariationOrThrowInternal(String flagName,
      {bool forceRealtime = false}) {
    final flag = _getFlag(flagName);
    if (flag == null) throw GatrixException('Not found');
    if (flag.valueType != ValueType.number) throw GatrixException('Type mismatch');
    final val = flag.variant.value;
    if (val == null) throw GatrixException('No value');
    if (val is num) return val.toDouble();
    throw GatrixException('Invalid');
  }

  @override
  T jsonVariationOrThrowInternal<T>(String flagName,
      {bool forceRealtime = false}) {
    final flag = _getFlag(flagName);
    if (flag == null) throw GatrixException('Not found');
    if (flag.valueType != ValueType.json) throw GatrixException('Type mismatch');
    final val = flag.variant.value;
    if (val == null) throw GatrixException('No value');
    if (val is T) return val;
    throw GatrixException('Invalid');
  }
}

void main() {
  // ==================== Model Tests ====================
  group('Variant', () {
    test('fromJson with value field', () {
      final json = {'name': 'dark', 'enabled': true, 'value': 'dark-mode'};
      final variant = Variant.fromJson(json);
      expect(variant.name, 'dark');
      expect(variant.enabled, true);
      expect(variant.value, 'dark-mode');
    });

    test('fromJson with legacy payload field', () {
      final json = {'name': 'dark', 'enabled': true, 'payload': 'old-value'};
      final variant = Variant.fromJson(json);
      expect(variant.value, 'old-value');
    });

    test('fromJson prefers value over payload', () {
      final json = {
        'name': 'dark',
        'enabled': true,
        'value': 'new-value',
        'payload': 'old-value'
      };
      final variant = Variant.fromJson(json);
      expect(variant.value, 'new-value');
    });

    test('toJson outputs value field', () {
      const variant = Variant(name: 'test', enabled: true, value: 42);
      final json = variant.toJson();
      expect(json['value'], 42);
      expect(json.containsKey('payload'), false);
    });
  });

  group('ValueType', () {
    test('parse handles all types', () {
      expect(ValueType.parse('string'), ValueType.string);
      expect(ValueType.parse('number'), ValueType.number);
      expect(ValueType.parse('boolean'), ValueType.boolean);
      expect(ValueType.parse('json'), ValueType.json);
      expect(ValueType.parse(null), ValueType.none);
      expect(ValueType.parse('unknown'), ValueType.none);
    });

    test('parse is case insensitive', () {
      expect(ValueType.parse('STRING'), ValueType.string);
      expect(ValueType.parse('Boolean'), ValueType.boolean);
    });

    test('toApiString returns correct names', () {
      expect(ValueType.string.toApiString(), 'string');
      expect(ValueType.number.toApiString(), 'number');
      expect(ValueType.boolean.toApiString(), 'boolean');
      expect(ValueType.json.toApiString(), 'json');
      expect(ValueType.none.toApiString(), 'none');
    });
  });

  group('EvaluatedFlag', () {
    test('fromJson with valueType field', () {
      final json = {
        'name': 'test-flag',
        'enabled': true,
        'variant': {'name': 'on', 'enabled': true, 'value': true},
        'valueType': 'boolean',
        'version': 3,
      };
      final flag = EvaluatedFlag.fromJson(json);
      expect(flag.name, 'test-flag');
      expect(flag.enabled, true);
      expect(flag.variant.value, true);
      expect(flag.valueType, ValueType.boolean);
      expect(flag.version, 3);
    });

    test('fromJson with legacy variantType field', () {
      final json = {
        'name': 'test-flag',
        'enabled': true,
        'variantType': 'string',
        'version': 1,
      };
      final flag = EvaluatedFlag.fromJson(json);
      expect(flag.valueType, ValueType.string);
    });

    test('variant is non-nullable (uses disabledVariant sentinel)', () {
      final flag = EvaluatedFlag(name: 'test', enabled: false);
      expect(flag.variant.name, r'$disabled');
      expect(flag.variant.enabled, false);
    });

    test('toJson outputs valueType', () {
      final flag = makeFlag(
        name: 'test',
        valueType: ValueType.boolean,
        value: true,
        variantName: 'on',
        variantEnabled: true,
      );
      final json = flag.toJson();
      expect(json['valueType'], 'boolean');
      expect(json.containsKey('variantType'), false);
    });
  });

  group('GatrixContext', () {
    test('does not have deviceId field', () {
      final ctx = GatrixContext(userId: 'user-1', sessionId: 'sess-1');
      final json = ctx.toJson();
      expect(json.containsKey('deviceId'), false);
      expect(json['userId'], 'user-1');
      expect(json['sessionId'], 'sess-1');
    });

    test('includes custom properties', () {
      final ctx = GatrixContext(
        userId: 'u1',
        properties: {'region': 'us-east', 'plan': 'premium'},
      );
      final json = ctx.toJson();
      expect(json['region'], 'us-east');
      expect(json['plan'], 'premium');
    });

    test('equality', () {
      final a = GatrixContext(userId: 'u1', sessionId: 's1');
      final b = GatrixContext(userId: 'u1', sessionId: 's1');
      expect(a, b);
    });

    test('clone creates independent copy', () {
      final original =
          GatrixContext(userId: 'u1', properties: {'key': 'val'});
      final cloned = original.clone();
      cloned.userId = 'u2';
      expect(original.userId, 'u1');
    });
  });

  group('Sentinel values', () {
    test('missingVariant', () {
      expect(missingVariant.name, r'$missing');
      expect(missingVariant.enabled, false);
      expect(missingVariant.value, null);
    });

    test('disabledVariant', () {
      expect(disabledVariant.name, r'$disabled');
      expect(disabledVariant.enabled, false);
    });

    test('missingFlag', () {
      expect(missingFlag.name, '');
      expect(missingFlag.enabled, false);
      expect(missingFlag.variant.name, r'$missing');
    });
  });

  // ==================== FlagProxy Tests ====================
  group('FlagProxy - Properties', () {
    late MockVariationProvider mockClient;

    setUp(() {
      mockClient = MockVariationProvider();
    });

    test('missing flag properties', () {
      final proxy = FlagProxy.withFlag(null, client: mockClient);
      expect(proxy.exists, false);
      expect(proxy.enabled, false); // delegates to client, flag not found -> false
      expect(proxy.name, '');
      expect(proxy.variant.name, r'$missing'); // delegates to client, flag not found -> missingVariant
      expect(proxy.valueType, ValueType.none);
      expect(proxy.version, 0);
      expect(proxy.raw, null);
    });

    test('existing flag properties', () {
      final flag = makeFlag(
        name: 'test-flag',
        enabled: true,
        variantName: 'dark',
        variantEnabled: true,
        value: 'dark-mode',
        valueType: ValueType.string,
        version: 5,
      );
      // Must add to mockClient since enabled/variant delegate to client
      mockClient.addFlag(flag);
      final proxy = FlagProxy.withFlag(flag, client: mockClient);
      expect(proxy.exists, true);
      expect(proxy.enabled, true);
      expect(proxy.name, 'test-flag');
      expect(proxy.variant.name, 'dark');
      expect(proxy.variant.value, 'dark-mode');
      expect(proxy.valueType, ValueType.string);
      expect(proxy.version, 5);
      expect(proxy.impressionData, false);
      expect(proxy.raw, isNotNull);
    });

    test('disabled flag properties', () {
      final flag = makeFlag(
        name: 'disabled-flag',
        enabled: false,
        variantName: 'off',
      );
      mockClient.addFlag(flag);
      final proxy = FlagProxy.withFlag(flag, client: mockClient);
      expect(proxy.exists, true);
      expect(proxy.enabled, false);
    });
  });

  group('FlagProxy - Variation delegation', () {
    late MockVariationProvider mockClient;

    setUp(() {
      mockClient = MockVariationProvider();
      mockClient.addFlag(makeFlag(
        name: 'bool-flag',
        value: true,
        valueType: ValueType.boolean,
        variantName: 'on',
        variantEnabled: true,
      ));
      mockClient.addFlag(makeFlag(
        name: 'string-flag',
        value: 'hello',
        valueType: ValueType.string,
        variantName: 'greeting',
        variantEnabled: true,
      ));
      mockClient.addFlag(makeFlag(
        name: 'number-flag',
        value: 42,
        valueType: ValueType.number,
        variantName: 'rate',
        variantEnabled: true,
      ));
      mockClient.addFlag(makeFlag(
        name: 'json-flag',
        value: {'key': 'value'},
        valueType: ValueType.json,
        variantName: 'config',
        variantEnabled: true,
      ));
    });

    test('variation delegates to client', () {
      final proxy = FlagProxy.withFlag(null, client: mockClient, flagName: 'bool-flag');
      expect(proxy.variation('fallback'), 'on');
    });

    test('boolVariation delegates to client', () {
      final proxy = FlagProxy.withFlag(null, client: mockClient, flagName: 'bool-flag');
      expect(proxy.boolVariation(false), true);
    });

    test('stringVariation delegates to client', () {
      final proxy =
          FlagProxy.withFlag(null, client: mockClient, flagName: 'string-flag');
      expect(proxy.stringVariation(''), 'hello');
    });

    test('intVariation delegates to client', () {
      final proxy =
          FlagProxy.withFlag(null, client: mockClient, flagName: 'number-flag');
      expect(proxy.intVariation(0), 42);
    });

    test('doubleVariation delegates to client', () {
      final proxy =
          FlagProxy.withFlag(null, client: mockClient, flagName: 'number-flag');
      expect(proxy.doubleVariation(0.0), 42.0);
    });

    test('jsonVariation delegates to client', () {
      final proxy = FlagProxy.withFlag(null, client: mockClient, flagName: 'json-flag');
      final result =
          proxy.jsonVariation<Map<String, dynamic>>(<String, dynamic>{});
      expect(result['key'], 'value');
    });

    test('missing flag returns fallbackValue', () {
      final proxy =
          FlagProxy.withFlag(null, client: mockClient, flagName: 'nonexistent');
      expect(proxy.variation('fallback'), 'fallback');
      expect(proxy.boolVariation(true), true);
      expect(proxy.stringVariation('def'), 'def');
      expect(proxy.intVariation(99), 99);
      expect(proxy.doubleVariation(99.0), 99.0);
    });

    test('type mismatch returns fallbackValue', () {
      final proxy =
          FlagProxy.withFlag(null, client: mockClient, flagName: 'string-flag');
      expect(proxy.boolVariation(true), true);
      expect(proxy.intVariation(99), 99);
    });
  });

  group('FlagProxy - Details delegation', () {
    late MockVariationProvider mockClient;

    setUp(() {
      mockClient = MockVariationProvider();
      mockClient.addFlag(makeFlag(
        name: 'bool-flag',
        value: true,
        valueType: ValueType.boolean,
        variantName: 'on',
        variantEnabled: true,
      ));
    });

    test('boolVariationDetails delegates', () {
      final proxy = FlagProxy.withFlag(null, client: mockClient, flagName: 'bool-flag');
      final r = proxy.boolVariationDetails(false);
      expect(r.value, true);
      expect(r.flagExists, true);
    });

    test('details for missing flag', () {
      final proxy =
          FlagProxy.withFlag(null, client: mockClient, flagName: 'nonexistent');
      final r = proxy.boolVariationDetails(true);
      expect(r.value, true);
      expect(r.flagExists, false);
      expect(r.reason, 'flag_not_found');
    });
  });

  group('FlagProxy - OrThrow delegation', () {
    late MockVariationProvider mockClient;

    setUp(() {
      mockClient = MockVariationProvider();
      mockClient.addFlag(makeFlag(
        name: 'bool-flag',
        value: true,
        valueType: ValueType.boolean,
        variantName: 'on',
        variantEnabled: true,
      ));
    });

    test('boolVariationOrThrow delegates', () {
      final proxy = FlagProxy.withFlag(null, client: mockClient, flagName: 'bool-flag');
      expect(proxy.boolVariationOrThrow(), true);
    });

    test('orThrow throws for missing flag', () {
      final proxy =
          FlagProxy.withFlag(null, client: mockClient, flagName: 'nonexistent');
      expect(
          () => proxy.boolVariationOrThrow(), throwsA(isA<GatrixException>()));
    });

    test('orThrow throws for type mismatch', () {
      mockClient.addFlag(makeFlag(
        name: 'str-flag',
        value: 'hello',
        valueType: ValueType.string,
      ));
      final proxy = FlagProxy.withFlag(null, client: mockClient, flagName: 'str-flag');
      expect(
          () => proxy.boolVariationOrThrow(), throwsA(isA<GatrixException>()));
    });
  });
}
