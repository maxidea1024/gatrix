// Gatrix Svelte SDK - Variation stores
import { readable, type Readable } from 'svelte/store';
import { getGatrixClient } from './getGatrixClient';
import { EVENTS, type Variant } from '@gatrix/js-client-sdk';

/**
 * Reactive boolean variation store.
 * @example
 * ```svelte
 * <script>
 *   import { boolVariation } from '@gatrix/svelte-sdk';
 *   const darkMode = boolVariation('dark-mode', false);
 * </script>
 * ```
 */
export function boolVariation(flagName: string, missingValue: boolean): Readable<boolean> {
  const client = getGatrixClient();
  return readable<boolean>(client.features.boolVariation(flagName, missingValue), (set) => {
    const update = () => set(client.features.boolVariation(flagName, missingValue));
    client.on(EVENTS.FLAGS_CHANGE, update);
    client.on(EVENTS.FLAGS_READY, update);
    client.on(EVENTS.FLAGS_SYNC, update);
    const unwatch = client.features.watchFlag(flagName, () => update(), `svelte_bool_${flagName}`);
    return () => {
      client.off(EVENTS.FLAGS_CHANGE, update);
      client.off(EVENTS.FLAGS_READY, update);
      client.off(EVENTS.FLAGS_SYNC, update);
      unwatch();
    };
  });
}

/**
 * Reactive string variation store.
 */
export function stringVariation(flagName: string, missingValue: string): Readable<string> {
  const client = getGatrixClient();
  return readable<string>(client.features.stringVariation(flagName, missingValue), (set) => {
    const update = () => set(client.features.stringVariation(flagName, missingValue));
    client.on(EVENTS.FLAGS_CHANGE, update);
    client.on(EVENTS.FLAGS_READY, update);
    client.on(EVENTS.FLAGS_SYNC, update);
    const unwatch = client.features.watchFlag(flagName, () => update(), `svelte_str_${flagName}`);
    return () => {
      client.off(EVENTS.FLAGS_CHANGE, update);
      client.off(EVENTS.FLAGS_READY, update);
      client.off(EVENTS.FLAGS_SYNC, update);
      unwatch();
    };
  });
}

/**
 * Reactive number variation store.
 */
export function numberVariation(flagName: string, missingValue: number): Readable<number> {
  const client = getGatrixClient();
  return readable<number>(client.features.numberVariation(flagName, missingValue), (set) => {
    const update = () => set(client.features.numberVariation(flagName, missingValue));
    client.on(EVENTS.FLAGS_CHANGE, update);
    client.on(EVENTS.FLAGS_READY, update);
    client.on(EVENTS.FLAGS_SYNC, update);
    const unwatch = client.features.watchFlag(flagName, () => update(), `svelte_num_${flagName}`);
    return () => {
      client.off(EVENTS.FLAGS_CHANGE, update);
      client.off(EVENTS.FLAGS_READY, update);
      client.off(EVENTS.FLAGS_SYNC, update);
      unwatch();
    };
  });
}

/**
 * Reactive JSON variation store.
 */
export function jsonVariation<T = unknown>(flagName: string, missingValue: T): Readable<T> {
  const client = getGatrixClient();
  return readable<T>(client.features.jsonVariation(flagName, missingValue), (set) => {
    const update = () => set(client.features.jsonVariation(flagName, missingValue));
    client.on(EVENTS.FLAGS_CHANGE, update);
    client.on(EVENTS.FLAGS_READY, update);
    client.on(EVENTS.FLAGS_SYNC, update);
    const unwatch = client.features.watchFlag(flagName, () => update(), `svelte_json_${flagName}`);
    return () => {
      client.off(EVENTS.FLAGS_CHANGE, update);
      client.off(EVENTS.FLAGS_READY, update);
      client.off(EVENTS.FLAGS_SYNC, update);
      unwatch();
    };
  });
}

/**
 * Reactive variant store.
 */
export function variant(flagName: string): Readable<Variant> {
  const client = getGatrixClient();
  return readable<Variant>(client.features.getVariant(flagName), (set) => {
    const update = () => set(client.features.getVariant(flagName));
    client.on(EVENTS.FLAGS_CHANGE, update);
    client.on(EVENTS.FLAGS_READY, update);
    client.on(EVENTS.FLAGS_SYNC, update);
    const unwatch = client.features.watchFlag(flagName, () => update(), `svelte_var_${flagName}`);
    return () => {
      client.off(EVENTS.FLAGS_CHANGE, update);
      client.off(EVENTS.FLAGS_READY, update);
      client.off(EVENTS.FLAGS_SYNC, update);
      unwatch();
    };
  });
}
