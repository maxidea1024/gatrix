import { EventEmitter } from '../src/event-emitter';

describe('EventEmitter', () => {
  let emitter: EventEmitter;

  beforeEach(() => {
    emitter = new EventEmitter();
  });

  describe('on / emit', () => {
    it('should register and call a listener', () => {
      const callback = jest.fn();
      emitter.on('test', callback);
      emitter.emit('test', 'arg1', 'arg2');
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should support multiple listeners on the same event', () => {
      const cb1 = jest.fn();
      const cb2 = jest.fn();
      emitter.on('test', cb1);
      emitter.on('test', cb2);
      emitter.emit('test');
      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
    });

    it('should not call listeners for other events', () => {
      const callback = jest.fn();
      emitter.on('other', callback);
      emitter.emit('test');
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('once', () => {
    it('should call listener only once', () => {
      const callback = jest.fn();
      emitter.once('test', callback);
      emitter.emit('test');
      emitter.emit('test');
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('off', () => {
    it('should remove a specific listener', () => {
      const cb1 = jest.fn();
      const cb2 = jest.fn();
      emitter.on('test', cb1);
      emitter.on('test', cb2);
      emitter.off('test', cb1);
      emitter.emit('test');
      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).toHaveBeenCalledTimes(1);
    });

    it('should remove all listeners for an event when no callback is provided', () => {
      const cb1 = jest.fn();
      const cb2 = jest.fn();
      emitter.on('test', cb1);
      emitter.on('test', cb2);
      emitter.off('test');
      emitter.emit('test');
      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).not.toHaveBeenCalled();
    });
  });

  describe('onAny / offAny', () => {
    it('should receive all events', () => {
      const callback = jest.fn();
      emitter.onAny(callback);
      emitter.emit('event1', 'a');
      emitter.emit('event2', 'b');
      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenNthCalledWith(1, 'event1', 'a');
      expect(callback).toHaveBeenNthCalledWith(2, 'event2', 'b');
    });

    it('should stop receiving after offAny', () => {
      const callback = jest.fn();
      emitter.onAny(callback);
      emitter.offAny(callback);
      emitter.emit('test');
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('removeAllListeners', () => {
    it('should remove all listeners for a specific event', () => {
      const cb1 = jest.fn();
      const cb2 = jest.fn();
      emitter.on('test', cb1);
      emitter.on('other', cb2);
      emitter.removeAllListeners('test');
      emitter.emit('test');
      emitter.emit('other');
      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).toHaveBeenCalledTimes(1);
    });

    it('should remove ALL listeners when no event is specified', () => {
      const cb1 = jest.fn();
      const cb2 = jest.fn();
      const cbAny = jest.fn();
      emitter.on('test', cb1);
      emitter.on('other', cb2);
      emitter.onAny(cbAny);
      emitter.removeAllListeners();
      emitter.emit('test');
      emitter.emit('other');
      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).not.toHaveBeenCalled();
      expect(cbAny).not.toHaveBeenCalled();
    });
  });

  describe('listenerCount', () => {
    it('should return the number of listeners for an event', () => {
      expect(emitter.listenerCount('test')).toBe(0);
      emitter.on('test', jest.fn());
      expect(emitter.listenerCount('test')).toBe(1);
      emitter.on('test', jest.fn());
      expect(emitter.listenerCount('test')).toBe(2);
    });
  });

  describe('getHandlerStats', () => {
    it('should return statistics about registered handlers', () => {
      emitter.on('test', jest.fn(), 'myHandler');
      emitter.emit('test');
      emitter.emit('test');
      const stats = emitter.getHandlerStats();
      expect(stats['test']).toBeDefined();
      expect(stats['test'].length).toBe(1);
      expect(stats['test'][0].name).toBe('myHandler');
      expect(stats['test'][0].callCount).toBe(2);
    });
  });

  describe('error handling', () => {
    it('should not throw if listener throws', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      emitter.on('test', () => {
        throw new Error('boom');
      });
      expect(() => emitter.emit('test')).not.toThrow();
      consoleSpy.mockRestore();
    });
  });
});
