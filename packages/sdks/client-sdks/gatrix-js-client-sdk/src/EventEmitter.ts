/**
 * Simple Event Emitter implementation for Gatrix SDK
 * Avoids external dependencies and module import issues
 */

type EventCallback = (...args: any[]) => void | Promise<void>;
type AnyEventCallback = (event: string, ...args: any[]) => void | Promise<void>;

interface Listener {
  callback: EventCallback;
  name: string;
  callCount: number;
  isOnce: boolean;
  registeredAt: Date;
}

interface AnyListener {
  callback: AnyEventCallback;
  name: string;
  callCount: number;
  isOnce: boolean;
  registeredAt: Date;
}

interface EventMap {
  [event: string]: Listener[];
}

export class EventEmitter {
  private events: EventMap = {};
  private anyListeners: AnyListener[] = [];
  private static autoNameCount = 0;

  /**
   * Subscribe to an event
   */
  on(event: string, callback: EventCallback, name?: string): this {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push({
      callback,
      name: name ?? `listener_${++EventEmitter.autoNameCount}`,
      callCount: 0,
      isOnce: false,
      registeredAt: new Date(),
    });
    return this;
  }

  /**
   * Subscribe to an event once
   */
  once(event: string, callback: EventCallback, name?: string): this {
    const handlerName = name ?? `once_${++EventEmitter.autoNameCount}`;
    const onceCallback: EventCallback = (...args) => {
      this.off(event, onceCallback);
      callback(...args);
    };
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push({
      callback: onceCallback,
      name: handlerName,
      callCount: 0,
      isOnce: true,
      registeredAt: new Date(),
    });
    return this;
  }

  /**
   * Unsubscribe from an event
   */
  off(event: string, callback?: EventCallback): this {
    if (!this.events[event]) {
      return this;
    }

    if (!callback) {
      delete this.events[event];
    } else {
      this.events[event] = this.events[event].filter((l) => l.callback !== callback);
    }
    return this;
  }

  /**
   * Subscribe to ALL events
   * Callback receives (eventName, ...args)
   */
  onAny(callback: AnyEventCallback, name?: string): this {
    this.anyListeners.push({
      callback,
      name: name ?? `any_${++EventEmitter.autoNameCount}`,
      callCount: 0,
      isOnce: false,
      registeredAt: new Date(),
    });
    return this;
  }

  /**
   * Unsubscribe from ALL events listener
   */
  offAny(callback?: AnyEventCallback): this {
    if (!callback) {
      this.anyListeners = [];
    } else {
      this.anyListeners = this.anyListeners.filter((l) => l.callback !== callback);
    }
    return this;
  }

  /**
   * Emit an event
   */
  emit(event: string, ...args: any[]): this {
    // Call specific event listeners
    const listeners = this.events[event];
    if (listeners) {
      // Use slice to avoid issues if listeners remove themselves during emit
      listeners.slice().forEach((listener) => {
        try {
          listener.callCount++;
          listener.callback(...args);
        } catch (e) {
          console.error(`EventEmitter: Error in callback for ${event}`, e);
        }
      });
    }

    // Call "any" listeners
    this.anyListeners.forEach((listener) => {
      try {
        listener.callCount++;
        listener.callback(event, ...args);
      } catch (e) {
        console.error(`EventEmitter: Error in onAny callback for ${event}`, e);
      }
    });

    return this;
  }

  /**
   * Get event handler statistics
   */
  getHandlerStats(): Record<string, any[]> {
    const stats: Record<string, any[]> = {};

    // Per-event listeners
    for (const [event, listeners] of Object.entries(this.events)) {
      stats[event] = listeners.map((l) => ({
        name: l.name,
        callCount: l.callCount,
        isOnce: l.isOnce,
        registeredAt: l.registeredAt,
      }));
    }

    // Any listeners (special key)
    if (this.anyListeners.length > 0) {
      stats['*'] = this.anyListeners.map((l) => ({
        name: l.name,
        callCount: l.callCount,
        isOnce: l.isOnce,
        registeredAt: l.registeredAt,
      }));
    }

    return stats;
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(event?: string): this {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
      this.anyListeners = [];
    }
    return this;
  }

  /**
   * Get listener count for an event
   */
  listenerCount(event: string): number {
    return this.events[event]?.length ?? 0;
  }
}
