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
}

/**
 * System KV definitions
 * Add new system KV items here
 */
const SYSTEM_KV_DEFINITIONS: SystemKVDefinition[] = [
  {
    key: 'kv:marketTypes',
    value: JSON.stringify(['PC', 'A1']),
    valueType: 'array',
    description: '[elementType:string] Market types for the system',
  },
  {
    key: 'kv:clientVersionPassiveData',
    value: JSON.stringify({}),
    valueType: 'object',
    description: 'Passive data sent with client version info queries from client SDK',
  },
  // Add more system KV definitions here as needed
  // Example:
  // {
  //   key: 'kv:defaultTheme',
  //   value: 'light',
  //   valueType: 'string',
  //   description: 'Default theme for the application',
  // },
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
        def.description
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

