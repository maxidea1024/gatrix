import { config, createLogger, ArgusErrorEvent } from '@gatrix/argus';

const logger = createLogger('symbolicator-client');

/**
 * Frame format expected by Symbolicator JS endpoint.
 * Maps to `symbolicator-js::interface::JsFrame`.
 */
interface SymbolicatorJsFrame {
  function?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  abs_path?: string;
  in_app?: boolean;
}

/**
 * Stacktrace format for Symbolicator JS endpoint.
 */
interface SymbolicatorJsStacktrace {
  frames: SymbolicatorJsFrame[];
}

/**
 * Symbolicator JS response frame with resolved source locations.
 */
interface SymbolicatedFrame {
  function?: string;
  filename?: string;
  abs_path?: string;
  lineno?: number;
  colno?: number;
  in_app?: boolean;
  pre_context?: string[];
  context_line?: string;
  post_context?: string[];
  status?: string;
}

/**
 * Symbolicator JS symbolication response.
 */
interface SymbolicatorJsResponse {
  status: string;
  stacktraces?: Array<{
    frames: SymbolicatedFrame[];
  }>;
  errors?: Array<{
    type: string;
    message?: string;
    abs_path?: string;
  }>;
}

/**
 * Convert Argus SDK stacktrace frames into Symbolicator format.
 */
function toSymbolicatorFrames(
  frames: Array<{
    function?: string;
    filename?: string;
    lineno?: number;
    colno?: number;
    abs_path?: string;
    in_app?: boolean;
  }>
): SymbolicatorJsFrame[] {
  return frames.map((f) => ({
    function: f.function,
    filename: f.filename,
    lineno: f.lineno,
    colno: f.colno,
    abs_path: f.abs_path || f.filename,
    in_app: f.in_app,
  }));
}

/**
 * Attempt to symbolicate a JS error event via the Symbolicator service.
 *
 * - Sends stacktrace frames to `POST /symbolicate-js-stacktraces`
 * - Returns mutated event with symbolicated frames and `is_symbolicated = 1`
 * - On failure (timeout, network error, symbolicator disabled), returns the
 *   original event unchanged with `is_symbolicated = 0`
 *
 * This function NEVER throws. Symbolication failure is non-fatal.
 */
export async function symbolicateErrorEvent(
  event: ArgusErrorEvent & { project_id: string }
): Promise<{ event: ArgusErrorEvent & { project_id: string }; symbolicated: boolean }> {
  const { symbolicator } = config;

  // Skip if symbolicator is disabled
  if (!symbolicator.enabled) {
    return { event, symbolicated: false };
  }

  // Only JS-like platforms have source maps
  const platform = event.platform || 'other';
  const jsLikePlatforms = ['javascript', 'node', 'react-native', 'electron'];
  if (!jsLikePlatforms.includes(platform)) {
    return { event, symbolicated: false };
  }

  // Must have stacktrace frames
  const frames = event.exception?.stacktrace?.frames;
  if (!frames || frames.length === 0) {
    return { event, symbolicated: false };
  }

  // Check if frames are already symbolicated (have valid source locations)
  const hasMinifiedFrames = frames.some(
    (f) =>
      (f.filename && (f.filename.includes('.min.') || f.filename.includes('bundle'))) ||
      (!f.function || f.function === '?' || f.function === '<anonymous>')
  );

  if (!hasMinifiedFrames) {
    // Frames look already symbolicated
    return { event, symbolicated: false };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), symbolicator.timeoutMs);

    const body = {
      stacktraces: [
        {
          frames: toSymbolicatorFrames(frames),
        },
      ] as SymbolicatorJsStacktrace[],
      modules: [],
      release: event.release || undefined,
      dist: event.dist || undefined,
      platform,
      // Source config pointing to Argus sourcemap lookup API.
      // Symbolicator will fetch source maps from this URL.
      source: {
        type: 'http' as const,
        id: 'argus-sourcemaps',
        url: `${config.symbolicator.url}`,
        // Layout is not used for JS source maps, but required by the type
        layout: { type: 'unified' },
        is_public: false,
      },
    };

    const response = await fetch(
      `${symbolicator.url}/symbolicate-js-stacktraces`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!response.ok) {
      logger.warn('Symbolicator returned non-OK status', {
        status: response.status,
        eventId: event.event_id,
      });
      return { event, symbolicated: false };
    }

    const result = (await response.json()) as SymbolicatorJsResponse;

    if (result.status !== 'completed' || !result.stacktraces?.[0]) {
      logger.debug('Symbolicator did not complete symbolication', {
        status: result.status,
        eventId: event.event_id,
      });
      return { event, symbolicated: false };
    }

    // Apply symbolicated frames back to the event
    const symbolicatedFrames = result.stacktraces[0].frames;
    const updatedEvent = {
      ...event,
      exception: {
        ...event.exception,
        stacktrace: {
          ...event.exception?.stacktrace,
          frames: symbolicatedFrames.map((sf, i) => {
            const original = frames[i] || {};
            return {
              ...original,
              function: sf.function || original.function,
              filename: sf.filename || original.filename,
              abs_path: sf.abs_path || original.abs_path,
              lineno: sf.lineno ?? original.lineno,
              colno: sf.colno ?? original.colno,
              in_app: sf.in_app ?? original.in_app,
              pre_context: sf.pre_context,
              context_line: sf.context_line,
              post_context: sf.post_context,
            };
          }),
        },
      },
    };

    logger.debug('Event symbolicated', {
      eventId: event.event_id,
      frameCount: symbolicatedFrames.length,
    });

    return { event: updatedEvent as ArgusErrorEvent & { project_id: string }, symbolicated: true };
  } catch (error) {
    // AbortError = timeout, other = network issue — both non-fatal
    const isTimeout = error instanceof Error && error.name === 'AbortError';
    logger.warn('Symbolicator call failed (non-blocking)', {
      eventId: event.event_id,
      reason: isTimeout ? 'timeout' : (error instanceof Error ? error.message : String(error)),
    });
    return { event, symbolicated: false };
  }
}
