import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { EvaluatedFlag } from '@gatrix/gatrix-js-client-sdk';

@Component({
  selector: 'app-flag-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="nes-container is-dark flag-card"
      [class.flag-enabled]="flag().enabled"
      [class.flag-disabled]="!flag().enabled"
    >
      <div class="flag-header">
        <span class="flag-status-dot" [class.enabled]="flag().enabled"></span>
        <span class="flag-name">{{ flag().name }}</span>
      </div>

      <div class="flag-details">
        <div class="flag-detail-row">
          <span class="flag-label">ENABLED</span>
          <span class="flag-value" [style.color]="flag().enabled ? '#92cc41' : '#e76e55'">
            {{ flag().enabled ? 'YES' : 'NO' }}
          </span>
        </div>
        <div class="flag-detail-row">
          <span class="flag-label">VARIANT</span>
          <span class="flag-value" style="color: #f7d51d;">
            {{ flag().variant.name }}
          </span>
        </div>
        <div class="flag-detail-row">
          <span class="flag-label">TYPE</span>
          <span class="flag-value" style="color: #209cee;">
            {{ flag().valueType }}
          </span>
        </div>
        @if (flag().variant.value !== null && flag().variant.value !== undefined) {
          <div class="flag-detail-row">
            <span class="flag-label">VALUE</span>
            <span class="flag-value" style="color: #fff; word-break: break-all;">
              {{ formatValue(flag().variant.value) }}
            </span>
          </div>
        }
        <div class="flag-detail-row">
          <span class="flag-label">VER</span>
          <span class="flag-value" style="color: #adafbc;">
            v{{ flag().version }}
          </span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .flag-card {
      padding: 12px !important;
      transition: border-color 0.2s;
    }
    .flag-enabled {
      border-color: #92cc41 !important;
    }
    .flag-disabled {
      border-color: #e76e55 !important;
      opacity: 0.7;
    }
    .flag-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .flag-status-dot {
      width: 8px;
      height: 8px;
      background-color: #e76e55;
      flex-shrink: 0;
    }
    .flag-status-dot.enabled {
      background-color: #92cc41;
    }
    .flag-name {
      color: #fff;
      font-size: 8px;
      word-break: break-all;
    }
    .flag-details {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .flag-detail-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
    }
    .flag-label {
      color: #adafbc;
      font-size: 6px;
      flex-shrink: 0;
    }
    .flag-value {
      font-size: 7px;
      text-align: right;
    }
  `],
})
export class FlagCardComponent {
  readonly flag = input.required<EvaluatedFlag>();

  formatValue(value: unknown): string {
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }
}
