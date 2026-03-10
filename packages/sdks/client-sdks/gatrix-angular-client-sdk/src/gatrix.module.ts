import { NgModule, type ModuleWithProviders } from '@angular/core';
import type { GatrixClientConfig } from '@gatrix/gatrix-js-client-sdk';
import { GatrixService } from './gatrix.service';
import { GATRIX_CONFIG } from './tokens';

/**
 * Angular module for Gatrix SDK.
 *
 * Use `GatrixModule.forRoot(config)` in the root application module.
 * For standalone components, use the `provideGatrix()` function instead.
 *
 * @example
 * ```typescript
 * @NgModule({
 *   imports: [
 *     GatrixModule.forRoot({
 *       apiUrl: 'https://your-gatrix-server.com/api/v1',
 *       apiToken: 'your-token',
 *       appName: 'my-app',
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@NgModule({})
export class GatrixModule {
  static forRoot(
    config: GatrixClientConfig
  ): ModuleWithProviders<GatrixModule> {
    return {
      ngModule: GatrixModule,
      providers: [{ provide: GATRIX_CONFIG, useValue: config }, GatrixService],
    };
  }
}
