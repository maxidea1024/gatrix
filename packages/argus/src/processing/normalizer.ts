import { createLogger } from '../utils/logger';
import { ArgusErrorEvent } from '../types/events';

const logger = createLogger('normalizer');

/**
 * Normalized error event ready for ClickHouse insertion.
 */
export interface NormalizedError {
  event_id: string;
  project_id: string;
  dsn_key_id: number;
  issue_id: number;
  timestamp: string;
  received_at: string;

  platform: string;
  level: string;
  logger: string;
  type: string;
  value: string;
  mechanism: string;

  fingerprint: string[];
  primary_hash: string;

  exception: string;
  stacktrace_frames: string;
  breadcrumbs: string;

  user_id: string;
  user_email: string;
  user_ip: string;
  user_name: string;

  environment: string;
  release: string;
  dist: string;
  server_name: string;
  transaction: string;

  os_name: string;
  os_version: string;
  browser_name: string;
  browser_version: string;
  device_name: string;
  device_family: string;
  runtime_name: string;
  runtime_version: string;
  sdk_name: string;
  sdk_version: string;

  geo_country: string;
  geo_city: string;
  geo_region: string;

  http_method: string;
  http_url: string;
  http_referer: string;

  tags: Record<string, string>;
  extra: Record<string, string>;
  contexts: string;

  is_handled: number;
  is_symbolicated: number;
}

/**
 * Normalize a raw error event into a flat structure for ClickHouse.
 */
export function normalizeErrorEvent(
  event: ArgusErrorEvent,
  projectId: string
): Omit<NormalizedError, 'issue_id' | 'primary_hash' | 'dsn_key_id'> {
  const contexts = event.contexts || {};
  const user = event.user || {};
  const sdk = event.sdk || { name: '', version: '' };

  const osCtx = contexts.os as { name?: string; version?: string } | undefined;
  const browserCtx = contexts.browser as { name?: string; version?: string } | undefined;
  const deviceCtx = contexts.device as { name?: string; family?: string } | undefined;
  const runtimeCtx = contexts.runtime as { name?: string; version?: string } | undefined;

  const normalized = {
    event_id: event.event_id,
    project_id: projectId,
    timestamp: event.timestamp || new Date().toISOString(),
    received_at: new Date().toISOString(),

    platform: event.platform || 'other',
    level: event.level || 'error',
    logger: event.logger || '',
    type: event.exception?.type || '',
    value: event.exception?.value || '',
    mechanism: event.exception?.mechanism || '',

    fingerprint: event.fingerprint || [],

    exception: JSON.stringify(event.exception || {}),
    stacktrace_frames: JSON.stringify(event.exception?.stacktrace?.frames || []),
    breadcrumbs: JSON.stringify(event.breadcrumbs || []),

    user_id: user.id || '',
    user_email: user.email || '',
    user_ip: user.ip_address || '',
    user_name: user.username || '',

    environment: event.environment || '',
    release: event.release || '',
    dist: event.dist || '',
    server_name: event.server_name || '',
    transaction: event.transaction || '',

    os_name: osCtx?.name || '',
    os_version: osCtx?.version || '',
    browser_name: browserCtx?.name || '',
    browser_version: browserCtx?.version || '',
    device_name: deviceCtx?.name || '',
    device_family: deviceCtx?.family || '',
    runtime_name: runtimeCtx?.name || '',
    runtime_version: runtimeCtx?.version || '',
    sdk_name: sdk.name || '',
    sdk_version: sdk.version || '',

    // GeoIP — placeholder, filled by GeoIP lookup if available
    geo_country: '',
    geo_city: '',
    geo_region: '',

    http_method: '',
    http_url: '',
    http_referer: '',

    tags: event.tags || {},
    extra: event.extra || {},
    contexts: JSON.stringify(contexts),

    is_handled: event.exception?.mechanism === 'onerror' ? 0 : 1,
    is_symbolicated: 0,
  };

  logger.debug('Event normalized', {
    eventId: event.event_id,
    type: normalized.type,
  });

  return normalized;
}
