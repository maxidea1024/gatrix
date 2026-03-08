import { ref, onMounted, onUnmounted } from 'vue';
import { useGatrixClient } from './useGatrixClient';
import { EVENTS, type EvaluatedFlag } from '@gatrix/gatrix-js-client-sdk';

export function useFlags(forceRealtime = true) {
  const client = useGatrixClient();
  const flags = ref<EvaluatedFlag[]>(
    client.features.getAllFlags(forceRealtime)
  );

  const updateFlags = () => {
    flags.value = client.features.getAllFlags(forceRealtime);
  };

  onMounted(() => {
    client.on(EVENTS.FLAGS_CHANGE, updateFlags);
    client.on(EVENTS.FLAGS_READY, updateFlags);
    client.on(EVENTS.FLAGS_SYNC, updateFlags);
  });

  onUnmounted(() => {
    client.off(EVENTS.FLAGS_CHANGE, updateFlags);
    client.off(EVENTS.FLAGS_READY, updateFlags);
    client.off(EVENTS.FLAGS_SYNC, updateFlags);
  });

  return flags;
}
