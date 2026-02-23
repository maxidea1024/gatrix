import { inject } from 'vue';
import { GATRIX_READY_KEY, GATRIX_ERROR_KEY, GATRIX_HEALTHY_KEY } from '../symbols';

export function useFlagsStatus() {
  const ready = inject(GATRIX_READY_KEY);
  const error = inject(GATRIX_ERROR_KEY);
  const healthy = inject(GATRIX_HEALTHY_KEY);

  return {
    ready,
    error,
    healthy,
  };
}
