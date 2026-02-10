import 'events.dart';
import 'models.dart';
import 'features_client.dart';
import 'version.dart' as sdk_version;

class GatrixClientConfig {
  final String apiUrl;
  final String apiToken;
  final String appName;
  final String environment;
  final bool offlineMode;
  final bool explicitSyncMode;
  final int refreshIntervalSeconds;
  final int metricsIntervalSeconds;
  final GatrixContext? initialContext;
  final List<EvaluatedFlag>? bootstrap;
  final Map<String, String>? customHeaders;

  GatrixClientConfig({
    required this.apiUrl,
    required this.apiToken,
    required this.appName,
    required this.environment,
    this.offlineMode = false,
    this.explicitSyncMode = false,
    this.refreshIntervalSeconds = 60,
    this.metricsIntervalSeconds = 30,
    this.initialContext,
    this.bootstrap,
    this.customHeaders,
  });
}

class GatrixClient {
  static String get sdkName => sdk_version.sdkName;
  static String get sdkVersion => sdk_version.sdkVersion;

  final GatrixClientConfig config;
  final EventEmitter _events = EventEmitter();
  late final FeaturesClient features;
  SdkState _state = SdkState.initializing;

  GatrixClient(this.config) {
    features = FeaturesClient(
      apiUrl: config.apiUrl,
      apiToken: config.apiToken,
      appName: config.appName,
      environment: config.environment,
      context: config.initialContext ?? GatrixContext(),
      events: _events,
      explicitSyncMode: config.explicitSyncMode,
      customHeaders: config.customHeaders,
    );
  }

  Future<void> start() async {
    if (_state != SdkState.initializing) return;

    // 1. Initial Local State
    await features.initFromStorage();

    // 2. Start Services
    if (!config.offlineMode) {
      // Immediate fetch
      await features.fetchFlags();
      
      // Setup periodic tasks
      features.startPolling(config.refreshIntervalSeconds);
      features.startMetricsReporting(config.metricsIntervalSeconds);
    }

    _state = SdkState.ready;
    _events.emit(GatrixEvents.flagsReady);
  }

  void stop() {
    features.stop();
    _state = SdkState.stopped;
  }

  bool isReady() => _state == SdkState.ready;
  SdkState get state => _state;

  void on(String event, GatrixEventHandler callback, {String? name}) => _events.on(event, callback, name: name);
  void off(String event, [GatrixEventHandler? callback]) => _events.off(event, callback);
  void once(String event, GatrixEventHandler callback, {String? name}) => _events.once(event, callback, name: name);

  Map<String, dynamic> getStats() {
    return {
      'state': _state.toString(),
      'eventHandlerStats': _events.getHandlerStats(),
      ...features.getStats(),
    };
  }
}
