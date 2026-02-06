/**
 * Simple Event Emitter implementation for Gatrix SDK
 * Avoids external dependencies and module import issues
 */

type EventCallback = (...args: any[]) => void | Promise<void>;
type AnyEventCallback = (event: string, ...args: any[]) => void | Promise<void>;

interface EventMap {
  [event: string]: EventCallback[];
}

export class EventEmitter {
  private events: EventMap = {};
  private anyListeners: AnyEventCallback[] = [];

  /**
   * Subscribe to an event
   */
  on(event: string, callback: EventCallback): this {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
    return this;
  }

  /**
   * Subscribe to an event once
   */
  once(event: string, callback: EventCallback): this {
    const onceCallback: EventCallback = (...args) => {
      this.off(event, onceCallback);
      callback(...args);
    };
    return this.on(event, onceCallback);
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
      this.events[event] = this.events[event].filter((cb) => cb !== callback);
    }
    return this;
  }

  /**
   * Subscribe to ALL events
   * Callback receives (eventName, ...args)
   */
  onAny(callback: AnyEventCallback): this {
    this.anyListeners.push(callback);
    return this;
  }

  /**
   * Unsubscribe from ALL events listener
   */
  offAny(callback?: AnyEventCallback): this {
    if (!callback) {
      this.anyListeners = [];
    } else {
      this.anyListeners = this.anyListeners.filter((cb) => cb !== callback);
    }
    return this;
  }

  /**
   * Emit an event
   */
  emit(event: string, ...args: any[]): this {
    // Call specific event listeners
    const callbacks = this.events[event];
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(...args);
        } catch (e) {
          console.error(`EventEmitter: Error in callback for ${event}`, e);
        }
      });
    }

    // Call "any" listeners
    this.anyListeners.forEach((callback) => {
      try {
        callback(event, ...args);
      } catch (e) {
        console.error(`EventEmitter: Error in onAny callback for ${event}`, e);
      }
    });

    return this;
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
