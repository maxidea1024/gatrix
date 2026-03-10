import {
  Component,
  input,
  output,
  signal,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  GatrixClient,
  EVENTS,
  type GatrixClientConfig,
  type EvaluatedFlag,
  type FeaturesStats,
} from '@gatrix/gatrix-js-client-sdk';
import { FlagCardComponent } from './flag-card.component';
import { StatsPanelComponent } from './stats-panel.component';
import { LogViewerComponent } from './log-viewer.component';

export interface LogEntry {
  time: string;
  event: string;
  detail: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FlagCardComponent,
    StatsPanelComponent,
    LogViewerComponent,
  ],
  template: `
    <div class="dashboard-container">
      <!-- Header -->
      <div class="header">
        <h1 class="header-title">⚡ GATRIX ANGULAR DASHBOARD</h1>
        <div style="display: flex; gap: 8px; align-items: center;">
          @if (hasPendingSync()) {
            <button
              class="nes-btn is-warning sync-available-rumble"
              (click)="syncFlags()"
            >
              ⟳ SYNC
            </button>
          }
          <button class="nes-btn is-error" (click)="handleDisconnect()">
            ✖ DISCONNECT
          </button>
        </div>
      </div>

      <!-- Stats Panel -->
      <app-stats-panel
        [stats]="stats()"
        [ready]="ready()"
        [healthy]="healthy()"
        [error]="error()"
      />

      <!-- Flags Grid -->
      <div
        class="flags-section"
        style="flex: 1; overflow-y: auto; margin-top: 16px;"
      >
        @if (!ready()) {
          <div class="nes-container is-dark" style="text-align: center;">
            <p style="color: #f7d51d; font-size: 10px;">
              ⏳ WAITING FOR FLAGS...
            </p>
          </div>
        } @else if (flags().length === 0) {
          <div class="nes-container is-dark" style="text-align: center;">
            <p style="color: #adafbc; font-size: 10px;">NO FLAGS FOUND</p>
          </div>
        } @else {
          <div class="flags-grid">
            @for (flag of flags(); track flag.name) {
              <app-flag-card [flag]="flag" />
            }
          </div>
        }
      </div>

      <!-- Log Viewer -->
      <app-log-viewer [logs]="logs()" style="margin-top: 16px;" />
    </div>
  `,
  styles: [
    `
      .flags-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 12px;
      }
    `,
  ],
})
export class DashboardComponent implements OnInit, OnDestroy {
  readonly config = input.required<GatrixClientConfig>();
  readonly disconnect = output<void>();

  private client: GatrixClient | null = null;

  readonly flags = signal<EvaluatedFlag[]>([]);
  readonly ready = signal(false);
  readonly healthy = signal(true);
  readonly error = signal<Error | null>(null);
  readonly hasPendingSync = signal(false);
  readonly stats = signal<FeaturesStats | null>(null);
  readonly logs = signal<LogEntry[]>([]);

  private statsInterval: ReturnType<typeof setInterval> | null = null;

  ngOnInit() {
    this.client = new GatrixClient(this.config());

    // Event listeners
    this.client.on(EVENTS.FLAGS_READY, () => {
      this.ready.set(true);
      this.updateFlags();
      this.addLog('flags.ready', 'SDK ready', 'success');
    });

    this.client.on(EVENTS.FLAGS_CHANGE, () => {
      this.updateFlags();
      this.addLog(
        'flags.change',
        `${this.client!.features.getAllFlags().length} flags`,
        'info'
      );
    });

    this.client.on(EVENTS.FLAGS_SYNC, () => {
      this.updateFlags();
      this.hasPendingSync.set(false);
      this.addLog('flags.sync', 'Flags synced', 'success');
    });

    this.client.on(EVENTS.SDK_ERROR, (err: Error) => {
      this.error.set(err);
      this.healthy.set(false);
      this.addLog('flags.error', err.message, 'error');
    });

    this.client.on(EVENTS.FLAGS_RECOVERED, () => {
      this.error.set(null);
      this.healthy.set(true);
      this.addLog('flags.recovered', 'Recovered', 'success');
    });

    this.client.on(EVENTS.FLAGS_PENDING_SYNC, () => {
      this.hasPendingSync.set(true);
      this.addLog('flags.pending_sync', 'Pending sync available', 'warning');
    });

    this.client.on(EVENTS.FLAGS_FETCH_START, () => {
      this.addLog('flags.fetch_start', 'Fetching...', 'info');
    });

    this.client.on(EVENTS.FLAGS_FETCH_SUCCESS, () => {
      this.addLog('flags.fetch_success', 'Fetch OK', 'success');
    });

    this.client.on(EVENTS.FLAGS_FETCH_ERROR, (data: any) => {
      this.addLog(
        'flags.fetch_error',
        data?.error?.message || 'Fetch error',
        'error'
      );
    });

    this.client.on(EVENTS.FLAGS_METRICS_SENT, () => {
      this.addLog('flags.metrics.sent', 'Metrics sent', 'info');
    });

    this.client.start();
    this.addLog('start', 'Client started', 'info');

    // Polling stats
    this.statsInterval = setInterval(() => {
      if (this.client) {
        this.stats.set(this.client.features.getStats());
      }
    }, 1000);
  }

  ngOnDestroy() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }
    if (this.client) {
      this.client.stop();
      this.client = null;
    }
  }

  syncFlags() {
    this.client?.features.syncFlags();
  }

  handleDisconnect() {
    if (this.client) {
      this.client.stop();
      this.client = null;
    }
    this.disconnect.emit();
  }

  private updateFlags() {
    if (this.client) {
      this.flags.set([...this.client.features.getAllFlags()]);
    }
  }

  private addLog(event: string, detail: string, type: LogEntry['type']) {
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour12: false });
    const entry: LogEntry = { time, event, detail, type };
    this.logs.update((prev) => [entry, ...prev].slice(0, 200));
  }
}
