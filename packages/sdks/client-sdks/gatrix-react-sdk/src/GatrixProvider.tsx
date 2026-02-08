/**
 * GatrixProvider - React Provider for Gatrix SDK
 *
 * Wraps your application to provide Gatrix feature flag functionality.
 * Either pass a config object or an existing GatrixClient instance.
 */
import React, { type FC, type PropsWithChildren, useEffect, useMemo, useState } from 'react';
import { GatrixClient, EVENTS, type GatrixClientConfig } from '@gatrix/js-client-sdk';
import GatrixFlagContext, { type GatrixContextValue } from './GatrixContext';

export interface GatrixProviderProps {
  /** Gatrix client configuration */
  config?: GatrixClientConfig;
  /** Existing GatrixClient instance (alternative to config) */
  gatrixClient?: GatrixClient;
  /** Whether to start the client automatically (default: true) */
  startClient?: boolean;
  /** Whether to stop the client on unmount (default: true) */
  stopClient?: boolean;
  /** React 18 startTransition for non-blocking updates */
  startTransition?: (fn: () => void) => void;
}

// Offline config for when no config is provided
const offlineConfig: GatrixClientConfig = {
  apiUrl: 'http://localhost',
  apiToken: 'not-used',
  appName: 'offline',
  environment: 'offline',
  offlineMode: true,
  features: {
    bootstrap: [],
    disableRefresh: true,
    disableMetrics: true,
  },
};

// Fallback for React <18 which doesn't support startTransition
const _startTransition = 'startTransition';
const defaultStartTransition = (React as any)[_startTransition] || ((fn: () => void) => fn());

const GatrixProvider: FC<PropsWithChildren<GatrixProviderProps>> = ({
  config: customConfig,
  children,
  gatrixClient,
  startClient = true,
  stopClient = true,
  startTransition = defaultStartTransition,
}) => {
  const config = customConfig || offlineConfig;
  const client = React.useRef<GatrixClient | null>(null);

  if (!client.current) {
    client.current = gatrixClient || new GatrixClient(config);
  }

  const hasStarted = React.useRef(false);

  const [flagsReady, setFlagsReady] = useState(
    Boolean(
      gatrixClient
        ? (customConfig?.features?.bootstrap &&
          customConfig?.features?.bootstrapOverride !== false) ||
        gatrixClient.isReady?.()
        : config.features?.bootstrap && config.features?.bootstrapOverride !== false
    )
  );

  const [flagsError, setFlagsError] = useState<any>(client.current!.getError?.() || null);

  useEffect(() => {
    if (!config && !gatrixClient) {
      console.error(
        `GatrixProvider: You must provide either a config or a gatrixClient.
        If you are initializing the client in useEffect, you can avoid this warning
        by checking if the client exists before rendering.`
      );
    }

    const errorCallback = (e: any) => {
      startTransition(() => {
        setFlagsError((currentError: any) => currentError || e);
      });
    };

    const clearErrorCallback = () => {
      startTransition(() => {
        setFlagsError(null);
      });
    };

    let timeout: ReturnType<typeof setTimeout> | null = null;
    const readyCallback = () => {
      // Wait for flags to resolve after useFlag gets the same event
      timeout = setTimeout(() => {
        startTransition(() => {
          setFlagsReady(true);
        });
      }, 0);
    };

    client.current!.on(EVENTS.READY, readyCallback);
    client.current!.on(EVENTS.ERROR, errorCallback);
    client.current!.on(EVENTS.RECOVERED, clearErrorCallback);

    if (startClient && !client.current!.isReady() && !hasStarted.current) {
      hasStarted.current = true;
      client.current!.start();
    }

    // Stop client on unmount
    return function cleanup() {
      if (client.current) {
        client.current.off(EVENTS.ERROR, errorCallback);
        client.current.off(EVENTS.READY, readyCallback);
        client.current.off(EVENTS.RECOVERED, clearErrorCallback);
        if (stopClient) {
          client.current.stop();
        }
      }
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, []);

  const context = useMemo<GatrixContextValue>(
    () => ({
      client: client.current!,
      features: client.current!.features,
      flagsReady,
      flagsError,
      setFlagsReady,
      setFlagsError,
      on: (...args: any[]) => client.current!.on(args[0], args[1]),
      off: (...args: any[]) => client.current!.off(args[0], args[1]),
      isEnabled: (flagName: string) => client.current!.features.isEnabled(flagName),
      getVariant: (flagName: string) => client.current!.features.getVariant(flagName),
      updateContext: async (context: any) => await client.current!.features.updateContext(context),
      isExplicitSync: () => client.current!.features.isExplicitSync(),
      canSyncFlags: () => client.current!.features.canSyncFlags(),
      fetchFlags: async () => await client.current!.features.fetchFlags(),
      syncFlags: async (fetchNow?: boolean) => await client.current!.features.syncFlags(fetchNow),
    }),
    [flagsReady, flagsError]
  );

  return <GatrixFlagContext.Provider value={context}>{children}</GatrixFlagContext.Provider>;
};

export default GatrixProvider;
