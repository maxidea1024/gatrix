/**
 * Streaming configuration type definitions (CocosCreator)
 *
 * CocosCreator supports WebSocket natively across all platforms.
 * SSE is NOT available in CocosCreator's JSB runtime, so we only
 * support WebSocket transport. Polling fallback is handled by the
 * SDK automatically when streaming is disabled or degraded.
 */

/**
 * Streaming transport type.
 * CocosCreator only supports 'websocket'.
 */
export type StreamingTransport = 'websocket';

/**
 * WebSocket-specific streaming configuration
 */
export interface WebSocketStreamingConfig {
  /** WebSocket endpoint URL override (default: derived from apiUrl) */
  url?: string;

  /** Reconnect initial delay in seconds (default: 1) */
  reconnectBase?: number;

  /** Reconnect max delay in seconds (default: 30) */
  reconnectMax?: number;

  /** Ping interval in seconds (default: 30) */
  pingInterval?: number;
}

/**
 * Streaming configuration for real-time flag invalidation
 */
export interface StreamingConfig {
  /** Enable streaming (default: true) */
  enabled?: boolean;

  /** Transport type: only 'websocket' is supported in CocosCreator */
  transport?: StreamingTransport;

  /** WebSocket-specific settings */
  websocket?: WebSocketStreamingConfig;
}
