import 'package:flutter/widgets.dart';
import '../src/client.dart';
import '../src/events.dart';

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
  _GatrixProviderState createState() => _GatrixProviderState();
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

class GatrixFlagBuilder extends StatefulWidget {
  final String flagName;
  final Widget Function(BuildContext context, bool enabled) builder;

  const GatrixFlagBuilder({
    Key? key,
    required this.flagName,
    required this.builder,
  }) : super(key: key);

  @override
  _GatrixFlagBuilderState createState() => _GatrixFlagBuilderState();
}

class _GatrixFlagBuilderState extends State<GatrixFlagBuilder> {
  late GatrixClient _client;
  bool _enabled = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _client = GatrixProvider.of(context);
    _enabled = _client.features.boolVariation(widget.flagName, false);
    
    // Listen for changes
    _client.on(GatrixEvents.flagChange(widget.flagName), _onFlagChange, name: 'builder_${widget.flagName}');
    _client.on(GatrixEvents.flagsReady, _onUpdate, name: 'builder_ready_${widget.flagName}');
  }

  void _onFlagChange(List<dynamic> args) {
    if (mounted) {
      setState(() {
        _enabled = _client.features.boolVariation(widget.flagName, false);
      });
    }
  }

  void _onUpdate(List<dynamic> args) {
    if (mounted) {
      setState(() {
        _enabled = _client.features.boolVariation(widget.flagName, false);
      });
    }
  }

  @override
  void dispose() {
    _client.off(GatrixEvents.flagChange(widget.flagName));
    _client.off(GatrixEvents.flagsReady);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return widget.builder(context, _enabled);
  }
}
