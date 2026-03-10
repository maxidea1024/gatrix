import {
  Injectable,
  Inject,
  Optional,
  OnDestroy,
} from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  GatrixClient,
  EVENTS,
  type GatrixClientConfig,
} from '@gatrix/gatrix-js-client-sdk';
import { GATRIX_CONFIG, GATRIX_CLIENT, GATRIX_START_CLIENT } from './tokens';

/**
 * Core Angular service that wraps GatrixClient.
 *
 * Provides reactive observables for SDK status (ready, healthy, error)
 * and manages the client lifecycle.
 */
@Injectable()
export class GatrixService implements OnDestroy {
  /** The underlying GatrixClient instance */
  readonly client: GatrixClient;

  /** Emits true once the SDK has successfully fetched flags */
  readonly ready$ = new BehaviorSubject<boolean>(false);

  /** Emits the current health status (true = healthy, false = error state) */
  readonly healthy$ = new BehaviorSubject<boolean>(true);

  /** Emits the latest error, or null when recovered */
  readonly error$ = new BehaviorSubject<Error | null>(null);

  private readonly onReady = () => {
    this.ready$.next(true);
  };

  private readonly onError = (err: Error) => {
    this.error$.next(err);
    this.healthy$.next(false);
  };

  private readonly onRecovered = () => {
    this.error$.next(null);
    this.healthy$.next(true);
  };

  constructor(
    @Optional() @Inject(GATRIX_CONFIG) config: GatrixClientConfig | null,
    @Optional() @Inject(GATRIX_CLIENT) existingClient: GatrixClient | null,
    @Optional() @Inject(GATRIX_START_CLIENT) startClient: boolean | null,
  ) {
    if (existingClient) {
      this.client = existingClient;
    } else if (config) {
      this.client = new GatrixClient(config);
    } else {
      throw new Error(
        'GatrixService: You must provide either GATRIX_CONFIG or GATRIX_CLIENT. ' +
        'Use GatrixModule.forRoot(config) or provideGatrix(config) in your app.',
      );
    }

    // Set initial ready state
    if (this.client.isReady()) {
      this.ready$.next(true);
    }

    // Register event listeners
    this.client.on(EVENTS.FLAGS_READY, this.onReady);
    this.client.on(EVENTS.SDK_ERROR, this.onError);
    this.client.on(EVENTS.FLAGS_RECOVERED, this.onRecovered);

    // Auto-start unless explicitly disabled
    const shouldStart = startClient !== false;
    if (shouldStart && !this.client.isReady()) {
      this.client.start();
    }
  }

  ngOnDestroy(): void {
    this.client.off(EVENTS.FLAGS_READY, this.onReady);
    this.client.off(EVENTS.SDK_ERROR, this.onError);
    this.client.off(EVENTS.FLAGS_RECOVERED, this.onRecovered);
    this.client.stop();
    this.ready$.complete();
    this.healthy$.complete();
    this.error$.complete();
  }
}
