/**
 * Event Types for BullMQ
 */

// ============================================================================
// Standard Event Types
// ============================================================================

export type StandardEventType =
  | 'gameworld.updated'
  | 'gameworld.deleted'
  | 'popup.updated'
  | 'popup.deleted'
  | 'survey.updated'
  | 'survey.deleted'
  | 'maintenance.started'
  | 'maintenance.ended';

export interface StandardEventData {
  id: number | string;
  timestamp: number;
}

export interface StandardEvent {
  type: StandardEventType;
  data: StandardEventData;
}

// ============================================================================
// Custom Event Types
// ============================================================================

export interface CustomEvent {
  type: string; // Custom event type (e.g., 'custom:player.levelup')
  data: any; // Custom data
  timestamp: number;
}

// ============================================================================
// Event Listener Types
// ============================================================================

export type EventCallback = (event: StandardEvent | CustomEvent) => void | Promise<void>;

export interface EventListenerMap {
  [eventType: string]: EventCallback[];
}

