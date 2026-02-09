import 'events.dart';
import 'models.dart';
import 'features_client.dart';

class GatrixClientConfig {
  final String apiUrl;
  final String apiToken;
  final String appName;
  final String environment;
  final bool offlineMode;
  final GatrixContext? initialContext;

  GatrixClientConfig({
    required this.apiUrl,
    required this.apiToken,
    required this.appName,
    required this.environment,
    this.offlineMode = false,
    this.initialContext,
  });
}

class GatrixClient {
  final GatrixClientConfig config;
  final EventEmitter _events = EventEmitter();
  late final FeaturesClient features;
  bool _isReady = false;

  GatrixClient(this.config) {
    features = FeaturesClient(
      apiUrl: config.apiUrl,
      apiToken: config.apiToken,
      context: config.initialContext ?? GatrixContext(),
      events: _events,
    );
  }

  Future<void> start() async {
    if (config.offlineMode) {
      _isReady = true;
      _events.emit(GatrixEvents.flagsReady);
      return;
    }
    await features.fetchFlags();
    _isReady = true;
  }

  bool isReady() => _isReady;

  void on(String event, GatrixEventHandler callback, {String? name}) => _events.on(event, callback, name: name);
  void off(String event, [GatrixEventHandler? callback]) => _events.off(event, callback);
  void once(String event, GatrixEventHandler callback, {String? name}) => _events.once(event, callback, name: name);

  Map<String, dynamic> getStats() {
    return {
      'eventHandlerStats': _events.getHandlerStats(),
      'missingFlags': features.getMissingFlags(),
    };
  }
}
