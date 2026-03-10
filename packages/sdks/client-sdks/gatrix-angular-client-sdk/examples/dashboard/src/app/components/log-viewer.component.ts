import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { LogEntry } from './dashboard.component';

@Component({
  selector: 'app-log-viewer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="nes-container is-dark log-container">
      <div class="log-header">
        <span class="log-title">📜 EVENT LOG</span>
        <span class="log-count">{{ logs().length }}</span>
      </div>
      <div class="log-entries">
        @for (log of logs(); track $index) {
          <div class="log-entry" [class]="'log-' + log.type">
            <span class="log-time">{{ log.time }}</span>
            <span class="log-event">{{ log.event }}</span>
            <span class="log-detail">{{ log.detail }}</span>
          </div>
        }
        @if (logs().length === 0) {
          <div class="log-entry log-info">
            <span class="log-detail">Waiting for events...</span>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .log-container {
        padding: 8px !important;
        max-height: 200px;
        display: flex;
        flex-direction: column;
      }
      .log-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }
      .log-title {
        color: #adafbc;
        font-size: 8px;
      }
      .log-count {
        color: #666;
        font-size: 7px;
      }
      .log-entries {
        overflow-y: auto;
        flex: 1;
      }
      .log-entry {
        display: flex;
        gap: 8px;
        padding: 2px 0;
        font-size: 7px;
        border-bottom: 1px solid #333;
      }
      .log-time {
        color: #666;
        flex-shrink: 0;
        font-family: 'Courier New', monospace;
      }
      .log-event {
        color: #adafbc;
        flex-shrink: 0;
        min-width: 120px;
      }
      .log-detail {
        color: #fff;
        word-break: break-all;
      }
      .log-info .log-event {
        color: #209cee;
      }
      .log-success .log-event {
        color: #92cc41;
      }
      .log-warning .log-event {
        color: #f7d51d;
      }
      .log-error .log-event {
        color: #e76e55;
      }
      .log-error .log-detail {
        color: #e76e55;
      }
    `,
  ],
})
export class LogViewerComponent {
  readonly logs = input.required<LogEntry[]>();
}
