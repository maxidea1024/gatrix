import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { FeaturesStats } from '@gatrix/gatrix-js-client-sdk';

@Component({
  selector: 'app-stats-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="nes-container is-dark stats-container">
      <div class="stats-grid-layout">
        <!-- Stat Numbers -->
        <div class="stats-numbers-compact">
          <div class="stat-mini">
            <span class="stat-mini-value total">{{ totalFlags() }}</span>
            <span class="stat-mini-label">TOTAL</span>
          </div>
          <div class="stat-mini">
            <span class="stat-mini-value enabled">{{ enabledFlags() }}</span>
            <span class="stat-mini-label">ON</span>
          </div>
          <div class="stat-mini">
            <span class="stat-mini-value disabled">{{ disabledFlags() }}</span>
            <span class="stat-mini-label">OFF</span>
          </div>
        </div>

        <!-- Separator -->
        <div class="stats-separator"></div>

        <!-- Stats Table -->
        <table class="stats-table">
          <tbody>
            <tr>
              <td class="stats-label">STATE</td>
              <td class="stats-value" [class.status-healthy]="healthy()" [class.status-error]="!healthy()">
                {{ ready() ? (healthy() ? 'HEALTHY' : 'ERROR') : 'INIT' }}
              </td>
            </tr>
            <tr>
              <td class="stats-label">FETCHES</td>
              <td class="stats-value">{{ stats()?.fetchFlagsCount ?? 0 }}</td>
            </tr>
            <tr>
              <td class="stats-label">UPDATES</td>
              <td class="stats-value">{{ stats()?.updateCount ?? 0 }}</td>
            </tr>
            <tr>
              <td class="stats-label">304s</td>
              <td class="stats-value">{{ stats()?.notModifiedCount ?? 0 }}</td>
            </tr>
            <tr>
              <td class="stats-label">ERRORS</td>
              <td class="stats-value" [class.status-error]="(stats()?.errorCount ?? 0) > 0">
                {{ stats()?.errorCount ?? 0 }}
              </td>
            </tr>
          </tbody>
        </table>

        <div class="stats-separator"></div>

        <!-- Modes -->
        <div class="stats-modes-compact">
          <div class="mode-item is-info">
            <span class="mode-label">CTX CHG</span>
            <span class="mode-value">{{ stats()?.contextChangeCount ?? 0 }}</span>
          </div>
          <div class="mode-item is-warning">
            <span class="mode-label">SYNCS</span>
            <span class="mode-value">{{ stats()?.syncFlagsCount ?? 0 }}</span>
          </div>
          <div class="mode-item is-success">
            <span class="mode-label">METRICS</span>
            <span class="mode-value">{{ stats()?.metricsSentCount ?? 0 }}</span>
          </div>
        </div>

        <!-- Error display -->
        @if (error()) {
          <div class="mascot-error">
            <div class="error-balloon-inline nes-balloon from-left is-dark is-error-border">
              <p>{{ error()!.message }}</p>
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class StatsPanelComponent {
  readonly stats = input<FeaturesStats | null>(null);
  readonly ready = input(false);
  readonly healthy = input(true);
  readonly error = input<Error | null>(null);

  readonly totalFlags = computed(() => this.stats()?.totalFlagCount ?? 0);

  readonly enabledFlags = computed(() => {
    const counts = this.stats()?.flagEnabledCounts;
    if (!counts) return 0;
    let enabled = 0;
    for (const flag of Object.values(counts) as { yes: number; no: number }[]) {
      if (flag.yes > 0) enabled++;
    }
    return enabled;
  });

  readonly disabledFlags = computed(() => this.totalFlags() - this.enabledFlags());
}
