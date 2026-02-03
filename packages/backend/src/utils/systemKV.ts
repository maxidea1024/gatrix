/**
 * System KV (Key-Value) definitions
 *
 * This file allows programmatic definition of system-level KV items.
 */

import VarsModel, { VarValueType } from '../models/Vars';
import logger from '../config/logger';
import { getAllEnvironments } from './environmentContext';
import knex from '../config/knex';

interface SystemKVDefinition {
  key: string;
  value: string | null;
  valueType: VarValueType;
  description: string;
  isCopyable?: boolean;
}

/**
 * System KV definitions
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
    description:
      '[elementType:object] Platform definitions with label and value. Used for platform selection in UI.',
    isCopyable: false,
  },
  {
    key: '$channels',
    value: JSON.stringify([
      {
        label: 'PC',
        value: 'pc',
        subChannels: [{ label: 'PC', value: 'pc' }],
      },
      {
        label: 'iOS',
        value: 'ios',
        subChannels: [{ label: 'iOS', value: 'ios' }],
      },
    ]),
    valueType: 'array',
    description:
      '[elementType:object] Channel definitions with label, value, and subChannels. Used for channel selection in UI.',
    isCopyable: false,
  },
];

/**
 * Initialize all system-defined KV items for all environments
 */
export async function initializeAllSystemKV(): Promise<void> {
  try {
    logger.info('Initializing system-defined KV items for all environments...');
    const environments = await getAllEnvironments(knex);

    for (const environment of environments) {
      await initializeSystemKV(environment);
    }

    logger.info(`Successfully initialized system KV items for ${environments.length} environments`);
  } catch (error) {
    logger.error('Error initializing all system KV items:', error);
    throw error;
  }
}

/**
 * Initialize system-defined KV items for a specific environment
 */
export async function initializeSystemKV(environment: string): Promise<void> {
  try {
    logger.info(`Initializing system-defined KV items for environment ${environment}...`);

    for (const def of SYSTEM_KV_DEFINITIONS) {
      await VarsModel.defineSystemKV(
        def.key,
        def.value,
        def.valueType,
        environment,
        def.description,
        def.isCopyable
      );
      logger.info(`System KV initialized for env ${environment}: ${def.key}`);
    }

    logger.info(
      `Successfully initialized ${SYSTEM_KV_DEFINITIONS.length} system KV items for environment ${environment}`
    );
  } catch (error) {
    logger.error(`Error initializing system KV items for environment ${environment}:`, error);
    throw error;
  }
}

/**
 * Get all system KV definitions
 */
export function getSystemKVDefinitions(): SystemKVDefinition[] {
  return [...SYSTEM_KV_DEFINITIONS];
}

/**
 * Define a new system KV item programmatically
 */
export async function defineSystemKV(
  key: string,
  value: string | null,
  valueType: VarValueType,
  environment: string,
  description: string
): Promise<void> {
  try {
    await VarsModel.defineSystemKV(key, value, valueType, environment, description);
    logger.info(`System KV defined: ${key} in ${environment}`);
  } catch (error) {
    logger.error(`Error defining system KV ${key} in ${environment}:`, error);
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
