import 'package:flutter/material.dart';
import 'package:gatrix_flutter_sdk/gatrix_flutter_sdk.dart';

void main() async {
  final client = GatrixClient(
    GatrixClientConfig(
      apiUrl: 'https://your-gatrix-server.com/api/v1',
      apiToken: 'your-client-api-token',
      appName: 'flutter-example',
      environment: 'production',
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
              builder: (context, enabled) {
                return Text(
                  'New Feature is: ${enabled ? 'ON' : 'OFF'}',
                  style: const TextStyle(fontSize: 24),
                );
              },
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: () {
                final client = GatrixProvider.of(context);
                final stats = client.getStats();
                print('Stats: $stats');
              },
              child: const Text('Check Stats'),
            ),
          ],
        ),
      ),
    );
  }
}
