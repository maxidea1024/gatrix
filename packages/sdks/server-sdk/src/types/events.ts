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
  | 'maintenance.settings.updated'
  | 'maintenance.started'
  | 'maintenance.ended'
  | 'whitelist.updated';

export interface StandardEventData {
  id: number | string;
  timestamp: number;
  isVisible?: boolean | number; // For gameworld.updated, popup.updated events (MySQL returns 0/1)
  isActive?: boolean | number;  // For survey.updated events (MySQL returns 0/1)
  isMaintenance?: boolean; // For maintenance.settings.updated events
  maintenanceStartDate?: string; // For maintenance.settings.updated events
  maintenanceEndDate?: string; // For maintenance.settings.updated events
  maintenanceMessage?: string; // For maintenance.settings.updated events
  maintenanceLocales?: Array<{ lang: string; message: string }>; // For maintenance.settings.updated events
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
// SDK Event Types (for SDK event listeners)
// ============================================================================

export interface SdkEvent {
  type: string;
  data: any;
  timestamp: string; // ISO8601 format
}

// ============================================================================
// Event Listener Types
// ============================================================================

export type EventCallback = (event: SdkEvent) => void | Promise<void>;

export interface EventListenerMap {
  [eventType: string]: EventCallback[];
}

