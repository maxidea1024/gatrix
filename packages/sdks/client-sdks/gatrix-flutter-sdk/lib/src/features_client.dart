import 'dart:convert';
import 'package:http/http.dart' as http;
import 'models.dart';
import 'events.dart';
import 'flag_proxy.dart';

class FeaturesClient {
  final String _apiUrl;
  final String _apiToken;
  final GatrixContext _context;
  final Map<String, EvaluatedFlag> _flags = {};
  final EventEmitter _events;
  final Map<String, int> _missingFlags = {};

  FeaturesClient({
    required String apiUrl,
    required String apiToken,
    required GatrixContext context,
    required EventEmitter events,
  })  : _apiUrl = apiUrl,
        _apiToken = apiToken,
        _context = context,
        _events = events;

  FlagProxy getFlag(String flagName) {
    if (!_flags.containsKey(flagName)) {
      _countMissing(flagName);
      return FlagProxy(null);
    }
    return FlagProxy(_flags[flagName]);
  }

  List<EvaluatedFlag> getAllFlags() {
    return _flags.values.toList();
  }

  void _countMissing(String flagName) {
    _missingFlags[flagName] = (_missingFlags[flagName] ?? 0) + 1;
  }

  Map<String, int> getMissingFlags() => Map.from(_missingFlags);

  Future<void> fetchFlags() async {
    _events.emit(GatrixEvents.flagsFetchStart);
    try {
      final response = await http.post(
        Uri.parse('$_apiUrl/evaluate-all'),
        headers: {
          'Authorization': 'Bearer $_apiToken',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'context': _context.toJson(),
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final List<dynamic> flagsList = data['flags'] ?? [];
        
        bool changed = false;
        for (var flagJson in flagsList) {
          final flag = EvaluatedFlag.fromJson(flagJson as Map<String, dynamic>);
          if (!_flags.containsKey(flag.name) || _flags[flag.name]!.version != flag.version) {
            _flags[flag.name] = flag;
            changed = true;
            _events.emit(GatrixEvents.flagChange(flag.name), [FlagProxy(flag)]);
          }
        }
        
        if (changed) {
          _events.emit(GatrixEvents.flagsChange);
        }
        _events.emit(GatrixEvents.flagsReady);
      } else {
        _events.emit(GatrixEvents.sdkError, ['HTTP ${response.statusCode}']);
      }
    } catch (e) {
      _events.emit(GatrixEvents.sdkError, [e.toString()]);
    } finally {
      _events.emit(GatrixEvents.flagsFetchEnd);
    }
  }

  Future<void> updateContext(GatrixContext newContext) async {
    // Basic implementation
    _context.userId = newContext.userId;
    _context.properties = newContext.properties;
    await fetchFlags();
  }

  // Variation helpers
  bool boolVariation(String flagName, bool defaultValue) => getFlag(flagName).boolVariation(defaultValue);
  String variation(String flagName, String defaultValue) => getFlag(flagName).variation(defaultValue);
  String stringVariation(String flagName, String defaultValue) => getFlag(flagName).stringVariation(defaultValue);
  double numberVariation(String flagName, double defaultValue) => getFlag(flagName).numberVariation(defaultValue);
  int intVariation(String flagName, int defaultValue) => getFlag(flagName).intVariation(defaultValue);
  T jsonVariation<T>(String flagName, T defaultValue) => getFlag(flagName).jsonVariation<T>(defaultValue);
}
