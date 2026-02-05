import { EventEmitter } from '../src/EventEmitter';

describe('EventEmitter', () => {
    let emitter: EventEmitter;

    beforeEach(() => {
        emitter = new EventEmitter();
    });

    describe('on', () => {
        it('should register event listener', () => {
            const callback = jest.fn();
            emitter.on('test', callback);
            emitter.emit('test');

            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should pass arguments to callback', () => {
            const callback = jest.fn();
            emitter.on('test', callback);
            emitter.emit('test', 'arg1', 'arg2');

            expect(callback).toHaveBeenCalledWith('arg1', 'arg2');
        });

        it('should allow multiple listeners for same event', () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();

            emitter.on('test', callback1);
            emitter.on('test', callback2);
            emitter.emit('test');

            expect(callback1).toHaveBeenCalledTimes(1);
            expect(callback2).toHaveBeenCalledTimes(1);
        });
    });

    describe('once', () => {
        it('should only fire once', () => {
            const callback = jest.fn();
            emitter.once('test', callback);

            emitter.emit('test');
            emitter.emit('test');
            emitter.emit('test');

            expect(callback).toHaveBeenCalledTimes(1);
        });
    });

    describe('off', () => {
        it('should remove specific listener', () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();

            emitter.on('test', callback1);
            emitter.on('test', callback2);
            emitter.off('test', callback1);
            emitter.emit('test');

            expect(callback1).not.toHaveBeenCalled();
            expect(callback2).toHaveBeenCalledTimes(1);
        });

        it('should remove all listeners if no callback specified', () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();

            emitter.on('test', callback1);
            emitter.on('test', callback2);
            emitter.off('test');
            emitter.emit('test');

            expect(callback1).not.toHaveBeenCalled();
            expect(callback2).not.toHaveBeenCalled();
        });
    });

    describe('removeAllListeners', () => {
        it('should remove all listeners for specific event', () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();

            emitter.on('test1', callback1);
            emitter.on('test2', callback2);
            emitter.removeAllListeners('test1');

            emitter.emit('test1');
            emitter.emit('test2');

            expect(callback1).not.toHaveBeenCalled();
            expect(callback2).toHaveBeenCalledTimes(1);
        });

        it('should remove all listeners if no event specified', () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();

            emitter.on('test1', callback1);
            emitter.on('test2', callback2);
            emitter.removeAllListeners();

            emitter.emit('test1');
            emitter.emit('test2');

            expect(callback1).not.toHaveBeenCalled();
            expect(callback2).not.toHaveBeenCalled();
        });
    });

    describe('listenerCount', () => {
        it('should return correct count', () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();

            expect(emitter.listenerCount('test')).toBe(0);

            emitter.on('test', callback1);
            expect(emitter.listenerCount('test')).toBe(1);

            emitter.on('test', callback2);
            expect(emitter.listenerCount('test')).toBe(2);

            emitter.off('test', callback1);
            expect(emitter.listenerCount('test')).toBe(1);

            emitter.off('test', callback2);
            expect(emitter.listenerCount('test')).toBe(0);
        });
    });
});
