/**
 * Event Types for SDK
 */

// ============================================================================
// Standard Event Types
// ============================================================================

export type StandardEventType =
  | "gameworld.created"
  | "gameworld.updated"
  | "gameworld.deleted"
  | "gameworld.order_changed"
  | "popup.created"
  | "popup.updated"
  | "popup.deleted"
  | "survey.created"
  | "survey.updated"
  | "survey.deleted"
  | "survey.settings.updated"
  | "maintenance.started"
  | "maintenance.ended"
  | "whitelist.updated";

export interface StandardEventData {
  id: number | string;
  timestamp: number;
  isVisible?: boolean | number; // For gameworld.updated, popup.updated events (MySQL returns 0/1)
  isActive?: boolean | number; // For survey.updated events (MySQL returns 0/1)
}

export interface StandardEvent {
  type: StandardEventType;
  data: StandardEventData;
}
