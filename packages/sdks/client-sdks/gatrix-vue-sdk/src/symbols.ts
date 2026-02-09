import type { InjectionKey, Ref } from 'vue';
import type { GatrixClient } from '@gatrix/js-client-sdk';

export const GATRIX_CLIENT_KEY = Symbol('GATRIX_CLIENT_KEY') as InjectionKey<GatrixClient>;
export const GATRIX_READY_KEY = Symbol('GATRIX_READY_KEY') as InjectionKey<Ref<boolean>>;
export const GATRIX_HEALTHY_KEY = Symbol('GATRIX_HEALTHY_KEY') as InjectionKey<Ref<boolean>>;
export const GATRIX_ERROR_KEY = Symbol('GATRIX_ERROR_KEY') as InjectionKey<Ref<Error | null>>;
