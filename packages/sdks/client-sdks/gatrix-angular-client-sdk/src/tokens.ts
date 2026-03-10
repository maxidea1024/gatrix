import { InjectionToken } from '@angular/core';
import type { GatrixClient, GatrixClientConfig } from '@gatrix/gatrix-js-client-sdk';

/**
 * Injection token for the Gatrix client configuration.
 */
export const GATRIX_CONFIG = new InjectionToken<GatrixClientConfig>('GATRIX_CONFIG');

/**
 * Injection token for a pre-created GatrixClient instance.
 * When provided, the SDK uses this instance instead of creating one from GATRIX_CONFIG.
 */
export const GATRIX_CLIENT = new InjectionToken<GatrixClient>('GATRIX_CLIENT');

/**
 * Injection token controlling whether the client should be auto-started.
 * Defaults to true when not explicitly provided.
 */
export const GATRIX_START_CLIENT = new InjectionToken<boolean>('GATRIX_START_CLIENT');
