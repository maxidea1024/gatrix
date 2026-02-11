import 'package:flutter_test/flutter_test.dart';
import 'package:gatrix_flutter_sdk/src/models.dart';
import 'package:gatrix_flutter_sdk/src/events.dart';
import 'package:gatrix_flutter_sdk/src/features_client.dart';

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

FeaturesClient makeClient({
  List<EvaluatedFlag>? bootstrap,
  bool explicitSyncMode = false,
}) {
  final client = FeaturesClient(
    apiUrl: 'https://test.example.com',
    apiToken: 'test-token',
    appName: 'test-app',
    environment: 'test',
    context: GatrixContext(userId: 'test-user'),
    events: EventEmitter(),
    explicitSyncMode: explicitSyncMode,
  );
  if (bootstrap != null) {
    client.applyBootstrapFlags(bootstrap);
  }
  return client;
}

final List<EvaluatedFlag> fullBootstrap = [
  makeFlag(
    name: 'bool-flag',
    enabled: true,
    variantName: 'on',
    variantEnabled: true,
    value: true,
    valueType: ValueType.boolean,
    reason: 'default_variant',
  ),
  makeFlag(
    name: 'string-flag',
    enabled: true,
    variantName: 'greeting',
    variantEnabled: true,
    value: 'hello world',
    valueType: ValueType.string,
  ),
  makeFlag(
    name: 'number-flag',
    enabled: true,
    variantName: 'rate-limit',
    variantEnabled: true,
    value: 42,
    valueType: ValueType.number,
  ),
  makeFlag(
    name: 'float-flag',
    enabled: true,
    variantName: 'ratio',
    variantEnabled: true,
    value: 3.14,
    valueType: ValueType.number,
  ),
  makeFlag(
    name: 'json-flag',
    enabled: true,
    variantName: 'config',
    variantEnabled: true,
    value: {'key': 'value', 'nested': {'a': 1}},
    valueType: ValueType.json,
  ),
  makeFlag(
    name: 'disabled-flag',
    enabled: false,
    variantName: r'$disabled',
    variantEnabled: false,
    value: false,
    valueType: ValueType.boolean,
  ),
];

