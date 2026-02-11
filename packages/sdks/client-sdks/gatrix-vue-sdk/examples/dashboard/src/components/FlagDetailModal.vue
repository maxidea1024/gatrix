<script setup lang="ts">
import { computed } from 'vue';
import type { EvaluatedFlag } from '@gatrix/js-client-sdk';

const props = defineProps<{ flag: EvaluatedFlag }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const flagValue = computed(() => props.flag.variant?.value);
const hasValue = computed(() => flagValue.value !== undefined && flagValue.value !== null);
const isEmptyString = computed(() => flagValue.value === '');

function formatValue(v: unknown): string {
  try {
    if (typeof v === 'object') return JSON.stringify(v, null, 2);
    return String(v);
  } catch { return String(v); }
}

function getValueSize(v: unknown): number {
  if (v === undefined || v === null) return 0;
  const str = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return new Blob([str]).size;
}

const valueSize = computed(() => hasValue.value ? getValueSize(flagValue.value) : 0);
</script>

<template>
  <div class="modal-overlay" @click="emit('close')" style="z-index: 5000">
    <div
      :class="['modal-content', 'flag-card-inner', 'rumble-on-pop', flag.enabled ? 'is-enabled' : 'is-disabled']"
      @click.stop
      :style="{
        maxWidth: '700px', width: '90%', maxHeight: '85vh', padding: '0',
        overflow: 'hidden', backgroundColor: '#fff', boxShadow: '0 0 40px rgba(0,0,0,0.5)',
        cursor: 'default', display: 'flex', flexDirection: 'column',
      }"
    >
      <div class="flag-header" style="margin: 0; padding: 8px 16px">
        <span class="flag-name" style="font-size: 12px">
          <span class="status-dot" style="width: 10px; height: 10px"></span>
          {{ flag.name }}
        </span>
        <span :class="`badge ${flag.enabled ? 'badge-success' : 'badge-error'}`" style="font-size: 9px">
          {{ flag.enabled ? 'ON' : 'OFF' }}
        </span>
      </div>

      <div class="modal-scroll-area" style="padding: 12px; margin: 0; flex: 1; overflow-y: auto">
        <div class="flag-details">
          <div class="detail-grid" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; border-bottom: 4px solid #eee; padding-bottom: 12px">
            <div class="flag-detail" style="margin: 0; border: none; flex-direction: column; align-items: flex-start; gap: 4px">
              <span class="flag-detail-label">Version</span>
              <span class="flag-detail-value">{{ flag.version || 0 }}</span>
            </div>
            <div class="flag-detail" style="margin: 0; border: none; flex-direction: column; align-items: flex-start; gap: 4px">
              <span class="flag-detail-label">Type</span>
              <span class="flag-detail-value">
                <span class="pixel-chip type-chip">{{ flag.valueType || 'none' }}</span>
              </span>
            </div>
            <div class="flag-detail" style="margin: 0; border: none; flex-direction: column; align-items: flex-start; gap: 4px">
              <span class="flag-detail-label">Variant</span>
              <span class="flag-detail-value">
                <span class="pixel-chip variant-chip">{{ flag.variant?.name || '-' }}</span>
              </span>
            </div>
          </div>

          <div class="flag-payload" style="margin-top: 12px">
            <div class="flag-payload-label" style="margin-bottom: 6px">Value Detail</div>
            <template v-if="hasValue">
              <pre
                :class="`flag-payload-value ${isEmptyString ? 'empty-string' : 'has-payload'}`"
                :style="{
                  whiteSpace: 'pre-wrap', fontSize: '9px', lineHeight: '1.5',
                  border: '4px solid #ddd', backgroundColor: '#f9f9f9', color: '#1b5e20',
                  padding: '12px', margin: '0',
                }"
              >{{ formatValue(flagValue) }}</pre>
              <div class="flag-payload-size" style="font-size: 8px; color: #888; margin-top: 6px; text-align: right">
                {{ valueSize }} BYTES
              </div>
            </template>
            <div v-else class="flag-payload-value no-payload" style="padding: 20px">✕ NO VALUE</div>
          </div>

          <div v-if="flag.impressionData" class="flag-detail"
            style="margin-top: 12px; border: none; justify-content: flex-start; gap: 10px">
            <span class="flag-detail-label">Impressions:</span>
            <span class="pixel-chip" style="background-color: #e8f5e9; color: #2e7d32; border-color: #2e7d32">
              ENABLED
            </span>
          </div>
        </div>
      </div>

      <div class="modal-footer"
        style="padding: 8px 16px; border-top: 4px solid #eee; display: flex; justify-content: flex-end; background-color: #f5f5f5">
        <button type="button" class="nes-btn is-primary" @click="emit('close')"
          style="font-size: 9px; padding: 6px 12px">CLOSE</button>
      </div>
    </div>
  </div>
</template>
