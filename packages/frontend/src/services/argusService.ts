/**
 * Argus Service — Frontend API client for the Argus error tracking backend.
 *
 * This file is a thin barrel that re-exports all domain modules as a single
 * `argusService` object. Existing imports like:
 *
 *   import argusService from '@/services/argusService'
 *   import { ArgusIssue } from '@/services/argusService'
 *
 * continue to work without any changes to consuming code.
 *
 * Domain modules live in ./argus/ and can also be imported directly:
 *   import { getOverview } from '@/services/argus/argusOverview'
 */

// Re-export all types for backward compatibility
export type {
  ArgusProject,
  ArgusDsnKey,
  ArgusDsnKeyStatsPoint,
  ArgusDsnKeyStatsResponse,
  ArgusIssue,
  ArgusIssueDetail,
  ArgusErrorEvent,
  ArgusIssueActivity,
  ArgusIssueTagGroup,
  ArgusSavedQuery,
  ArgusIntegration,
  ArgusIssueTracker,
  ArgusCommit,
  ArgusOwnershipRule,
  ArgusIssueListParams,
  ArgusProjectStats,
  ArgusOverviewData,
  ArgusTransaction,
  ArgusTransactionDetail,
  ArgusRecentTrace,
  ArgusTraceDetail,
  ArgusTraceSpan,
  ArgusSessionHealth,
  ArgusFeedbackItem,
  ArgusFeedbackSummary,
  ArgusFeedbackResponse,
  ArgusFeedbackActivity,
  ArgusRelease,
  ArgusAlertCondition,
  ArgusAlertAction,
  ArgusAlertRule,
  ArgusAlertHistory,
  ArgusLogEntry,
  ArgusSourcemapRelease,
  ArgusSourcemapFile,
  AnalyticsEventNameEntry,
  ArgusLexiconEvent,
  ArgusLexiconProperty,
  ArgusUserProfile,
  ArgusUserEvent,
  ArgusUserSession,
  ArgusUserProperty,
  ArgusCohort,
  ArgusCohortRule,
  ArgusCohortDefinition,
} from './argus/argusTypes';

export { type SavedQueryType } from './argus/argusTypes';

// Import all domain modules
import * as overview from './argus/argusOverview';
import * as performance from './argus/argusPerformance';
import * as feedback from './argus/argusFeedback';
import * as issues from './argus/argusIssues';
import * as logs from './argus/argusLogs';
import * as analytics from './argus/argusAnalytics';
import * as monitoring from './argus/argusMonitoring';
import * as settings from './argus/argusSettings';

// Compose into a single service object for backward compatibility
export const argusService = {
  ...overview,
  ...performance,
  ...feedback,
  ...issues,
  ...logs,
  ...analytics,
  ...monitoring,
  ...settings,
} as const;

export default argusService;
