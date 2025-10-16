/**
 * Client Crash types based on crashes.md specification
 */

/**
 * Crash state enum
 * 0: OPEN - New or active crash
 * 1: CLOSED - Manually closed by developer
 * 2: DELETED - Marked as deleted
 * 3: RESOLVED - Fixed and verified
 * 4: REPEATED - Resolved but reoccurred in new version
 */
export enum CrashState {
  OPEN = 0,
  CLOSED = 1,
  DELETED = 2,
  RESOLVED = 3,
  REPEATED = 4
}

/**
 * Main crash record (deduplicated by hash + branch)
 */
export interface ClientCrash {
  id: string; // ULID
  chash: string; // MD5 hash of stack trace
  branch: string; // Branch name (qa_2025, main, etc)
  environment: string; // Environment (dev, staging, production, qa)
  platform: string; // Platform (windows, ios, android, mac)
  marketType?: string; // Market type (googleplay, apple, etc)
  isEditor: boolean; // Whether crash occurred in editor

  firstLine?: string; // First line of stack trace (max 200 chars)
  stackFilePath?: string; // Path to stack trace file

  crashesCount: number; // Number of times this crash occurred
  firstCrashEventId?: string; // ULID of first crash event
  lastCrashEventId?: string; // ULID of last crash event
  firstCrashAt: Date; // First occurrence timestamp
  lastCrashAt: Date; // Last occurrence timestamp

  crashesState: CrashState; // Current state
  assignee?: string; // Assigned developer/team
  jiraTicket?: string; // Jira ticket URL

  maxAppVersion?: string; // Maximum app version where crash occurred
  maxResVersion?: string; // Maximum resource version where crash occurred

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Individual crash event record
 */
export interface CrashEvent {
  id: string; // ULID
  crashId: string; // Reference to crashes.id
  firstLine?: string; // First line of stack trace (max 200 chars)

  platform: string; // Platform (windows, ios, android, mac)
  marketType?: string; // Market type (googleplay, apple, etc)
  branch: string; // Branch name
  environment: string; // Environment (dev, staging, production, qa)
  isEditor: boolean; // Whether crash occurred in editor

  appVersion?: string; // App version (semver format)
  resVersion?: string; // Resource version

  accountId?: string; // Account ID
  characterId?: string; // Character ID
  gameUserId?: string; // Game user ID
  userName?: string; // User name
  gameServerId?: string; // Game server ID

  userMessage?: string; // User message (max 255 chars)
  logFilePath?: string; // Path to log file

  crashEventIp?: string; // IP address (IPv4/IPv6)

  createdAt: Date;
}

/**
 * Crash upload request body structure (from crashes.md)
 */
export interface CrashUploadRequest {
  platform: string; // Platform (windows, ios, android, mac) - required
  marketType?: string; // Market type (googleplay, apple, etc) - optional
  branch: string; // Branch name (qa_2025, main, etc) - required
  environment: string; // Environment (dev, staging, production, qa) - required
  isEditor?: boolean; // Whether crash occurred in editor - optional

  appVersion?: string; // App version (semver format) - optional
  resVersion?: string; // Resource version - optional

  accountId?: string; // Account ID - optional
  characterId?: string; // Character ID - optional
  gameUserId?: string; // Game user ID - optional
  userName?: string; // User name - optional
  gameServerId?: string; // Game server ID - optional

  userMessage?: string; // User message - optional
  stack: string; // Stack trace (ErrWithStack) - required
  log?: string; // Log data - optional
}

/**
 * Crash filter options for listing/searching
 */
export interface CrashFilters {
  search?: string; // Search in firstLine, assignee, jiraTicket
  dateFrom?: string; // Filter by firstCrashAt >= dateFrom
  dateTo?: string; // Filter by lastCrashAt <= dateTo
  platform?: string; // Filter by platform
  environment?: string; // Filter by environment
  branch?: string; // Filter by branch
  marketType?: string; // Filter by marketType
  isEditor?: boolean; // Filter by isEditor
  state?: CrashState; // Filter by state
  assignee?: string; // Filter by assignee
  appVersion?: string; // Filter by maxAppVersion
}

/**
 * Crash list response with pagination
 */
export interface CrashListResponse {
  crashes: ClientCrash[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Detailed crash view with events
 */
export interface CrashDetail extends ClientCrash {
  events: CrashEvent[];
  stackTrace?: string; // Full stack trace from file
}

/**
 * Crash retention settings
 */
export interface CrashRetentionSettings {
  id: number;
  crashEventsRetentionDays: number; // Retention period for crash events in days
  crashesRetentionDays: number; // Retention period for crashes in days
  stackFilesRetentionDays: number; // Retention period for stack files in days
  logFilesRetentionDays: number; // Retention period for log files in days
  updatedAt: Date;
  updatedBy?: number; // User ID who updated settings
}

/**
 * Constants from crashes.md
 */
export const CRASH_CONSTANTS = {
  MaxFirstLineLen: 200,
  MaxUserMsgLen: 255,
  MaxLogTextLen: 1048576 // 1MB
} as const;

/**
 * Pagination options
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
}

/**
 * Response wrapper
 */
export interface CrashResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

/**
 * Crash summary statistics
 */
export interface CrashSummary {
  totalCrashes: number;
  openCrashes: number;
  closedCrashes: number;
  resolvedCrashes: number;
  repeatedCrashes: number;
  totalEvents: number;
  recentCrashes: ClientCrash[];
}