void main() {
  group('FeaturesClient - Flag Access', () {
    test('hasFlag returns true for existing flag', () {
      final client = makeClient(bootstrap: fullBootstrap);
      expect(client.hasFlag('bool-flag'), true);
      expect(client.hasFlag('nonexistent'), false);
    });

    test('getAllFlags returns all bootstrapped flags', () {
      final client = makeClient(bootstrap: fullBootstrap);
      expect(client.getAllFlags().length, fullBootstrap.length);
    });

    test('getFlag returns FlagProxy for existing flag', () {
      final client = makeClient(bootstrap: fullBootstrap);
      final proxy = client.getFlag('bool-flag');
      expect(proxy.exists, true);
      expect(proxy.name, 'bool-flag');
    });

    test('getFlag returns FlagProxy with exists=false for missing flag', () {
      final client = makeClient(bootstrap: fullBootstrap);
      final proxy = client.getFlag('nonexistent');
      expect(proxy.exists, false);
    });
  });

  group('FeaturesClient - isEnabled', () {
    test('returns true for enabled flag', () {
      final client = makeClient(bootstrap: fullBootstrap);
      expect(client.isEnabled('bool-flag'), true);
    });

    test('returns false for disabled flag', () {
      final client = makeClient(bootstrap: fullBootstrap);
      expect(client.isEnabled('disabled-flag'), false);
    });

    test('returns false for missing flag', () {
      final client = makeClient(bootstrap: fullBootstrap);
      expect(client.isEnabled('nonexistent'), false);
    });
  });

  group('FeaturesClient - getVariant', () {
    test('returns variant for existing flag', () {
      final client = makeClient(bootstrap: fullBootstrap);
      final variant = client.getVariant('bool-flag');
      expect(variant.name, 'on');
      expect(variant.enabled, true);
    });

    test('returns missingVariant for missing flag', () {
      final client = makeClient(bootstrap: fullBootstrap);
      final variant = client.getVariant('nonexistent');
      expect(variant.name, r'$missing');
    });
  });

  group('FeaturesClient - variation()', () {
    test('returns variant name for existing flag', () {
      final client = makeClient(bootstrap: fullBootstrap);
      expect(client.variation('bool-flag', 'fallback'), 'on');
    });

    test('returns variant name regardless of enabled state', () {
      final client = makeClient(bootstrap: fullBootstrap);
      expect(client.variation('disabled-flag', 'fallback'), r'$disabled');
    });

    test('returns missingValue for non-existent flag', () {
      final client = makeClient(bootstrap: fullBootstrap);
      expect(client.variation('nonexistent', 'default'), 'default');
    });
  });

  group('FeaturesClient - boolVariation()', () {
    test('returns boolean value for boolean flag', () {
      final client = makeClient(bootstrap: fullBootstrap);
      expect(client.boolVariation('bool-flag', false), true);
    });

    test('returns missingValue for non-boolean valueType', () {
      final client = makeClient(bootstrap: fullBootstrap);
      expect(client.boolVariation('string-flag', true), true);
    });

    test('returns missingValue for missing flag', () {
      final client = makeClient(bootstrap: fullBootstrap);
      expect(client.boolVariation('nonexistent', true), true);
    });

    test('disabled flag with boolean valueType returns value', () {
      final client = makeClient(bootstrap: fullBootstrap);
      expect(client.boolVariation('disabled-flag', true), false);
    });
  });

  group('FeaturesClient - stringVariation()', () {
    test('returns string value for string flag', () {
      final client = makeClient(bootstrap: fullBootstrap);
      expect(client.stringVariation('string-flag', ''), 'hello world');
    });

    test('returns missingValue for non-string valueType', () {
      final client = makeClient(bootstrap: fullBootstrap);
      expect(client.stringVariation('bool-flag', 'def'), 'def');
    });

    test('returns missingValue for missing flag', () {
      final client = makeClient(bootstrap: fullBootstrap);
      expect(client.stringVariation('nonexistent', 'def'), 'def');
    });
  });

  group('FeaturesClient - intVariation()', () {
    test('returns int value for number flag', () {
      final client = makeClient(bootstrap: fullBootstrap);
      expect(client.intVariation('number-flag', 0), 42);
    });

    test('truncates double to int', () {
      final client = makeClient(bootstrap: fullBootstrap);
      expect(client.intVariation('float-flag', 0), 3);
    });

    test('returns missingValue for non-number valueType', () {
      final client = makeClient(bootstrap: fullBootstrap);
      expect(client.intVariation('bool-flag', 99), 99);
    });

    test('returns missingValue for missing flag', () {
      final client = makeClient(bootstrap: fullBootstrap);
      expect(client.intVariation('nonexistent', 7), 7);
    });
  });

  group('FeaturesClient - doubleVariation()', () {
    test('returns double value for number flag', () {
      final client = makeClient(bootstrap: fullBootstrap);
      expect(client.doubleVariation('float-flag', 0.0), 3.14);
    });

    test('converts int to double', () {
      final client = makeClient(bootstrap: fullBootstrap);
      expect(client.doubleVariation('number-flag', 0.0), 42.0);
    });

    test('returns missingValue for non-number valueType', () {
      final client = makeClient(bootstrap: fullBootstrap);
      expect(client.doubleVariation('string-flag', 99.0), 99.0);
    });

    test('returns missingValue for missing flag', () {
      final client = makeClient(bootstrap: fullBootstrap);
      expect(client.doubleVariation('nonexistent', 7.0), 7.0);
    });
  });

  group('FeaturesClient - jsonVariation()', () {
    test('returns map value for json flag', () {
      final client = makeClient(bootstrap: fullBootstrap);
      final result = client.jsonVariation<Map<String, dynamic>>(
          'json-flag', <String, dynamic>{});
      expect(result['key'], 'value');
      expect((result['nested'] as Map)['a'], 1);
    });

    test('returns missingValue for non-json valueType', () {
      final client = makeClient(bootstrap: fullBootstrap);
      final result = client.jsonVariation<Map<String, dynamic>>(
          'string-flag', {'default': true});
      expect(result['default'], true);
    });

    test('returns missingValue for missing flag', () {
      final client = makeClient(bootstrap: fullBootstrap);
      final result = client.jsonVariation<Map<String, dynamic>>(
          'nonexistent', {'fallback': true});
      expect(result['fallback'], true);
    });
  });

  group('FeaturesClient - Variation Details', () {
    test('boolVariationDetails for existing flag', () {
      final client = makeClient(bootstrap: fullBootstrap);
      final result = client.boolVariationDetails('bool-flag', false);
      expect(result.value, true);
      expect(result.flagExists, true);
      expect(result.enabled, true);
      expect(result.reason, 'default_variant');
    });

    test('boolVariationDetails for missing flag', () {
      final client = makeClient(bootstrap: fullBootstrap);
      final result = client.boolVariationDetails('nonexistent', true);
      expect(result.value, true);
      expect(result.flagExists, false);
      expect(result.reason, 'flag_not_found');
    });

    test('boolVariationDetails type mismatch returns missingValue + reason', () {
      final client = makeClient(bootstrap: fullBootstrap);
      final result = client.boolVariationDetails('string-flag', true);
      expect(result.value, true);
      expect(result.flagExists, true);
      expect(result.reason, contains('type_mismatch'));
    });

    test('stringVariationDetails', () {
      final client = makeClient(bootstrap: fullBootstrap);
      final result = client.stringVariationDetails('string-flag', '');
      expect(result.value, 'hello world');
      expect(result.flagExists, true);
    });

    test('intVariationDetails', () {
      final client = makeClient(bootstrap: fullBootstrap);
      final result = client.intVariationDetails('number-flag', 0);
      expect(result.value, 42);
      expect(result.flagExists, true);
    });

    test('doubleVariationDetails', () {
      final client = makeClient(bootstrap: fullBootstrap);
      final result = client.doubleVariationDetails('float-flag', 0.0);
      expect(result.value, 3.14);
      expect(result.flagExists, true);
    });

    test('jsonVariationDetails', () {
      final client = makeClient(bootstrap: fullBootstrap);
      final result = client.jsonVariationDetails<Map<String, dynamic>>(
          'json-flag', <String, dynamic>{});
      expect(result.value['key'], 'value');
      expect(result.flagExists, true);
    });
  });

  group('FeaturesClient - OrThrow Methods', () {
    test('boolVariationOrThrow returns value', () {
      final client = makeClient(bootstrap: fullBootstrap);
      expect(client.boolVariationOrThrow('bool-flag'), true);
    });

    test('boolVariationOrThrow throws for missing flag', () {
      final client = makeClient(bootstrap: fullBootstrap);
      expect(() => client.boolVariationOrThrow('nonexistent'),
          throwsA(isA<GatrixException>()));
    });

    test('boolVariationOrThrow throws for type mismatch', () {
      final client = makeClient(bootstrap: fullBootstrap);
      expect(() => client.boolVariationOrThrow('string-flag'),
          throwsA(isA<GatrixException>()));
    });

    test('stringVariationOrThrow returns value', () {
      final client = makeClient(bootstrap: fullBootstrap);
      expect(client.stringVariationOrThrow('string-flag'), 'hello world');
    });

    test('stringVariationOrThrow throws for missing flag', () {
      final client = makeClient(bootstrap: fullBootstrap);
      expect(() => client.stringVariationOrThrow('nonexistent'),
          throwsA(isA<GatrixException>()));
    });

    test('intVariationOrThrow returns value', () {
      final client = makeClient(bootstrap: fullBootstrap);
      expect(client.intVariationOrThrow('number-flag'), 42);
    });

    test('intVariationOrThrow throws for missing flag', () {
      final client = makeClient(bootstrap: fullBootstrap);
      expect(() => client.intVariationOrThrow('nonexistent'),
          throwsA(isA<GatrixException>()));
    });

    test('doubleVariationOrThrow returns value', () {
      final client = makeClient(bootstrap: fullBootstrap);
      expect(client.doubleVariationOrThrow('float-flag'), 3.14);
    });

    test('doubleVariationOrThrow throws for type mismatch', () {
      final client = makeClient(bootstrap: fullBootstrap);
      expect(() => client.doubleVariationOrThrow('bool-flag'),
          throwsA(isA<GatrixException>()));
    });

    test('jsonVariationOrThrow returns value', () {
      final client = makeClient(bootstrap: fullBootstrap);
      final result = client
          .jsonVariationOrThrow<Map<String, dynamic>>('json-flag');
      expect(result['key'], 'value');
    });

    test('jsonVariationOrThrow throws for missing flag', () {
      final client = makeClient(bootstrap: fullBootstrap);
      expect(
          () => client
              .jsonVariationOrThrow<Map<String, dynamic>>('nonexistent'),
          throwsA(isA<GatrixException>()));
    });
  });

  group('FeaturesClient - Explicit Sync', () {
    test('isExplicitSyncEnabled returns correct value', () {
      final client1 = makeClient(explicitSyncMode: false);
      expect(client1.isExplicitSyncEnabled(), false);

      final client2 = makeClient(explicitSyncMode: true);
      expect(client2.isExplicitSyncEnabled(), true);
    });

    test('hasPendingSyncFlags returns false when not in sync mode', () {
      final client = makeClient(
          bootstrap: fullBootstrap, explicitSyncMode: false);
      expect(client.hasPendingSyncFlags(), false);
    });

    test('hasPendingSyncFlags returns true when flags are pending', () {
      final client = makeClient(
          bootstrap: fullBootstrap, explicitSyncMode: true);
      expect(client.hasPendingSyncFlags(), true);
    });
  });

  group('FeaturesClient - FlagProxy Delegation', () {
    test('FlagProxy delegates boolVariation to client', () {
      final client = makeClient(bootstrap: fullBootstrap);
      final proxy = client.getFlag('bool-flag');
      expect(proxy.boolVariation(false), true);
    });

    test('FlagProxy delegates stringVariation to client', () {
      final client = makeClient(bootstrap: fullBootstrap);
      final proxy = client.getFlag('string-flag');
      expect(proxy.stringVariation(''), 'hello world');
    });

    test('FlagProxy delegates intVariation to client', () {
      final client = makeClient(bootstrap: fullBootstrap);
      final proxy = client.getFlag('number-flag');
      expect(proxy.intVariation(0), 42);
    });

    test('FlagProxy delegates doubleVariation to client', () {
      final client = makeClient(bootstrap: fullBootstrap);
      final proxy = client.getFlag('float-flag');
      expect(proxy.doubleVariation(0.0), 3.14);
    });

    test('FlagProxy delegates jsonVariation to client', () {
      final client = makeClient(bootstrap: fullBootstrap);
      final proxy = client.getFlag('json-flag');
      final result = proxy.jsonVariation<Map<String, dynamic>>({});
      expect(result['key'], 'value');
    });

    test('FlagProxy delegates boolVariationOrThrow to client', () {
      final client = makeClient(bootstrap: fullBootstrap);
      final proxy = client.getFlag('bool-flag');
      expect(proxy.boolVariationOrThrow(), true);
    });

    test('FlagProxy delegates missing flag correctly', () {
      final client = makeClient(bootstrap: fullBootstrap);
      final proxy = client.getFlag('nonexistent');
      expect(proxy.boolVariation(true), true);
      expect(proxy.stringVariation('def'), 'def');
      expect(proxy.intVariation(99), 99);
      expect(proxy.doubleVariation(99.0), 99.0);
    });
  });

  group('FeaturesClient - Stats', () {
    test('getStats returns expected structure', () {
      final client = makeClient(bootstrap: fullBootstrap);
      final stats = client.getStats();
      expect(stats['totalFlagCount'], fullBootstrap.length);
      expect(stats.containsKey('fetchFlagsCount'), true);
      expect(stats.containsKey('errorCount'), true);
      expect(stats.containsKey('consecutiveFailures'), true);
    });
  });
}
