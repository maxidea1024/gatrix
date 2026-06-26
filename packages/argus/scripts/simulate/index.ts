/**
 * Simulate Data — Re-export barrel file
 *
 * This is the modular entry point for simulation utilities.
 */
export {
  CH_CONFIG, MYSQL_CONFIG, PROJECT_ID, DAYS_BACK, NOW, CHUNK_SIZE,
  TOTAL_ERROR_EVENTS, TOTAL_TRANSACTIONS, TOTAL_SESSIONS, TOTAL_FEEDBACK,
} from './config';
export {
  md5, uuid, randomInt, randomFloat, randomPick, weightedPick,
  randomDateWeighted, formatDate,
} from './helpers';
export { USERS, BROWSERS, OS_LIST } from './user-pool';
export type { SimUser } from './user-pool';
export { truncateClickHouse, truncateMySQL } from './truncate';
export { ACTIVITY_EVENT_DEFS, generateAndInsertActivities } from './activities';
export type { ActivityEventName } from './activities';
export { SCENARIOS } from './scenarios';
export type { ErrorScenario } from './scenarios';
export { SERVER_RELEASES, CLIENT_RELEASES, LUA_RELEASES } from './releases';
export { TXN_TEMPLATES, generateAndInsertTransactions } from './transactions';
export { FEEDBACK_MESSAGES, generateAndInsertFeedback } from './feedback';
export { METRICS_TEMPLATES, generateLogsForEvent, generateAndInsertMetrics } from './metrics';
export { generateAndInsertLogs } from './logs';
export { generateAndInsertSessions } from './sessions';
export { generateErrorEvents, insertIssuesIntoMySQL, insertEventsIntoClickHouse } from './events';
// Full-set modules
export { generateAndInsertReleases } from './seed-releases';
export { generateAndInsertEnrichedFeedback, seedFeedbackLinksAndActivity } from './seed-feedback-full';
export { generateAndInsertMonitors } from './seed-monitors';
export { enrichIssues } from './seed-issues';
