/**
 * Event Types for BullMQ
 */

// ============================================================================
// Standard Event Types
// ============================================================================

export type StandardEventType =
  | 'gameworld.created'
  | 'gameworld.updated'
  | 'gameworld.deleted'
  | 'gameworld.order_changed'
  | 'popup.created'
  | 'popup.updated'
  | 'popup.deleted'
  | 'survey.created'
  | 'survey.updated'
  | 'survey.deleted'
  | 'survey.settings.updated'
  | 'maintenance.started'
  | 'maintenance.ended';

export interface StandardEventData {
  id: number | string;
  timestamp: number;
  isVisible?: boolean | number; // For gameworld.updated, popup.updated events (MySQL returns 0/1)
  isActive?: boolean | number;  // For survey.updated events (MySQL returns 0/1)
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

