import { inject, signal, DestroyRef, type Signal } from '@angular/core';
import {
  EVENTS,
  type GatrixClient,
  type GatrixContext,
  type EvaluatedFlag,
  type Variant,
  FlagProxy,
} from '@gatrix/gatrix-js-client-sdk';
import { GatrixService } from './gatrix.service';

// ─── Internal helpers ──────────────────────────────────────────

function getService(): GatrixService {
  const svc = inject(GatrixService, { optional: true });
  if (!svc) {
    throw new Error(
      'GatrixService not found. Use GatrixModule.forRoot(config) or provideGatrix(config).'
    );
  }
  return svc;
}

// ─── Core accessors ────────────────────────────────────────────

/**
 * Injects the GatrixClient instance.
 * Must be called within an injection context (constructor, field initializer, or `runInInjectionContext`).
 */
export function injectGatrixClient(): GatrixClient {
  return getService().client;
}

/**
 * Injects the GatrixService instance.
 */
export function injectGatrixService(): GatrixService {
  return getService();
}

// ─── Status ────────────────────────────────────────────────────

/**
 * Returns reactive signals for SDK status.
 *
 * @example
 * ```typescript
 * readonly status = injectFlagsStatus();
 * // template: @if (status.ready()) { ... }
 * ```
 */
export function injectFlagsStatus(): {
  ready: Signal<boolean>;
  error: Signal<Error | null>;
  healthy: Signal<boolean>;
} {
  const svc = getService();
  const destroyRef = inject(DestroyRef);

  const ready = signal(svc.ready$.getValue());
  const error = signal<Error | null>(svc.error$.getValue());
  const healthy = signal(svc.healthy$.getValue());

  const sub1 = svc.ready$.subscribe((v) => ready.set(v));
  const sub2 = svc.error$.subscribe((v) => error.set(v));
  const sub3 = svc.healthy$.subscribe((v) => healthy.set(v));

  destroyRef.onDestroy(() => {
    sub1.unsubscribe();
    sub2.unsubscribe();
    sub3.unsubscribe();
  });

  return {
    ready: ready.asReadonly(),
    error: error.asReadonly(),
    healthy: healthy.asReadonly(),
  };
}

// ─── Flag access ───────────────────────────────────────────────

/**
 * Returns a signal that tracks whether a flag is enabled.
 *
 * @param flagName - The feature flag name
 * @param forceRealtime - Read from realtime flags (default: true)
 *
 * @example
 * ```typescript
 * readonly showNewUI = injectFlag('new-ui');
 * // template: @if (showNewUI()) { <NewUI /> }
 * ```
 */
export function injectFlag(
  flagName: string,
  forceRealtime = true
): Signal<boolean> {
  const svc = getService();
  const destroyRef = inject(DestroyRef);
  const value = signal(svc.client.features.isEnabled(flagName, forceRealtime));

  const watchFn = forceRealtime
    ? svc.client.features.watchRealtimeFlagWithInitialState.bind(
      svc.client.features
    )
    : svc.client.features.watchSyncedFlagWithInitialState.bind(
      svc.client.features
    );

  const unwatch = watchFn(flagName, (proxy: FlagProxy) => {
    value.set(proxy.enabled);
  });

  destroyRef.onDestroy(unwatch);

  return value.asReadonly();
}

/**
 * Returns a signal with the variant for a flag.
 *
 * @param flagName - The feature flag name
 * @param forceRealtime - Read from realtime flags (default: true)
 */
export function injectVariant(
  flagName: string,
  forceRealtime = true
): Signal<Variant | undefined> {
  const svc = getService();
  const destroyRef = inject(DestroyRef);
  const value = signal<Variant | undefined>(undefined);

  const watchFn = forceRealtime
    ? svc.client.features.watchRealtimeFlagWithInitialState.bind(
      svc.client.features
    )
    : svc.client.features.watchSyncedFlagWithInitialState.bind(
      svc.client.features
    );

  const unwatch = watchFn(flagName, (proxy: FlagProxy) => {
    value.set(proxy.variant);
  });

  destroyRef.onDestroy(unwatch);

  return value.asReadonly();
}

/**
 * Returns a signal with all evaluated flags.
 *
 * @param forceRealtime - Read from realtime flags (default: true)
 */
export function injectFlags(forceRealtime = true): Signal<EvaluatedFlag[]> {
  const svc = getService();
  const destroyRef = inject(DestroyRef);
  const value = signal<EvaluatedFlag[]>(
    svc.client.features.getAllFlags(forceRealtime)
  );

  const updateFlags = () => {
    value.set(svc.client.features.getAllFlags(forceRealtime));
  };

  svc.client.on(EVENTS.FLAGS_CHANGE, updateFlags);
  svc.client.on(EVENTS.FLAGS_READY, updateFlags);
  svc.client.on(EVENTS.FLAGS_SYNC, updateFlags);

  destroyRef.onDestroy(() => {
    svc.client.off(EVENTS.FLAGS_CHANGE, updateFlags);
    svc.client.off(EVENTS.FLAGS_READY, updateFlags);
    svc.client.off(EVENTS.FLAGS_SYNC, updateFlags);
  });

  return value.asReadonly();
}

// ─── Variations ────────────────────────────────────────────────

