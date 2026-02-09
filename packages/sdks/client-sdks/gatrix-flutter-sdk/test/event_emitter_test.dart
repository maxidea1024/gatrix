import 'package:flutter_test/flutter_test.dart';
import 'package:gatrix_flutter_sdk/src/events.dart';

void main() {
  group('EventEmitter Tests', () {
    late EventEmitter emitter;

    setUp(() {
      emitter = EventEmitter();
    });

    test('should emit and receive events', () {
      bool called = false;
      emitter.on('test', (args) {
        called = true;
        expect(args[0], 'hello');
      });

      emitter.emit('test', ['hello']);
      expect(called, true);
    });

    test('once should only fire once', () {
      int count = 0;
      emitter.once('test', (args) {
        count++;
      });

      emitter.emit('test');
      emitter.emit('test');
      expect(count, 1);
    });

    test('off should remove listener', () {
      int count = 0;
      void callback(args) => count++;
      
      emitter.on('test', callback);
      emitter.off('test', callback);
      
      emitter.emit('test');
      expect(count, 0);
    });
  });
}
