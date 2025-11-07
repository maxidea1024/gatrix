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
  worldId?: string; // Game world ID
  platform?: string; // Platform
  channel?: string; // Channel
  subChannel?: string; // Sub-channel
  requestId?: string; // Request ID (for idempotency)
}

export interface RedeemCouponResponse {
  reward: any[]; // Reward list
  userUsedCount: number; // User usage count
  globalUsed: number; // Global usage count
  sequence: number; // Sequence number
  usedAt: string; // Usage timestamp
}

// ============================================================================
// Game World Types
// ============================================================================

export interface GameWorld {
  id: number;
  worldId: string;
  name: string;
  description?: string;
  isVisible: boolean;
  isMaintenance: boolean;
  maintenanceMessage?: string;
  displayOrder: number;
  customPayload?: Record<string, any>;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface GameWorldListResponse {
  worlds: GameWorld[];
}

// ============================================================================
// Ingame Popup Notice Types
// ============================================================================

export interface PopupNotice {
  id: number;
  isActive: boolean;
  content: string;
  targetWorlds: string[] | null;
  targetWorldsInverted?: boolean;
  targetPlatforms: string[] | null;
  targetPlatformsInverted?: boolean;
  targetChannels: string[] | null;
  targetChannelsInverted?: boolean;
  targetSubchannels: string[] | null;
  targetSubchannelsInverted?: boolean;
  targetUserIds: string | null;
  targetUserIdsInverted?: boolean;
  displayPriority: number;
  showOnce: boolean;
  startDate?: string | null;
  endDate: string | null;
  messageTemplateId: number | null;
  useTemplate: boolean;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: number;
  updatedBy: number | null;
}

// ============================================================================
// Survey Types
// ============================================================================

export interface TriggerCondition {
  type: string;
  value: any;
}

export interface ParticipationReward {
  type: string;
  id: number;
  amount: number;
}

export interface Survey {
  id: string;
  platformSurveyId: string;
  surveyTitle: string;
  surveyContent?: string;
  triggerConditions: TriggerCondition[];
  participationRewards?: ParticipationReward[];
  rewardTemplateId?: string;
  rewardMailTitle?: string;
  rewardMailContent?: string;
  isActive: boolean;
  targetPlatforms?: string[];
  targetPlatformsInverted?: boolean;
  targetChannels?: string[];
  targetChannelsInverted?: boolean;
  targetSubchannels?: string[];
  targetSubchannelsInverted?: boolean;
  targetWorlds?: string[];
  targetWorldsInverted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SurveyListParams {
  isActive?: boolean;
}

// ============================================================================
// Service Discovery Types
// ============================================================================

export type ServiceStatus = 'initializing' | 'ready' | 'shutting_down' | 'error' | 'terminated';

export interface ServicePorts {
  tcp?: number[];
  udp?: number[];
  http?: number[];
}

export interface InstanceStats {
  cpuUsage?: number; // CPU usage percentage (0-100)
  memoryUsage?: number; // Memory usage in MB
  memoryTotal?: number; // Total memory in MB
}

export interface ServiceInstance {
  instanceId: string; // Unique instance ID (ULID)
  type: string; // Service type (e.g., 'world', 'auth', 'channel')
  serviceGroup: string; // Service group for grouping servers (e.g., 'kr-1', 'us-east', 'production', 'staging')
  hostname: string; // Hostname
  externalAddress: string; // External IP address
  internalAddress: string; // Internal IP address
  ports: ServicePorts; // Service ports
  status: ServiceStatus; // Service status
  instanceStats?: InstanceStats; // Instance statistics
  meta?: Record<string, any>; // Additional metadata
  createdAt: string; // Creation timestamp
  updatedAt: string; // Last update timestamp
}

export interface RegisterServiceInput {
  type: string;
  serviceGroup: string;
  hostname: string;
  externalAddress: string;
  internalAddress: string;
  ports: ServicePorts;
  status?: ServiceStatus;
  instanceStats?: InstanceStats;
  meta?: Record<string, any>;
}

export interface UpdateServiceStatusInput {
  status: ServiceStatus;
  instanceStats?: InstanceStats;
  meta?: Record<string, any>;
}

