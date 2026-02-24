/**
 * Streaming configuration type definitions
 */

/**
 * Streaming transport type
 */
export type StreamingTransport = 'sse' | 'websocket';

/**
 * SSE-specific streaming configuration
 */
export interface SseStreamingConfig {
  /** SSE endpoint URL override (default: derived from apiUrl) */
  url?: string;

  /** Reconnect initial delay in seconds (default: 1) */
  reconnectBase?: number;

  /** Reconnect max delay in seconds (default: 30) */
  reconnectMax?: number;

  /** Polling jitter range in seconds to prevent thundering herd (default: 5) */
  pollingJitter?: number;
}

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

  /** Transport type: 'sse' (default) or 'websocket' */
  transport?: StreamingTransport;

  /** SSE-specific settings */
  sse?: SseStreamingConfig;

  /** WebSocket-specific settings */
  websocket?: WebSocketStreamingConfig;
}
