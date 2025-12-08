/**
 * System KV (Key-Value) definitions
 * 
 * This file allows programmatic definition of system-level KV items.
 * System-defined KV items:
 * - Cannot be deleted
 * - Cannot have their type changed
 * - Can have their value updated
 */

import VarsModel, { VarValueType } from '../models/Vars';
import logger from '../config/logger';

interface SystemKVDefinition {
  key: string;
  value: string | null;
  valueType: VarValueType;
  description: string;
  isCopyable?: boolean;
}

/**
 * System KV definitions
 * Add new system KV items here
 */
const SYSTEM_KV_DEFINITIONS: SystemKVDefinition[] = [
  {
    key: '$clientVersionPassiveData',
    value: JSON.stringify({}),
    valueType: 'object',
    description: 'Passive data sent with client version info queries from client SDK',
    isCopyable: false,
  },
  {
    key: '$platforms',
    value: JSON.stringify([
      { label: 'PC', value: 'pc' },
      { label: 'PC-WeGame', value: 'pc-wegame' },
      { label: 'iOS', value: 'ios' },
      { label: 'Android', value: 'android' },
      { label: 'HarmonyOS', value: 'harmonyos' },
    ]),
    valueType: 'array',
    description: '[elementType:object] Platform definitions with label and value. Used for platform selection in UI.',
    isCopyable: false,
  },
  {
    key: '$channels',
    value: JSON.stringify([
      {
        label: 'PC',
        value: 'pc',
        subChannels: [
          { label: 'PC', value: 'pc' },
        ],
      },
      {
        label: 'iOS',
        value: 'ios',
        subChannels: [
          { label: 'iOS', value: 'ios' },
        ],
      },
    ]),
    valueType: 'array',
    description: '[elementType:object] Channel definitions with label, value, and subChannels. Used for channel selection in UI.',
    isCopyable: false,
  },
];

/**
 * Initialize all system-defined KV items
 * This should be called during application startup
 */
export async function initializeSystemKV(): Promise<void> {
  try {
    logger.info('Initializing system-defined KV items...');

    for (const def of SYSTEM_KV_DEFINITIONS) {
      await VarsModel.defineSystemKV(
        def.key,
        def.value,
        def.valueType,
        def.description,
        def.isCopyable
      );
      logger.info(`System KV initialized: ${def.key}`);
    }

    logger.info(`Successfully initialized ${SYSTEM_KV_DEFINITIONS.length} system KV items`);
  } catch (error) {
    logger.error('Error initializing system KV items:', error);
    throw error;
  }
}

/**
 * Initialize system-defined KV items for a specific environment
 * This should be called when creating a new environment without a base environment
 */
export async function initializeSystemKVForEnvironment(environmentId: string): Promise<void> {
  try {
    logger.info(`Initializing system-defined KV items for environment ${environmentId}...`);

    for (const def of SYSTEM_KV_DEFINITIONS) {
      await VarsModel.defineSystemKV(
        def.key,
        def.value,
        def.valueType,
        def.description,
        def.isCopyable,
        environmentId
      );
      logger.info(`System KV initialized for env ${environmentId}: ${def.key}`);
    }

    logger.info(`Successfully initialized ${SYSTEM_KV_DEFINITIONS.length} system KV items for environment ${environmentId}`);
  } catch (error) {
    logger.error(`Error initializing system KV items for environment ${environmentId}:`, error);
    throw error;
  }
}

/**
 * Get all system KV definitions
 * Useful for checking what system KVs should exist
 */
export function getSystemKVDefinitions(): SystemKVDefinition[] {
  return [...SYSTEM_KV_DEFINITIONS];
}

/**
 * Define a new system KV item programmatically
 * Use this function to add system KV items at runtime
 */
export async function defineSystemKV(
  key: string,
  value: string | null,
  valueType: VarValueType,
  description: string
): Promise<void> {
  try {
    await VarsModel.defineSystemKV(key, value, valueType, description);
    logger.info(`System KV defined: ${key}`);
  } catch (error) {
    logger.error(`Error defining system KV ${key}:`, error);
    throw error;
  }
}

/**
 * Example usage:
 * 
 * // During application startup (in app.ts or similar):
 * import { initializeSystemKV } from './utils/systemKV';
 * await initializeSystemKV();
 * 
 * // To add a new system KV at runtime:
 * import { defineSystemKV } from './utils/systemKV';
 * await defineSystemKV('kv:newSystemKey', 'value', 'string', 'Description');
 */

