import type { Provider } from '@angular/core';
import {
  GatrixClient,
  type GatrixClientConfig,
} from '@gatrix/gatrix-js-client-sdk';
import { GatrixService } from './gatrix.service';
import { GATRIX_CONFIG, GATRIX_CLIENT, GATRIX_START_CLIENT } from './tokens';

/**
 * Provide Gatrix SDK from a config object (Standalone API).
 *
 * @example
 * ```typescript
 * bootstrapApplication(AppComponent, {
 *   providers: [
 *     provideGatrix({
 *       apiUrl: 'https://your-gatrix-server.com/api/v1',
 *       apiToken: 'your-token',
 *       appName: 'my-app',
 *     }),
 *   ],
 * });
 * ```
 */
export function provideGatrix(
  config: GatrixClientConfig,
  options?: { startClient?: boolean },
): Provider[] {
  const providers: Provider[] = [
    { provide: GATRIX_CONFIG, useValue: config },
    GatrixService,
  ];
  if (options?.startClient === false) {
    providers.push({ provide: GATRIX_START_CLIENT, useValue: false });
  }
  return providers;
}

/**
 * Provide Gatrix SDK from a pre-created GatrixClient instance (Standalone API).
 *
 * @example
 * ```typescript
 * const client = new GatrixClient({...});
 * bootstrapApplication(AppComponent, {
 *   providers: [
 *     provideGatrixClient(client),
 *   ],
 * });
 * ```
 */
export function provideGatrixClient(
  client: GatrixClient,
  options?: { startClient?: boolean },
): Provider[] {
  const providers: Provider[] = [
    { provide: GATRIX_CLIENT, useValue: client },
    GatrixService,
  ];
  if (options?.startClient === false) {
    providers.push({ provide: GATRIX_START_CLIENT, useValue: false });
  }
  return providers;
}
