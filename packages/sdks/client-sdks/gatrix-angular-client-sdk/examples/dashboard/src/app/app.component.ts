import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { GatrixClientConfig } from '@gatrix/gatrix-js-client-sdk';
import { ConfigFormComponent } from './components/config-form.component';
import { DashboardComponent } from './components/dashboard.component';

type AppState = 'config' | 'connecting' | 'connected' | 'error';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, ConfigFormComponent, DashboardComponent],
  template: `
    <div class="app">
      @switch (state()) {
        @case ('config') {
          <app-config-form (connect)="onConnect($event)" />
        }
        @case ('connecting') {
          <div class="boot-screen">
            <div class="boot-logo">⚡ GATRIX ⚡</div>
            <div class="boot-text">CONNECTING...</div>
            <progress class="nes-progress is-success" value="70" max="100"></progress>
          </div>
        }
        @case ('connected') {
          <app-dashboard
            [config]="currentConfig()!"
            (disconnect)="onDisconnect()"
          />
        }
        @case ('error') {
          <div class="boot-screen">
            <div class="boot-logo" style="color: #e76e55;">✖ ERROR ✖</div>
            <div class="boot-text" style="color: #e76e55;">{{ errorMessage() }}</div>
            <button class="nes-btn is-warning" (click)="state.set('config')">
              ← BACK
            </button>
          </div>
        }
      }
    </div>
  `,
})
export class AppComponent {
  readonly state = signal<AppState>('config');
  readonly currentConfig = signal<GatrixClientConfig | null>(null);
  readonly errorMessage = signal('');

  onConnect(config: GatrixClientConfig) {
    this.currentConfig.set(config);
    this.state.set('connected');
  }

  onDisconnect() {
    this.currentConfig.set(null);
    this.state.set('config');
  }
}
