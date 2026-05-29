import * as crypto from 'crypto';
import { createLogger } from '../utils/logger';
import { ArgusErrorEvent, ArgusStackFrame } from '../types/events';

const logger = createLogger('fingerprinter');

/**
 * Compute fingerprint and primary hash for an error event.
 * Returns { fingerprint, primary_hash }.
 */
export function computeFingerprint(
  event: ArgusErrorEvent,
  _serverRules: any[] = [] // TODO: load from g_argus_fingerprintRules
): { fingerprint: string[]; primary_hash: string } {
  let fingerprint: string[];

  // Step 1: SDK custom fingerprint
  if (
    event.fingerprint &&
    event.fingerprint.length > 0 &&
    event.fingerprint[0] !== '{{ default }}'
  ) {
    fingerprint = event.fingerprint;
  } else {
    // Step 2: Server rules (future)
    // Step 3: Default algorithm
    fingerprint = computeDefaultFingerprint(event);
  }

  const primary_hash = hashFingerprint(fingerprint);

  logger.debug('Fingerprint computed', {
    eventId: event.event_id,
    fingerprint,
    primary_hash,
  });

  return { fingerprint, primary_hash };
}

function computeDefaultFingerprint(event: ArgusErrorEvent): string[] {
  const frames = getInAppFrames(event);

  // Strategy 1: Use in-app stack frames
  if (frames.length > 0) {
    const components = frames.map((f) =>
      [
        normalizeModule(f.module),
        normalizeFunction(f.function),
        f.filename ? normalizePath(f.filename) : null,
      ]
        .filter(Boolean)
        .join(':')
    );
    return [event.exception?.type || 'Error', ...components];
  }

  // Strategy 2: Exception type + normalized message
  if (event.exception?.type) {
    return [
      event.exception.type,
      normalizeMessage(event.exception.value || ''),
    ];
  }

  // Strategy 3: Normalized message only
  return [normalizeMessage(event.exception?.value || 'unknown')];
}

function getInAppFrames(event: ArgusErrorEvent): ArgusStackFrame[] {
  const frames = event.exception?.stacktrace?.frames || [];
  const inApp = frames.filter((f) => f.in_app === true);
  // If no frames are marked in_app, use all frames
  return inApp.length > 0 ? inApp : frames;
}

function normalizeModule(mod?: string): string | null {
  if (!mod) return null;
  // Remove version suffixes, normalize separators
  return mod.replace(/[@#]\d+.*$/, '').replace(/\\/g, '/');
}

function normalizeFunction(fn?: string): string | null {
  if (!fn) return null;
  // Remove memory addresses, template parameters
  return fn
    .replace(/\s*\(.*\)$/, '')
    .replace(/0x[0-9a-fA-F]+/g, '')
    .trim();
}

function normalizePath(p: string): string {
  return p
    .replace(/^(webpack:\/\/\/|app:\/\/\/)/, '')
    .replace(/\?.*$/, '')
    .replace(/\\/g, '/');
}

function normalizeMessage(msg: string): string {
  return msg
    .replace(/0x[0-9a-fA-F]+/g, '<hex>')
    .replace(/\b\d+\b/g, '<int>')
    .replace(/"[^"]*"/g, '<str>')
    .replace(/'[^']*'/g, '<str>')
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      '<uuid>'
    )
    .replace(/https?:\/\/[^\s]+/g, '<url>')
    .trim();
}

function hashFingerprint(fingerprint: string[]): string {
  const hash = crypto.createHash('md5');
  hash.update(fingerprint.join('\n'));
  return hash.digest('hex');
}
