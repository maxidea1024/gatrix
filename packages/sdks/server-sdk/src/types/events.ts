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
  | 'whitelist.updated'
  | 'client_version.updated'
  | 'banner.created'
  | 'banner.updated'
  | 'banner.deleted'
  | 'service_notice.updated'
  | 'store_product.created'
  | 'store_product.updated'
  | 'store_product.deleted'
  | 'environment.created'
  | 'environment.deleted';

export interface StandardEventData {
  id: number | string;
  timestamp: number;
  /**
   * Environment identifier (environmentName value).
   * This is the standard external identifier for environments.
   */
  environment?: string;
  isVisible?: boolean | number; // For gameworld.updated, popup.updated events (MySQL returns 0/1)
  isActive?: boolean | number;  // For survey.updated, store_product.updated events (MySQL returns 0/1)
  status?: string; // For banner.created, banner.updated events (draft, published, archived)
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
