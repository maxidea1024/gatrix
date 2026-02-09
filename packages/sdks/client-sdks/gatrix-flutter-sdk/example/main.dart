import 'package:flutter/material.dart';
import 'package:gatrix_flutter_sdk/gatrix_flutter_sdk.dart';

void main() async {
  // Ensure Flutter is initialized for SharedPreferences
  WidgetsFlutterBinding.ensureInitialized();

  final client = GatrixClient(
    GatrixClientConfig(
      apiUrl: 'https://your-gatrix-server.com/api/v1',
      apiToken: 'your-client-api-token',
      appName: 'flutter-example',
      environment: 'production',
      refreshIntervalSeconds: 30,
    ),
  );

  runApp(
    GatrixProvider(
      client: client,
      child: const MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Gatrix Flutter Example',
      theme: ThemeData(primarySwatch: Colors.blue),
      home: const HomeScreen(),
    );
  }
}

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Gatrix Example')),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            GatrixFlagBuilder(
              flagName: 'new_feature',
              builder: (context, flag) {
                return Column(
                  children: [
                    Text(
                      'Flag: ${flag.name}',
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                    Icon(
                      flag.enabled ? Icons.check_circle : Icons.cancel,
                      color: flag.enabled ? Colors.green : Colors.red,
                      size: 48,
                    ),
                    Text('Reason: ${flag.reason ?? "Unknown"}'),
                  ],
                );
              },
            ),
            const SizedBox(height: 40),
            ElevatedButton(
              onPressed: () async {
                final client = GatrixProvider.of(context);
                await client.features.updateContext(GatrixContext(
                  userId: 'user_123',
                  properties: {'premium': true},
                ));
              },
              child: const Text('Update Context'),
            ),
            TextButton(
              onPressed: () {
                final client = GatrixProvider.of(context);
                print('SDK Stats: ${client.getStats()}');
              },
              child: const Text('Print Debug Stats'),
            ),
          ],
        ),
      ),
    );
  }
}