/**
 * Returns a signal tracking the boolean variation of a flag.
 *
 * @param flagName - The feature flag name
 * @param fallbackValue - Default value when flag is missing/disabled
 * @param forceRealtime - Read from realtime flags (default: true)
 */
export function injectBoolVariation(
  flagName: string,
  fallbackValue: boolean,
  forceRealtime = true
): Signal<boolean> {
  const svc = getService();
  const destroyRef = inject(DestroyRef);
  const value = signal(
    svc.client.features.boolVariation(flagName, fallbackValue, forceRealtime)
  );

  const watchFn = forceRealtime
    ? svc.client.features.watchRealtimeFlagWithInitialState.bind(
      svc.client.features
    )
    : svc.client.features.watchSyncedFlagWithInitialState.bind(
      svc.client.features
    );

  const unwatch = watchFn(flagName, (proxy: FlagProxy) => {
    value.set(proxy.boolVariation(fallbackValue));
  });

  destroyRef.onDestroy(unwatch);

  return value.asReadonly();
}

/**
 * Returns a signal tracking the string variation of a flag.
 *
 * @param flagName - The feature flag name
 * @param fallbackValue - Default value when flag is missing/disabled
 * @param forceRealtime - Read from realtime flags (default: true)
 */
export function injectStringVariation(
  flagName: string,
  fallbackValue: string,
  forceRealtime = true
): Signal<string> {
  const svc = getService();
  const destroyRef = inject(DestroyRef);
  const value = signal(
    svc.client.features.stringVariation(flagName, fallbackValue, forceRealtime)
  );

  const watchFn = forceRealtime
    ? svc.client.features.watchRealtimeFlagWithInitialState.bind(
      svc.client.features
    )
    : svc.client.features.watchSyncedFlagWithInitialState.bind(
      svc.client.features
    );

  const unwatch = watchFn(flagName, (proxy: FlagProxy) => {
    value.set(proxy.stringVariation(fallbackValue));
  });

  destroyRef.onDestroy(unwatch);

  return value.asReadonly();
}

/**
 * Returns a signal tracking the number variation of a flag.
 *
 * @param flagName - The feature flag name
 * @param fallbackValue - Default value when flag is missing/disabled
 * @param forceRealtime - Read from realtime flags (default: true)
 */
export function injectNumberVariation(
  flagName: string,
  fallbackValue: number,
  forceRealtime = true
): Signal<number> {
  const svc = getService();
  const destroyRef = inject(DestroyRef);
  const value = signal(
    svc.client.features.numberVariation(flagName, fallbackValue, forceRealtime)
  );

  const watchFn = forceRealtime
    ? svc.client.features.watchRealtimeFlagWithInitialState.bind(
      svc.client.features
    )
    : svc.client.features.watchSyncedFlagWithInitialState.bind(
      svc.client.features
    );

  const unwatch = watchFn(flagName, (proxy: FlagProxy) => {
    value.set(proxy.numberVariation(fallbackValue));
  });

  destroyRef.onDestroy(unwatch);

  return value.asReadonly();
}

/**
 * Returns a signal tracking the JSON variation of a flag.
 *
 * @param flagName - The feature flag name
 * @param fallbackValue - Default value when flag is missing/disabled
 * @param forceRealtime - Read from realtime flags (default: true)
 */
export function injectJsonVariation<T>(
  flagName: string,
  fallbackValue: T,
  forceRealtime = true
): Signal<T> {
  const svc = getService();
  const destroyRef = inject(DestroyRef);
  const value = signal<T>(
    svc.client.features.jsonVariation<T>(flagName, fallbackValue, forceRealtime)
  );

  const watchFn = forceRealtime
    ? svc.client.features.watchRealtimeFlagWithInitialState.bind(
      svc.client.features
    )
    : svc.client.features.watchSyncedFlagWithInitialState.bind(
      svc.client.features
    );

  const unwatch = watchFn(flagName, (proxy: FlagProxy) => {
    value.set(proxy.jsonVariation<T>(fallbackValue));
  });

  destroyRef.onDestroy(unwatch);

  return value.asReadonly();
}

// ─── Actions ───────────────────────────────────────────────────

/**
 * Returns a function to update the evaluation context.
 * Context updates trigger a re-fetch of flags from the server.
 */
export function injectUpdateContext(): (
  context: Partial<GatrixContext>
) => Promise<void> {
  const svc = getService();
  return (context: Partial<GatrixContext>) =>
    svc.client.features.updateContext(context);
}

/**
 * Returns a function to sync flags (in explicit sync mode).
 */
export function injectSyncFlags(): (fetchNow?: boolean) => Promise<void> {
  const svc = getService();
  return (fetchNow?: boolean) => svc.client.features.syncFlags(fetchNow);
}

/**
 * Returns a function to manually fetch flags.
 */
export function injectFetchFlags(): () => Promise<void> {
  const svc = getService();
  return () => svc.client.features.fetchFlags();
}

/**
 * Returns a function to track custom events.
 */
export function injectTrack(): (
  eventName: string,
  properties?: Record<string, unknown>
) => void {
  const svc = getService();
  return (eventName: string, properties?: Record<string, unknown>) => {
    svc.client.track(eventName, properties);
  };
}
