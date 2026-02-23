/**
 * Type definitions for Gatrix Client SDK
 *
 * Re-exports all types from individual modules for convenience.
 */

// Flag & variant types
export type { Variant, ValueType, EvaluatedFlag, FlagsApiResponse, VariationResult, ImpressionEvent } from './flag';

// Context types
export type { GatrixContext } from './context';

// Configuration types
export type {
    FetchRetryOptions,
    FeaturesConfig,
    GatrixClientConfig,
} from './config';

// Streaming types
export type {
    StreamingTransport,
    SseStreamingConfig,
    WebSocketStreamingConfig,
    StreamingConfig,
} from './streaming';

// Stats & state types
export type {
    SdkState,
    StreamingConnectionState,
    ErrorEvent,
    FlagsChangedEvent,
    EventHandlerStats,
    GatrixSdkStats,
    FeaturesStats,
} from './stats';
