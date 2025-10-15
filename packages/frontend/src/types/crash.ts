// Frontend crash types for client crash tracking

/**
 * Main crash record (deduplicated by hash + branch)
 */
export interface ClientCrash {
  id: string; // ULID
  chash: string; // MD5 hash
  branch: string; // Branch name
  environment: string; // Environment
  platform: string; // Platform
  marketType?: string; // Market type
  isEditor: boolean; // Whether crash occurred in editor

  firstLine?: string; // First line of stack trace
  stackFilePath?: string; // Path to stack trace file

  crashesCount: number; // Number of occurrences
  firstCrashEventId?: string; // ULID of first crash event
  lastCrashEventId?: string; // ULID of last crash event
  firstCrashAt: string; // ISO date string
  lastCrashAt: string; // ISO date string

  crashesState: CrashState; // Current state
  assignee?: string; // Assigned developer/team
  jiraTicket?: string; // Jira ticket URL

  maxAppVersion?: string; // Maximum app version
  maxResVersion?: string; // Maximum resource version

  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

/**
 * Individual crash event record
 */
export interface CrashEvent {
  id: string; // ULID
  crashId: string; // Reference to crashes.id

  platform: string; // Platform
  marketType?: string; // Market type
  branch: string; // Branch name
  environment: string; // Environment
  isEditor: boolean; // Whether crash occurred in editor

  appVersion?: string; // App version (semver format)
  resVersion?: string; // Resource version

  accountId?: string; // Account ID
  characterId?: string; // Character ID
  gameUserId?: string; // Game user ID
  userName?: string; // User name
  gameServerId?: string; // Game server ID

  userMessage?: string; // User message
  logFilePath?: string; // Path to log file

  crashEventIp?: string; // IP address

  createdAt: string; // ISO date string
}

export enum CrashState {
  OPEN = 0,
  CLOSED = 1,
  DELETED = 2,
  RESOLVED = 3,
  REPEATED = 4
}

export interface CrashFilters {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  platform?: string;
  environment?: string;
  branch?: string;
  marketType?: string;
  isEditor?: boolean;
  state?: CrashState;
  assignee?: string;
  appVersion?: string;
}

export interface GetCrashEventsRequest {
  page?: number;
  limit?: number;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  platform?: string;
  environment?: string;
  branch?: string;
  marketType?: string;
  isEditor?: boolean;
  appVersion?: string;
}

export interface GetCrashEventsResponse {
  data: CrashEvent[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface GetCrashesRequest extends CrashFilters {
  page?: number;
  limit?: number;
}

export interface GetCrashesResponse {
  data: ClientCrash[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CrashDetail extends ClientCrash {
  events: CrashEvent[];
  stackTrace?: string;
}

export interface CrashStats {
  totalCrashes: number;
  openCrashes: number;
  closedCrashes: number;
  resolvedCrashes: number;
  repeatedCrashes: number;
  totalEvents: number;
  recentCrashes: ClientCrash[];
}

export interface UpdateCrashStateRequest {
  state: CrashState;
}

export interface UpdateCrashAssigneeRequest {
  assignee: string;
}

export interface UpdateCrashJiraTicketRequest {
  jiraTicket: string;
}

// Helper functions for display
export const getPlatformName = (platform: string): string => {
  const platformMap: Record<string, string> = {
    'windows': 'Windows',
    'ios': 'iOS',
    'android': 'Android',
    'mac': 'Mac',
    'linux': 'Linux',
    'web': 'Web'
  };
  return platformMap[platform.toLowerCase()] || platform;
};

export const getStateName = (state: CrashState): string => {
  switch (state) {
    case CrashState.OPEN: return 'Open';
    case CrashState.CLOSED: return 'Closed';
    case CrashState.DELETED: return 'Deleted';
    case CrashState.RESOLVED: return 'Resolved';
    case CrashState.REPEATED: return 'Repeated';
    default: return 'Unknown';
  }
};

export const getEnvironmentName = (environment: string): string => {
  const envMap: Record<string, string> = {
    'dev': 'Development',
    'staging': 'Staging',
    'production': 'Production',
    'qa': 'QA'
  };
  return envMap[environment.toLowerCase()] || environment;
};
