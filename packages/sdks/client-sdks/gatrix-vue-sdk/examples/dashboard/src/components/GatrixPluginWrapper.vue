<script setup lang="ts">
/**
 * GatrixPluginWrapper - Wraps children in a sub-app that has GatrixPlugin installed.
 * This allows dynamic config changes by re-keying from the parent.
 *
 * Since Vue's plugin system works at app creation time, and we need to
 * dynamically install GatrixPlugin when the user connects, we use provide/inject
 * directly here to simulate what GatrixPlugin.install() does.
 */
import { ref, provide, onMounted, onUnmounted } from 'vue';
import { GatrixClient, EVENTS, type GatrixClientConfig } from '@gatrix/js-client-sdk';
import { GATRIX_CLIENT_KEY, GATRIX_READY_KEY, GATRIX_HEALTHY_KEY, GATRIX_ERROR_KEY } from '@gatrix/vue-sdk';

const props = defineProps<{
  config: GatrixClientConfig;
}>();

const client = new GatrixClient(props.config);
const ready = ref(client.isReady());
const healthy = ref(true);
const error = ref<Error | null>(null);

function onReady() { ready.value = true; }
function onError(err: Error) { error.value = err; healthy.value = false; }
function onRecovered() { error.value = null; healthy.value = true; }

onMounted(() => {
  client.on(EVENTS.FLAGS_READY, onReady);
  client.on(EVENTS.SDK_ERROR, onError);
  client.on(EVENTS.FLAGS_RECOVERED, onRecovered);

  if (!client.isReady()) {
    client.start();
  }
});

onUnmounted(() => {
  client.off(EVENTS.FLAGS_READY, onReady);
  client.off(EVENTS.SDK_ERROR, onError);
  client.off(EVENTS.FLAGS_RECOVERED, onRecovered);
  client.stop();
});

provide(GATRIX_CLIENT_KEY, client);
provide(GATRIX_READY_KEY, ready);
provide(GATRIX_HEALTHY_KEY, healthy);
provide(GATRIX_ERROR_KEY, error);
</script>

<template>
  <slot />
</template>
