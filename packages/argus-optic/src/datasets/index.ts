import { DatasetConfig } from '../types';
import { errorsDataset } from './errors';
import { transactionsDataset } from './transactions';
import { spansDataset } from './spans';
import { sessionsDataset } from './sessions';
import { logsDataset } from './logs';
import { metricsDataset } from './metrics';
import { feedbackDataset } from './feedback';
import { cronCheckinsDataset, uptimeCheckinsDataset } from './monitor-checkins';
import { activitiesDataset } from './activities';

// ─────────────────────────────────────────────────────────────────────────────
// Dataset Registry — Central lookup for all ClickHouse datasets
// ─────────────────────────────────────────────────────────────────────────────

const datasets = new Map<string, DatasetConfig>();

function register(config: DatasetConfig): void {
  if (datasets.has(config.name)) {
    throw new Error(`Dataset '${config.name}' is already registered`);
  }
  datasets.set(config.name, config);
}

// Register all datasets
register(errorsDataset);
register(transactionsDataset);
register(spansDataset);
register(sessionsDataset);
register(logsDataset);
register(metricsDataset);
register(feedbackDataset);
register(cronCheckinsDataset);
register(uptimeCheckinsDataset);
register(activitiesDataset);

/**
 * Get a dataset by name. Throws if not found.
 */
export function getDataset(name: string): DatasetConfig {
  const dataset = datasets.get(name);
  if (!dataset) {
    throw new Error(
      `Unknown dataset: '${name}'. Available: ${[...datasets.keys()].join(', ')}`
    );
  }
  return dataset;
}

/**
 * Check if a dataset exists by name.
 */
export function hasDataset(name: string): boolean {
  return datasets.has(name);
}

/**
 * Get all registered dataset names.
 */
export function getDatasetNames(): string[] {
  return [...datasets.keys()];
}

// Re-export individual datasets for direct access
export { errorsDataset } from './errors';
export { transactionsDataset } from './transactions';
export { spansDataset } from './spans';
export { sessionsDataset } from './sessions';
export { logsDataset } from './logs';
export { metricsDataset } from './metrics';
export { feedbackDataset } from './feedback';
export { cronCheckinsDataset, uptimeCheckinsDataset } from './monitor-checkins';
export { activitiesDataset } from './activities';
