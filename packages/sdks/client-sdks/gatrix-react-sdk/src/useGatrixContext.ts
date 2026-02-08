/**
 * useGatrixContext - Internal hook to access the Gatrix context
 *
 * Provides a safe way to access the context with proper error handling
 * when used outside of a GatrixProvider.
 */
import { useContext } from 'react';
import GatrixFlagContext, { type GatrixContextValue } from './GatrixContext';
import type { GatrixClient, FeaturesClient, Variant } from '@gatrix/js-client-sdk';

// Mock methods that log errors when used outside provider
const mockMethods = {
  on: (_event: string, _callback: (...args: any[]) => void): GatrixClient => {
    console.error('on() must be used within a GatrixProvider');
    return mockGatrixClient;
  },
  off: (_event: string, _callback?: (...args: any[]) => void): GatrixClient => {
    console.error('off() must be used within a GatrixProvider');
    return mockGatrixClient;
  },
  updateContext: async () => {
    console.error('updateContext() must be used within a GatrixProvider');
    return undefined;
  },
  isEnabled: () => {
    console.error('isEnabled() must be used within a GatrixProvider');
    return false;
  },
  getVariant: (): Variant => {
    console.error('getVariant() must be used within a GatrixProvider');
    return { name: 'disabled', enabled: false };
  },
  isExplicitSync: () => {
    console.error('isExplicitSync() must be used within a GatrixProvider');
    return false;
  },
  canSyncFlags: () => {
    console.error('canSyncFlags() must be used within a GatrixProvider');
    return false;
  },
  fetchFlags: async () => {
    console.error('fetchFlags() must be used within a GatrixProvider');
  },
  syncFlags: async () => {
    console.error('syncFlags() must be used within a GatrixProvider');
  },
};

// Mock FeaturesClient
const mockFeaturesClient = {
  ...mockMethods,
  getContext: () => ({}),
  getAllFlags: () => [],
  boolVariation: () => false,
  stringVariation: () => '',
  numberVariation: () => 0,
  jsonVariation: () => ({}),
  getStats: () => ({}),
} as unknown as FeaturesClient;

// Mock GatrixClient for use outside provider
const mockGatrixClient = {
  ...mockMethods,
  features: mockFeaturesClient,
  start: () => Promise.resolve(),
  stop: () => { },
  isReady: () => false,
  getError: () => null,
} as unknown as GatrixClient;

// Default context value for use outside provider
const defaultContextValue: GatrixContextValue = {
  ...mockMethods,
  client: mockGatrixClient,
  features: mockFeaturesClient,
  flagsReady: false,
  setFlagsReady: () => {
    console.error('setFlagsReady() must be used within a GatrixProvider');
  },
  flagsError: null,
  setFlagsError: () => {
    console.error('setFlagsError() must be used within a GatrixProvider');
  },
};

/**
 * Access the Gatrix context
 *
 * @returns The Gatrix context value
 * @throws Console error if used outside GatrixProvider (returns mock value)
 */
export function useGatrixContext(): GatrixContextValue {
  const context = useContext(GatrixFlagContext);
  if (!context) {
    console.error('useGatrixContext() must be used within a GatrixProvider');
    return defaultContextValue;
  }
  return context;
}

export default useGatrixContext;
