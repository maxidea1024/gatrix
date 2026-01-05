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
// Environment Types
// ============================================================================

export interface EnvironmentInfo {
  environment: string;
  displayName: string;
  environmentType: string;
  color?: string;
}

export interface EnvironmentListResponse {
  environments: EnvironmentInfo[];
  count: number;
}

// ============================================================================
// Client Version Types
// ============================================================================

export type ClientStatus =
  | 'ONLINE'
  | 'OFFLINE'
  | 'RECOMMENDED_UPDATE'
  | 'FORCED_UPDATE'
  | 'UNDER_REVIEW'
  | 'BLOCKED_PATCH_ALLOWED'
  | 'MAINTENANCE';

export interface ClientVersionMaintenanceLocale {
  lang: string;
  message: string;
}

export interface ClientVersion {
  id: number;
  platform: string;
  clientVersion: string;
  clientStatus: ClientStatus;
  gameServerAddress: string;
  gameServerAddressForWhiteList?: string;
  patchAddress: string;
  patchAddressForWhiteList?: string;
  guestModeAllowed: boolean;
  externalClickLink?: string;
  memo?: string;
  customPayload?: Record<string, any>;
  maintenanceStartDate?: string;
  maintenanceEndDate?: string;
  maintenanceMessage?: string;
  supportsMultiLanguage?: boolean;
  maintenanceLocales?: ClientVersionMaintenanceLocale[];
  tags?: { id: number; name: string; color: string }[];
  createdAt?: string;
  updatedAt?: string;
}

// Single-environment mode response
export interface ClientVersionListResponse {
  clientVersions: ClientVersion[];
  total: number;
}

// Multi-environment mode response (byEnvironment is keyed by environmentName)
export interface ClientVersionByEnvResponse {
  byEnvironment: Record<string, ClientVersion[]>;
  total: number;
}

// ============================================================================
// Service Notice Types
// ============================================================================

export type ServiceNoticeCategory = 'maintenance' | 'event' | 'notice' | 'promotion' | 'other';

export interface ServiceNotice {
  id: number;
  isActive: boolean;
  category: ServiceNoticeCategory;
  platforms: string[];
  channels?: string[];
  subchannels?: string[];
  startDate: string | null;
  endDate: string | null;
  tabTitle?: string | null;
  title: string;
  content: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Single-environment mode response
export interface ServiceNoticeListResponse {
  notices: ServiceNotice[];
  total: number;
}

// Multi-environment mode response (byEnvironment is keyed by environmentName)
export interface ServiceNoticeByEnvResponse {
  byEnvironment: Record<string, ServiceNotice[]>;
  total: number;
}

// ============================================================================
// Banner Types
// ============================================================================

export type BannerStatus = 'draft' | 'published' | 'archived';
export type FrameActionType = 'openUrl' | 'command' | 'deepLink' | 'none';
export type FrameActionTarget = 'webview' | 'external';
export type TransitionType = 'fade' | 'slide' | 'crossfade' | 'none';
export type LoopModeType = 'loop' | 'pingpong' | 'once';
export type FrameType = 'jpg' | 'png' | 'gif' | 'mp4';

export interface FrameAction {
  type: FrameActionType;
  target?: FrameActionTarget;
  value?: string;
}

export interface FrameTransition {
  type: TransitionType;
  duration: number;
}

export interface Frame {
  frameId: string;
  imageUrl: string;
  type: FrameType;
  delay: number;
  loop?: boolean;
  action?: FrameAction;
  transition?: FrameTransition;
  meta?: Record<string, any>;
}

export interface SequenceTransition {
  type: TransitionType;
  duration: number;
}

export interface Sequence {
  sequenceId: string;
  name: string;
  speedMultiplier: number;
  loopMode: LoopModeType;
  transition?: SequenceTransition;
  frames: Frame[];
}

export interface Banner {
  bannerId: string;
  name: string;
  description?: string;
  width: number;
  height: number;
  metadata?: Record<string, any>;
  playbackSpeed: number;
  shuffle: boolean;
  sequences: Sequence[];
  version: number;
  status: BannerStatus;
  createdAt?: string;
  updatedAt?: string;
}

// Single-environment mode response
export interface BannerListResponse {
  banners: Banner[];
  total: number;
}

// Multi-environment mode response (byEnvironment is keyed by environmentName)
export interface BannerByEnvResponse {
  byEnvironment: Record<string, Banner[]>;
  total: number;
}

// ============================================================================
// Store Product Types
// ============================================================================

export interface StoreProduct {
  id: string; // ULID - used for event matching
  cmsProductId: number; // CMS product ID
  isActive?: boolean; // Optional - stripped in SDK response
  productId: string;
  productName: string;
  store: string;
  price: number;
  currency: string;
  saleStartAt: string | null;
  saleEndAt: string | null;
  description: string | null;
  metadata?: Record<string, any> | null; // Optional - stripped in SDK response
  tags?: string[]; // Tag names only
  createdAt?: string;
  updatedAt?: string;
}

// Single-environment mode response
export interface StoreProductListResponse {
  products: StoreProduct[];
  total: number;
}

// Multi-environment mode response (byEnvironment is keyed by environmentName)
export interface StoreProductByEnvResponse {
  byEnvironment: Record<string, StoreProduct[]>;
  total: number;
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
  maintenanceStartDate?: string;
  maintenanceEndDate?: string;
  supportsMultiLanguage?: boolean;
  maintenanceLocales?: Array<{ lang: string; message: string }>;
  forceDisconnect?: boolean; // Force disconnect existing players when maintenance starts
  gracePeriodMinutes?: number; // Grace period in minutes before disconnecting players
  displayOrder: number;
  customPayload?: Record<string, any>;
  infraSettings?: Record<string, any>; // Infrastructure settings passed to game servers
  worldServerAddress: string; // Required: URL or host:port format (e.g., https://world.example.com or world.example.com:8080)
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

export type ServiceStatus = 'initializing' | 'ready' | 'shutting_down' | 'error' | 'terminated' | 'no-response' | 'heartbeat';

/**
 * Service Ports - Named port mapping
 * Format: { serviceName: port }
 * Example: { game: 7777, internalApi: 8080, externalApi: 8081, metricsApi: 9337 }
 *
 * Common port names:
 * - game: Main game server port
 * - internalApi: Internal HTTP/REST API port (for internal services)
 * - externalApi: External HTTP/REST API port (for external access like edge servers)
 * - websocket: WebSocket server port
 * - grpc: gRPC server port
 * - metricsApi: Prometheus metrics port (default: 9337)
 */
export interface ServicePorts {
  [serviceName: string]: number;
}

/**
 * Service labels for categorization and filtering
 * - service: Required, service type (e.g., 'world', 'auth', 'lobby')
 * - group: Optional, service group (e.g., 'kr', 'us', 'production')
 * - environment: Optional, environment identifier (e.g., 'env_prod', 'env_staging')
 * - region: Optional, geographic region (e.g., 'kr', 'us', 'eu', 'asia')
 * - Additional custom labels can be added
 */
export interface ServiceLabels {
  service: string; // Required: Service type
  group?: string; // Optional: Service group
  environment?: string; // Optional: Environment identifier
  region?: string; // Optional: Geographic region
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
  instanceId?: string; // Optional: Use existing instance ID for re-registration
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
  autoRegisterIfMissing?: boolean; // Optional: Auto-register if not found (default: true)

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
  service?: string; // Filter by labels.service
  group?: string; // Filter by labels.group
  environment?: string; // Filter by labels.environment
  region?: string; // Filter by labels.region
  status?: ServiceStatus; // Filter by status
  excludeSelf?: boolean; // Exclude current instance (default: true)
  labels?: Record<string, string>; // Additional label filters
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
  /**
   * Whether maintenance is scheduled/configured (stored in DB as isMaintenance=true).
   * This does NOT mean maintenance is currently active - use isMaintenanceActive for that.
   *
   * @example
   * // Maintenance scheduled for future: hasMaintenanceScheduled=true, isMaintenanceActive=false
   * // Maintenance currently active: hasMaintenanceScheduled=true, isMaintenanceActive=true
   * // No maintenance: hasMaintenanceScheduled=false, isMaintenanceActive=false
   */
  hasMaintenanceScheduled: boolean;

