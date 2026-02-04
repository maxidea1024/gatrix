/**
 * Integration System Events
 *
 * All event types that can trigger integrations.
 * These correspond to audit log actions throughout the system.
 */

export const INTEGRATION_EVENTS = {
  // Feature Flags
  FEATURE_FLAG_CREATED: 'feature_flag_created',
  FEATURE_FLAG_UPDATED: 'feature_flag_updated',
  FEATURE_FLAG_ARCHIVED: 'feature_flag_archived',
  FEATURE_FLAG_REVIVED: 'feature_flag_revived',
  FEATURE_FLAG_DELETED: 'feature_flag_deleted',
  FEATURE_FLAG_ENVIRONMENT_ENABLED: 'feature_flag_environment_enabled',
  FEATURE_FLAG_ENVIRONMENT_DISABLED: 'feature_flag_environment_disabled',
  FEATURE_FLAG_STRATEGY_ADDED: 'feature_flag_strategy_added',
  FEATURE_FLAG_STRATEGY_UPDATED: 'feature_flag_strategy_updated',
  FEATURE_FLAG_STRATEGY_REMOVED: 'feature_flag_strategy_removed',
  FEATURE_FLAG_STALE_ON: 'feature_flag_stale_on',
  FEATURE_FLAG_STALE_OFF: 'feature_flag_stale_off',

  // Segments
  FEATURE_SEGMENT_CREATED: 'feature_segment_created',
  FEATURE_SEGMENT_UPDATED: 'feature_segment_updated',
  FEATURE_SEGMENT_DELETED: 'feature_segment_deleted',

  // Game World
  GAME_WORLD_CREATED: 'game_world_created',
  GAME_WORLD_UPDATED: 'game_world_updated',
  GAME_WORLD_DELETED: 'game_world_deleted',
  GAME_WORLD_MAINTENANCE_ON: 'game_world_maintenance_on',
  GAME_WORLD_MAINTENANCE_OFF: 'game_world_maintenance_off',
  GAME_WORLD_VISIBILITY_CHANGED: 'game_world_visibility_changed',
  GAME_WORLD_ORDER_UPDATED: 'game_world_order_updated',

  // Client Version
  CLIENT_VERSION_CREATED: 'client_version_created',
  CLIENT_VERSION_UPDATED: 'client_version_updated',
  CLIENT_VERSION_DELETED: 'client_version_deleted',
  CLIENT_VERSION_BULK_CREATED: 'client_version_bulk_created',

  // Service Notice
  SERVICE_NOTICE_CREATED: 'service_notice_created',
  SERVICE_NOTICE_UPDATED: 'service_notice_updated',
  SERVICE_NOTICE_DELETED: 'service_notice_deleted',
  SERVICE_NOTICE_BULK_DELETED: 'service_notice_bulk_deleted',
  SERVICE_NOTICE_TOGGLE_ACTIVE: 'service_notice_toggle_active',

  // Coupon
  COUPON_CREATED: 'coupon_created',
  COUPON_UPDATED: 'coupon_updated',
  COUPON_DELETED: 'coupon_deleted',

  // Users
  USER_LOGIN: 'user_login',
  USER_REGISTER: 'user_register',
  USER_CREATED: 'user_created',
  USER_UPDATED: 'user_updated',
  USER_DELETED: 'user_deleted',
  USER_APPROVED: 'user_approved',
  USER_REJECTED: 'user_rejected',
  USER_SUSPENDED: 'user_suspended',
  USER_UNSUSPENDED: 'user_unsuspended',
  USER_PROMOTED: 'user_promoted',
  USER_DEMOTED: 'user_demoted',
  USER_PASSWORD_CHANGED: 'user_password_changed',
  USER_PROFILE_UPDATED: 'user_profile_updated',
  USER_STATUS_UPDATED: 'user_status_updated',
  USER_ROLE_UPDATED: 'user_role_updated',
  USER_PERMISSIONS_UPDATED: 'user_permissions_updated',

  // Whitelist (Account & IP)
  WHITELIST_CREATED: 'whitelist_created',
  WHITELIST_UPDATED: 'whitelist_updated',
  WHITELIST_DELETED: 'whitelist_deleted',
  WHITELIST_TOGGLED: 'whitelist_toggled',
  WHITELIST_BULK_CREATED: 'whitelist_bulk_created',

  // Tags
  TAG_CREATED: 'tag_created',
  TAG_UPDATED: 'tag_updated',
  TAG_DELETED: 'tag_deleted',

  // Environments
  ENVIRONMENT_CREATED: 'environment_created',
  ENVIRONMENT_UPDATED: 'environment_updated',
  ENVIRONMENT_DELETED: 'environment_deleted',

  // Change Requests
  CHANGE_REQUEST_CREATED: 'change_request_created',
  CHANGE_REQUEST_APPROVED: 'change_request_approved',
  CHANGE_REQUEST_REJECTED: 'change_request_rejected',
  CHANGE_REQUEST_APPLIED: 'change_request_applied',
  CHANGE_REQUEST_EXECUTED: 'change_request_executed',

  // Message Templates
  MESSAGE_TEMPLATE_CREATED: 'message_template_created',
  MESSAGE_TEMPLATE_UPDATED: 'message_template_updated',
  MESSAGE_TEMPLATE_DELETED: 'message_template_deleted',
  MESSAGE_TEMPLATE_BULK_DELETED: 'message_template_bulk_deleted',

  // Scheduled Jobs
  JOB_CREATED: 'job_created',
  JOB_UPDATED: 'job_updated',
  JOB_DELETED: 'job_deleted',
  JOB_EXECUTED: 'job_executed',

  // Invitations
  INVITATION_CREATED: 'invitation_created',
  INVITATION_DELETED: 'invitation_deleted',

  // API Tokens
  API_TOKEN_CREATED: 'api_token_created',
  API_TOKEN_UPDATED: 'api_token_updated',
  API_TOKEN_REGENERATED: 'api_token_regenerated',
  API_TOKEN_DELETED: 'api_token_deleted',

  // Integrations
  INTEGRATION_CREATED: 'integration_created',
  INTEGRATION_UPDATED: 'integration_updated',
  INTEGRATION_DELETED: 'integration_deleted',
  INTEGRATION_TEST: 'integration_test',
} as const;

export type IntegrationEventType = (typeof INTEGRATION_EVENTS)[keyof typeof INTEGRATION_EVENTS];

// All event types as array for iteration
export const ALL_INTEGRATION_EVENTS: IntegrationEventType[] = Object.values(INTEGRATION_EVENTS);

/**
 * Integration System Event interface
 */
export interface IntegrationSystemEvent {
  type: IntegrationEventType;
  createdBy?: string;
  createdByUserId?: number;
  environment?: string;
  data?: Record<string, any>;
  preData?: Record<string, any>;
  createdAt: Date;
}
