import { Component, output, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { GatrixClientConfig } from '@gatrix/gatrix-js-client-sdk';

// Dev tokens for local development
const DEV_TOKEN_EDGE = 'unsecured-edge-api-token';
const DEV_TOKEN_BACKEND = 'unsecured-client-api-token';

// Storage keys
const STORAGE_KEY_LOCATION = 'gatrix-dashboard-location';
const STORAGE_KEY_SERVER_TYPE = 'gatrix-dashboard-server-type';
const STORAGE_KEY_TOKEN = 'gatrix-dashboard-last-token';
const STORAGE_KEY_REMEMBER = 'gatrix-dashboard-remember-token';
const STORAGE_KEY_API_URL = 'gatrix-dashboard-api-url';
const STORAGE_KEY_APP_NAME = 'gatrix-dashboard-app-name';
const STORAGE_KEY_OFFLINE_MODE = 'gatrix-dashboard-offline-mode';
const STORAGE_KEY_REFRESH_INTERVAL = 'gatrix-dashboard-refresh-interval';
const STORAGE_KEY_EXPLICIT_SYNC = 'gatrix-dashboard-explicit-sync';
const STORAGE_KEY_MANUAL_POLLING = 'gatrix-dashboard-manual-polling';
const STORAGE_KEY_STREAMING_ENABLED = 'gatrix-dashboard-streaming-enabled';
const STORAGE_KEY_STREAMING_MODE = 'gatrix-dashboard-streaming-mode';
const STORAGE_KEY_USER_ID = 'gatrix-dashboard-user-id';

type ServerLocation = 'local' | 'remote';
type ServerType = 'edge' | 'backend';

function getLocalUrl(serverType: ServerType): string {
  return serverType === 'edge'
    ? 'http://localhost:3400/api/v1'
    : 'http://localhost:45000/api/v1';
}

function getDevToken(serverType: ServerType): string {
  return serverType === 'edge' ? DEV_TOKEN_EDGE : DEV_TOKEN_BACKEND;
}

function generateRandomUserId(): string {
  return 'user-' + Math.random().toString(36).substring(2, 10);
}

@Component({
  selector: 'app-config-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="center-container">
      <div class="login-container">
        <div class="login-box nes-container is-dark with-title">
          <p class="title" style="background-color: #000;">CONNECT TO GATRIX</p>

          <form (ngSubmit)="handleConnect()">
            <!-- Step 1: Server Location -->
            <div class="form-group">
              <label class="form-label">SERVER LOCATION</label>
              <div style="display: flex; gap: 40px; margin-bottom: 20px;">
                <label>
                  <input
                    type="radio"
                    class="nes-radio is-dark"
                    name="serverLocation"
                    [checked]="location() === 'local'"
                    (change)="setLocation('local')"
                  />
                  <span>LOCAL</span>
                </label>
                <label>
                  <input
                    type="radio"
                    class="nes-radio is-dark"
                    name="serverLocation"
                    [checked]="location() === 'remote'"
                    (change)="setLocation('remote')"
                  />
                  <span>REMOTE</span>
                </label>
              </div>
            </div>

            <!-- Step 2: Server Type (LOCAL only) -->
            @if (isLocal()) {
              <div class="form-group">
                <label class="form-label">SERVER TYPE</label>
                <div style="display: flex; gap: 40px; margin-bottom: 20px;">
                  <label>
                    <input
                      type="radio"
                      class="nes-radio is-dark"
                      name="serverType"
                      [checked]="serverType() === 'edge'"
                      (change)="setServerType('edge')"
                    />
                    <span>EDGE (:3400)</span>
                  </label>
                  <label>
                    <input
                      type="radio"
                      class="nes-radio is-dark"
                      name="serverType"
                      [checked]="serverType() === 'backend'"
                      (change)="setServerType('backend')"
                    />
                    <span>BACKEND (:45000)</span>
                  </label>
                </div>
              </div>
            }

            <!-- API URL & TOKEN (REMOTE only) -->
            @if (!isLocal()) {
              <div class="form-group">
                <label class="form-label">API URL</label>
                <input
                  type="url"
                  class="nes-input is-dark"
                  [(ngModel)]="apiUrl"
                  name="apiUrl"
                  placeholder="https://your-server.com/api/v1"
                  required
                />
              </div>

              <div class="form-group">
                <label class="form-label">API TOKEN</label>
                <div style="position: relative; display: flex; align-items: center;">
                  <input
                    [type]="showToken() ? 'text' : 'password'"
                    class="nes-input is-dark"
                    [(ngModel)]="apiToken"
                    name="apiToken"
                    placeholder="Enter your API token"
                    required
                    style="padding-right: 50px;"
                  />
                  <button
                    type="button"
                    class="nes-btn is-primary"
                    (click)="showToken.set(!showToken())"
                    [title]="showToken() ? 'Hide Token' : 'Show Token'"
                    style="position: absolute; right: 4px; padding: 4px 8px; height: 38px; display: flex; align-items: center; justify-content: center;"
                  >
                    {{ showToken() ? '[X]' : '[EYE]' }}
                  </button>
                </div>
              </div>

              <div class="checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    class="nes-checkbox is-dark"
                    [(ngModel)]="rememberToken"
                    name="rememberToken"
                  />
                  <span class="checkbox-label">REMEMBER TOKEN</span>
                </label>
              </div>
            }

            <hr class="nes-hr" style="margin: 25px 0;" />

            <div class="form-group">
              <label class="form-label">APP NAME</label>
              <input
                type="text"
                class="nes-input is-dark"
                [(ngModel)]="appName"
                name="appName"
                placeholder="angular-sdk-app"
                required
              />
            </div>

            <div class="form-group">
              <label class="form-label">USER ID (CONTEXT)</label>
              <div style="display: flex; gap: 8px;">
                <input
                  type="text"
                  class="nes-input is-dark"
                  [(ngModel)]="userId"
                  name="userId"
                  placeholder="user-abc123"
                  style="flex: 1;"
                />
                <button
                  type="button"
                  class="nes-btn is-warning"
                  (click)="userId = generateRandomUserId()"
                  title="Generate random User ID"
                  style="font-size: 10px; white-space: nowrap;"
                >
                  RANDOM
                </button>
              </div>
            </div>

            <hr class="nes-hr" style="margin: 25px 0;" />

            <!-- Offline Mode -->
            <div class="checkbox-group">
              <label>
                <input
                  type="checkbox"
                  class="nes-checkbox is-dark"
                  [(ngModel)]="offlineMode"
                  name="offlineMode"
                />
                <span class="checkbox-label">OFFLINE MODE</span>
              </label>
            </div>

            @if (!offlineMode) {
              <!-- Polling Interval -->
              <div class="form-group">
                <label class="form-label">POLLING INTERVAL (SEC)</label>
                <div style="display: flex; align-items: center; gap: 20px;">
                  <input
                    type="number"
                    class="nes-input is-dark"
                    [class.is-disabled]="manualPolling"
                    [(ngModel)]="refreshInterval"
                    name="refreshInterval"
                    min="1"
                    [disabled]="manualPolling"
                    style="flex: 1;"
                  />
                  <label style="margin-bottom: 0;">
                    <input
                      type="checkbox"
                      class="nes-checkbox is-dark"
                      [ngModel]="manualPolling"
                      (ngModelChange)="handleManualPollingChange($event)"
                      name="manualPolling"
                    />
                    <span class="checkbox-label">MANUAL</span>
                  </label>
                </div>
              </div>

              <!-- Explicit Sync -->
              <div class="checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    class="nes-checkbox is-dark"
                    [(ngModel)]="explicitSyncMode"
                    name="explicitSyncMode"
                  />
                  <span class="checkbox-label">EXPLICIT SYNC</span>
                </label>
              </div>

              <!-- Streaming -->
              <div class="form-group" style="margin-top: 20px;">
                <label class="form-label">STREAMING (REAL-TIME)</label>
                <div class="checkbox-group" style="margin-bottom: 10px;">
                  <label>
                    <input
                      type="checkbox"
                      class="nes-checkbox is-dark"
                      [(ngModel)]="streamingEnabled"
                      name="streamingEnabled"
                    />
                    <span class="checkbox-label">ENABLE STREAMING</span>
                  </label>
                </div>

                @if (streamingEnabled) {
                  <div style="display: flex; gap: 30px; margin-left: 35px;">
                    <label>
                      <input
                        type="radio"
                        class="nes-radio is-dark"
                        name="streamingMode"
                        [checked]="streamingMode === 'sse'"
                        (change)="streamingMode = 'sse'"
                      />
                      <span>SSE</span>
                    </label>
                    <label>
                      <input
                        type="radio"
                        class="nes-radio is-dark"
                        name="streamingMode"
                        [checked]="streamingMode === 'websocket'"
                        (change)="streamingMode = 'websocket'"
                      />
                      <span>WEBSOCKET</span>
                    </label>
                  </div>
                }
              </div>
            }

            <button
              type="submit"
              class="nes-btn is-success"
              style="width: 100%;"
            >
              START GAME
            </button>
          </form>
        </div>
      </div>
    </div>
  `,
})
export class ConfigFormComponent implements OnInit {
  readonly connect = output<GatrixClientConfig>();

  // Server location
  readonly location = signal<ServerLocation>('local');
  readonly serverType = signal<ServerType>('edge');
  readonly isLocal = computed(() => this.location() === 'local');

  // Connection details
  apiUrl = '';
  apiToken = '';
  appName = 'angular-sdk-app';
  userId = generateRandomUserId();
  rememberToken = false;
  readonly showToken = signal(false);

  // Advanced options
  offlineMode = false;
  refreshInterval = 1;
  manualPolling = false;
  explicitSyncMode = false;
  streamingEnabled = true;
  streamingMode: 'sse' | 'websocket' = 'sse';

  ngOnInit() {
    // Load saved preferences
    const savedLocation =
      (localStorage.getItem(STORAGE_KEY_LOCATION) as ServerLocation) || 'local';
    const savedServerType =
      (localStorage.getItem(STORAGE_KEY_SERVER_TYPE) as ServerType) || 'edge';
    const savedRememberToken =
      localStorage.getItem(STORAGE_KEY_REMEMBER) === 'true';
    const savedToken = localStorage.getItem(STORAGE_KEY_TOKEN) || '';
    const savedApiUrl = localStorage.getItem(STORAGE_KEY_API_URL) || '';
    const savedAppName = localStorage.getItem(STORAGE_KEY_APP_NAME);
    const savedUserId = localStorage.getItem(STORAGE_KEY_USER_ID);

    this.location.set(savedLocation);
    this.serverType.set(savedServerType);
    this.rememberToken = savedRememberToken;

    if (savedAppName) this.appName = savedAppName;
    if (savedUserId) this.userId = savedUserId;

    if (savedLocation === 'local') {
      this.apiUrl = getLocalUrl(savedServerType);
      this.apiToken = getDevToken(savedServerType);
    } else {
      this.apiUrl = savedApiUrl;
      if (savedRememberToken && savedToken) {
        this.apiToken = savedToken;
      }
    }

    this.offlineMode =
      localStorage.getItem(STORAGE_KEY_OFFLINE_MODE) === 'true';
    this.manualPolling =
      localStorage.getItem(STORAGE_KEY_MANUAL_POLLING) === 'true';
    const savedInterval = parseInt(
      localStorage.getItem(STORAGE_KEY_REFRESH_INTERVAL) || '1',
      10,
    );
    this.refreshInterval =
      !this.manualPolling && savedInterval === 0 ? 1 : savedInterval;
    this.explicitSyncMode =
      localStorage.getItem(STORAGE_KEY_EXPLICIT_SYNC) === 'true';
    this.streamingEnabled =
      localStorage.getItem(STORAGE_KEY_STREAMING_ENABLED) !== 'false';
    this.streamingMode =
      (localStorage.getItem(STORAGE_KEY_STREAMING_MODE) as
        | 'sse'
        | 'websocket') || 'sse';
  }

  setLocation(loc: ServerLocation) {
    this.location.set(loc);
    localStorage.setItem(STORAGE_KEY_LOCATION, loc);
    if (loc === 'local') {
      this.apiUrl = getLocalUrl(this.serverType());
      this.apiToken = getDevToken(this.serverType());
    } else {
      this.apiUrl = '';
      this.apiToken = '';
    }
  }

  setServerType(type: ServerType) {
    this.serverType.set(type);
    localStorage.setItem(STORAGE_KEY_SERVER_TYPE, type);
    if (this.isLocal()) {
      this.apiUrl = getLocalUrl(type);
      this.apiToken = getDevToken(type);
    }
  }

  handleManualPollingChange(checked: boolean) {
    this.manualPolling = checked;
    if (!checked && this.refreshInterval === 0) {
      this.refreshInterval = 1;
    }
  }

  generateRandomUserId(): string {
    return generateRandomUserId();
  }

  handleConnect() {
    // Save preferences
    localStorage.setItem(STORAGE_KEY_LOCATION, this.location());
    localStorage.setItem(STORAGE_KEY_SERVER_TYPE, this.serverType());
    localStorage.setItem(STORAGE_KEY_USER_ID, this.userId);
    localStorage.setItem(STORAGE_KEY_APP_NAME, this.appName);
    localStorage.setItem(STORAGE_KEY_OFFLINE_MODE, String(this.offlineMode));
    localStorage.setItem(
      STORAGE_KEY_REFRESH_INTERVAL,
      String(this.manualPolling ? 0 : this.refreshInterval),
    );
    localStorage.setItem(STORAGE_KEY_MANUAL_POLLING, String(this.manualPolling));
    localStorage.setItem(
      STORAGE_KEY_EXPLICIT_SYNC,
      String(this.explicitSyncMode),
    );
    localStorage.setItem(
      STORAGE_KEY_STREAMING_ENABLED,
      String(this.streamingEnabled),
    );
    localStorage.setItem(STORAGE_KEY_STREAMING_MODE, this.streamingMode);

    if (!this.isLocal()) {
      localStorage.setItem(STORAGE_KEY_API_URL, this.apiUrl);
      if (this.rememberToken) {
        localStorage.setItem(STORAGE_KEY_TOKEN, this.apiToken);
        localStorage.setItem(STORAGE_KEY_REMEMBER, 'true');
      } else {
        localStorage.removeItem(STORAGE_KEY_TOKEN);
        localStorage.setItem(STORAGE_KEY_REMEMBER, 'false');
      }
    }

    const config: GatrixClientConfig = {
      apiUrl: this.apiUrl,
      apiToken: this.apiToken,
      appName: this.appName,
      features: {
        context: {
          userId: this.userId,
        },
        offlineMode: this.offlineMode,
        refreshInterval: this.manualPolling ? 0 : this.refreshInterval,
        explicitSyncMode: this.explicitSyncMode,
        streaming: {
          enabled: this.streamingEnabled,
          transport: this.streamingMode,
        },
      },
    };
    this.connect.emit(config);
  }
}