  /**
   * Whether maintenance is currently active (time-based check).
   * True only when current time is within startsAt and endsAt range.
   */
  isMaintenanceActive: boolean;

  /**
   * @deprecated Use hasMaintenanceScheduled instead. This field will be removed in a future version.
   * Kept for backward compatibility - same value as hasMaintenanceScheduled.
   */
  isUnderMaintenance: boolean;

  detail: MaintenanceDetail | null;
}

/**
 * Comprehensive maintenance information returned by getMaintenanceInfo()
 */
export interface MaintenanceInfo {
  /** Whether the service/world is currently in maintenance (time-based check) */
  isMaintenanceActive: boolean;
  /** Source of maintenance: 'service' for global, 'world' for world-level, null if not in maintenance */
  source: 'service' | 'world' | null;
  /** World ID if source is 'world' */
  worldId?: string;
  /** Localized maintenance message */
  message: string | null;
  /** Whether to force disconnect existing players */
  forceDisconnect: boolean;
  /** Grace period in minutes before disconnecting players */
  gracePeriodMinutes: number;
  /** Maintenance start time (ISO 8601 string) */
  startsAt: string | null;
  /** Maintenance end time (ISO 8601 string) */
  endsAt: string | null;
  /**
   * Actual time when maintenance started (ISO 8601 string)
   * Used by clients to calculate remaining grace period:
   * remainingGraceMinutes = gracePeriodMinutes - ((Date.now() - new Date(actualStartTime).getTime()) / 60000)
   */
  actualStartTime: string | null;
}

/**
 * Maintenance detail for client delivery
 * Contains all information needed for client to display maintenance status
 */
export interface MaintenanceDetailSummary {
  /** Maintenance start time (ISO 8601 string) */
  startsAt?: string | null;
  /** Maintenance end time (ISO 8601 string) */
  endsAt?: string | null;
  /** Default maintenance message */
  message?: string;
  /** Localized maintenance messages */
  localeMessages?: { ko?: string; en?: string; zh?: string };
  /** Whether to force disconnect existing players */
  forceDisconnect?: boolean;
  /** Grace period in minutes before disconnecting players */
  gracePeriodMinutes?: number;
}

/**
 * Current maintenance status for client delivery
 * Used for initial client delivery to inform about current maintenance state
 *
 * This returns the ACTUAL maintenance status after checking time ranges:
 * - Global service maintenance is always checked
 * - If worldId is configured in SDK, only that world is checked
 * - Time-based maintenance (startsAt/endsAt) is calculated at query time
 */
export interface CurrentMaintenanceStatus {
  /** Whether currently in maintenance (calculated at query time, not just cached flag) */
  isMaintenanceActive: boolean;
  /** Source of maintenance: 'service' for global, 'world' for world-level (only present when isInMaintenance is true) */
  source?: 'service' | 'world';
  /** World ID if source is 'world' */
  worldId?: string;
  /** Maintenance detail (only present when isMaintenanceActive is true) */
  detail?: MaintenanceDetailSummary;
}
