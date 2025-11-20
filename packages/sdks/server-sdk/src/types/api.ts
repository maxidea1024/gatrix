/**
 * API Request and Response Types
 */

// ============================================================================
// Common Types
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    apiVersion: string;
  };
}

// ============================================================================
// Coupon Types
// ============================================================================

export interface RedeemCouponRequest {
  code: string; // Coupon code
  userId: string; // User ID
  userName: string; // User name
  characterId: string; // Character ID
  worldId: string; // Game world ID
  platform: string; // Platform
  channel: string; // Channel
  subChannel: string; // Sub-channel
  // Note: requestId is passed via x-request-id header, not in body
}

export interface RedeemCouponResponse {
  reward: Reward[]; // Reward list
  userUsedCount: number; // User usage count
  globalUsed: number; // Global usage count
  sequence: number; // Sequence number
  usedAt: string; // Usage timestamp
  rewardMailTitle: string; // Reward email title
  rewardMailContent: string; // Reward email content
}

// ============================================================================
// Game World Types
// ============================================================================

export interface GameWorld {
  id: number;
  worldId: string;
  name: string;
  isMaintenance: boolean;
  maintenanceMessage?: string;
  maintenanceLocales?: Array<{ lang: string; message: string }>;
  displayOrder: number;
  customPayload?: Record<string, any>;
  worldServerAddress: string; // Required: ip:port format (e.g., 192.168.1.100:8080)
  tags?: string[];
  createdAt?: string;
}

export interface GameWorldListResponse {
  worlds: GameWorld[];
}

// ============================================================================
// Ingame Popup Notice Types
// ============================================================================

export interface PopupNotice {
  id: number;
  content: string; // Actual message content (from template or direct)
  targetWorlds: string[] | null;
  targetWorldsInverted?: boolean;
  targetPlatforms: string[] | null;
  targetPlatformsInverted?: boolean;
  targetChannels: string[] | null;
  targetChannelsInverted?: boolean;
  targetSubchannels: string[] | null;
  targetSubchannelsInverted?: boolean;
  targetUserIds: string[] | null;
  targetUserIdsInverted?: boolean;
  displayPriority: number;
  showOnce: boolean;
  startDate?: string | null;
  endDate: string | null;
}

// ============================================================================
// Reward Types
// ============================================================================

export interface Reward {
  type: number;
  id: number;
  quantity: number;
}

// ============================================================================
// Survey Types
// ============================================================================

export interface TriggerCondition {
  type: 'userLevel' | 'joinDays'; // Trigger condition type
  value: number; // Condition value
}

export interface Survey {
  id: string;
  platformSurveyId: string;
  surveyTitle: string;
  surveyContent?: string;
  triggerConditions: TriggerCondition[];
  participationRewards?: Reward[];
  rewardMailTitle?: string;
  rewardMailContent?: string;
  targetPlatforms?: string[];
  targetPlatformsInverted?: boolean;
  targetChannels?: string[];
  targetChannelsInverted?: boolean;
  targetSubchannels?: string[];
  targetSubchannelsInverted?: boolean;
  targetWorlds?: string[];
  targetWorldsInverted?: boolean;
}

export interface SurveySettings {
  defaultSurveyUrl: string;
  completionUrl: string;
  linkCaption: string;
  verificationKey: string;
}

export interface SurveyListParams {
  // Survey list query parameters
}

// ============================================================================
// Service Discovery Types
// ============================================================================

export type ServiceStatus = 'initializing' | 'ready' | 'shutting_down' | 'error' | 'terminated' | 'no-response';

export interface ServicePorts {
  tcp?: number[];
  udp?: number[];
  http?: number[];
}

/**
 * Service labels for categorization and filtering
 * - service: Required, service type (e.g., 'world', 'auth', 'lobby')
 * - group: Optional, service group (e.g., 'kr', 'us', 'production')
 * - Additional custom labels can be added (e.g., env, region, role)
 */
export interface ServiceLabels {
  service: string; // Required: Service type
  group?: string; // Optional: Service group
  [key: string]: string | undefined; // Additional custom labels
}

export interface ServiceInstance {
  instanceId: string; // Unique instance ID (ULID)
  labels: ServiceLabels; // Service labels for categorization
  hostname: string; // Hostname
  externalAddress: string; // External IP address (auto-detected by backend)
  internalAddress: string; // Internal IP address
  ports: ServicePorts; // Service ports
  status: ServiceStatus; // Service status
  stats?: Record<string, any>; // Instance statistics (flexible key-value)
  meta?: Record<string, any>; // Additional metadata (immutable after registration)
  updatedAt: string; // Last update timestamp
}

/**
 * Register service input (full snapshot)
 * Note:
 * - externalAddress is auto-detected by backend from req.ip
 * - hostname is optional; if omitted, os.hostname() will be used
 * - internalAddress is optional; if omitted, the first NIC address will be used
 */
export interface RegisterServiceInput {
  labels: ServiceLabels; // Service labels (required: labels.service)
  hostname?: string; // Optional: Auto-detected from os.hostname() if omitted
  internalAddress?: string; // Optional: Auto-detected from first NIC if omitted
  ports: ServicePorts;
  status?: ServiceStatus; // Default: 'ready'
  stats?: Record<string, any>; // Instance statistics
  meta?: Record<string, any>; // Additional metadata (immutable)
}

/**
 * Update service status input (partial merge)
 * Only sends changed fields. Stats are merged, not replaced.
 *
 * Auto-register fields (only used when autoRegisterIfMissing=true and instance doesn't exist):
 * - hostname, internalAddress, ports are required for auto-register
 * - meta is optional
 */
export interface UpdateServiceStatusInput {
  status?: ServiceStatus; // Optional: Update status
  stats?: Record<string, any>; // Optional: Merge stats
  autoRegisterIfMissing?: boolean; // Optional: Auto-register if not found (default: false)

  // Auto-register fields (only used when autoRegisterIfMissing=true)
  hostname?: string; // Required for auto-register
  internalAddress?: string; // Required for auto-register
  ports?: ServicePorts; // Required for auto-register
  meta?: Record<string, any>; // Optional: static metadata (only set during auto-register)
}

/**
 * Get services query parameters
 * Supports filtering by labels and status
 */
export interface GetServicesParams {
  serviceType?: string; // Filter by labels.service
  serviceGroup?: string; // Filter by labels.group
  status?: ServiceStatus; // Filter by status
  excludeSelf?: boolean; // Exclude current instance (default: true)
  labels?: Record<string, string>; // Additional label filters (e.g., { env: 'prod', region: 'ap-northeast-2' })
}

// ============================================================================
// Whitelist Types
// ============================================================================

/**
 * Whitelist data structure
 */
export interface WhitelistData {
  ipWhitelist: {
    enabled: boolean;
    ips: string[]; // List of whitelisted IPs (supports CIDR notation)
  };
  accountWhitelist: {
    enabled: boolean;
    accountIds: string[]; // List of whitelisted account IDs
  };
}


// ============================================================================
// Maintenance Types
// ============================================================================

export interface MaintenanceDetail {
  type: 'regular' | 'emergency';
  startsAt: string | null;
  endsAt: string | null;
  message: string;
  localeMessages?: { ko?: string; en?: string; zh?: string };
  kickExistingPlayers?: boolean;
  kickDelayMinutes?: number;
}

export interface MaintenanceStatus {
  isUnderMaintenance: boolean;
  detail: MaintenanceDetail | null;
}
