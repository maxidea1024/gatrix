import 'package:flutter/widgets.dart';
import '../src/client.dart';
import '../src/events.dart';
import '../src/flag_proxy.dart';

class GatrixProvider extends StatefulWidget {
  final GatrixClient client;
  final Widget child;

  const GatrixProvider({
    Key? key,
    required this.client,
    required this.child,
  }) : super(key: key);

  static GatrixClient of(BuildContext context) {
    final _InheritedGatrix? result = context.dependOnInheritedWidgetOfExactType<_InheritedGatrix>();
    assert(result != null, 'No GatrixProvider found in context');
    return result!.client;
  }

  @override
  State<GatrixProvider> createState() => _GatrixProviderState();
}

class _GatrixProviderState extends State<GatrixProvider> {
  @override
  void initState() {
    super.initState();
    if (!widget.client.isReady()) {
      widget.client.start();
    }
  }

  @override
  void dispose() {
    // Optionally stop the client when the provider is disposed (typically app-level so never)
    // widget.client.stop();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _InheritedGatrix(
      client: widget.client,
      child: widget.child,
    );
  }
}

class _InheritedGatrix extends InheritedWidget {
  final GatrixClient client;

  const _InheritedGatrix({
    Key? key,
    required this.client,
    required Widget child,
  }) : super(key: key, child: child);

  @override
  bool updateShouldNotify(_InheritedGatrix oldWidget) => client != oldWidget.client;
}

/// A widget that builds itself based on the state of a Gatrix feature flag.
class GatrixFlagBuilder extends StatefulWidget {
  final String flagName;
  final Widget Function(BuildContext context, FlagProxy flag) builder;

  const GatrixFlagBuilder({
    Key? key,
    required this.flagName,
    required this.builder,
  }) : super(key: key);

  @override
  State<GatrixFlagBuilder> createState() => _GatrixFlagBuilderState();
}

class _GatrixFlagBuilderState extends State<GatrixFlagBuilder> {
  GatrixClient? _client;
  late FlagProxy _flag;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final newClient = GatrixProvider.of(context);
    
    if (_client != newClient) {
      _client?.off(GatrixEvents.flagChange(widget.flagName));
      _client?.off(GatrixEvents.flagsReady);
      
      _client = newClient;
      _flag = _client!.features.getFlag(widget.flagName);
      
      _client!.on(GatrixEvents.flagChange(widget.flagName), _onUpdate, name: 'builder_${widget.flagName}');
      _client!.on(GatrixEvents.flagsReady, _onUpdate, name: 'builder_ready_${widget.flagName}');
      _client!.on(GatrixEvents.flagsSync, _onUpdate, name: 'builder_sync_${widget.flagName}');
    }
  }

  void _onUpdate(List<dynamic> args) {
    if (mounted) {
      setState(() {
        _flag = _client!.features.getFlag(widget.flagName);
      });
    }
  }

  @override
  void dispose() {
    _client?.off(GatrixEvents.flagChange(widget.flagName));
    _client?.off(GatrixEvents.flagsReady);
    _client?.off(GatrixEvents.flagsSync);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return widget.builder(context, _flag);
  }
}
