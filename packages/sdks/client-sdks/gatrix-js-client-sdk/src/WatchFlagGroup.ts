/**
 * WatchFlagGroup - Group multiple flag watchers for batch management
 * Provides convenience for registering/unregistering multiple watchers at once
 */
import { FeaturesClient } from './FeaturesClient';
import { FlagProxy } from './FlagProxy';

export class WatchFlagGroup {
  private client: FeaturesClient;
  private name: string;
  private unsubscribers: Array<() => void> = [];

  constructor(client: FeaturesClient, name: string) {
    this.client = client;
    this.name = name;
  }

  /**
   * Get the group name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Watch a flag for realtime changes and add to this group.
   * Returns this group for chaining.
   */
  watchRealtimeFlag(flagName: string, callback: (flag: FlagProxy) => void | Promise<void>): this {
    const unsubscribe = this.client.watchRealtimeFlag(flagName, callback);
    this.unsubscribers.push(unsubscribe);
    return this;
  }

  /**
   * Watch a flag for realtime changes with initial state and add to this group.
   * Returns this group for chaining.
   */
  watchRealtimeFlagWithInitialState(
    flagName: string,
    callback: (flag: FlagProxy) => void | Promise<void>
  ): this {
    const unsubscribe = this.client.watchRealtimeFlagWithInitialState(flagName, callback);
    this.unsubscribers.push(unsubscribe);
    return this;
  }

  /**
   * Watch a flag for synced changes and add to this group.
   * Returns this group for chaining.
   */
  watchSyncedFlag(flagName: string, callback: (flag: FlagProxy) => void | Promise<void>): this {
    const unsubscribe = this.client.watchSyncedFlag(flagName, callback);
    this.unsubscribers.push(unsubscribe);
    return this;
  }

  /**
   * Watch a flag for synced changes with initial state and add to this group.
   * Returns this group for chaining.
   */
  watchSyncedFlagWithInitialState(
    flagName: string,
    callback: (flag: FlagProxy) => void | Promise<void>
  ): this {
    const unsubscribe = this.client.watchSyncedFlagWithInitialState(flagName, callback);
    this.unsubscribers.push(unsubscribe);
    return this;
  }

  /**
   * Unwatch all registered watchers in this group
   */
  unwatchAll(): void {
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }
    this.unsubscribers = [];
  }

  /**
   * Alias for unwatchAll - destroys the group
   */
  destroy(): void {
    this.unwatchAll();
  }

  /**
   * Get the number of active watchers in this group
   */
  get size(): number {
    return this.unsubscribers.length;
  }
}
