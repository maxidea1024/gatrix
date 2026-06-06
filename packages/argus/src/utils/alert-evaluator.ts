import { mysqlPool } from '../config/mysql';
import { redis } from '../config/redis';
import { createLogger } from './logger';
import { IssueGroupResult } from '../processing/issue-grouper';
import { alertRuleStore } from './alert-rule-store';
import { BUFFERS } from '../config/redis-keys';
import {
  getEventCountInWindow as redisEventCount,
  getUniqueUserCount as redisUserCount,
  getProjectEventCount as redisProjectCount,
} from './event-counter';

const logger = createLogger('alert-evaluator');

interface FeedbackData {
  feedback_id: string;
  project_id: string;
  name: string;
  email: string;
  message: string;
  url: string;
  environment: string;
  source: string;
  tags: Record<string, string>;
}

interface AlertRule {
  id: number;
  project_id: string;
  name: string;
  conditions: string;
  actions: string;
  frequency: number;
  environment: string | null;
  level: string | null;
  enabled: boolean;
  tags: string | null;
  last_triggered_at: string | null;
}

/**
 * Evaluate feedback-specific alert rules and fire matching ones.
 * Called by feedback-worker after a successful ClickHouse insert.
 */
export async function evaluateFeedbackAlerts(
  feedback: FeedbackData
): Promise<void> {
  try {
    // Fetch enabled rules with 'new_feedback' conditions from in-memory store
    const rules = alertRuleStore.getRulesWithCondition(
      feedback.project_id,
      ['new_feedback']
    ) as AlertRule[];

    for (const rule of rules) {
      try {
        // Skip muted rules
        if ((rule as any).muted_until && new Date((rule as any).muted_until) > new Date()) continue;

        if (!shouldFire(rule, feedback)) continue;

        const actions = parseJSON(rule.actions);
        const actionResults = await fireActions(actions, rule, feedback);

        const triggerReason = `New feedback from ${feedback.name || feedback.email || 'anonymous'}: "${truncate(feedback.message, 100)}"`;

        // Buffer alert history record to Redis (BatchFlusher will bulk-insert to MySQL)
        await redis.rpush(
          BUFFERS.ALERT_HISTORY,
          JSON.stringify({
            rule_id: rule.id,
            project_id: rule.project_id,
            issue_id: null,
            event_id: null,
            trigger_reason: triggerReason,
            notified_channels: JSON.stringify(actionResults.map((r: any) => r.channel || 'unknown')),
          })
        );

        // Update last_triggered_at
        await mysqlPool.query(
          `UPDATE g_argus_alert_rules SET last_triggered_at = UTC_TIMESTAMP() WHERE id = ?`,
          [rule.id]
        );

        logger.info('Feedback alert fired', {
          ruleId: rule.id,
          ruleName: rule.name,
          feedbackId: feedback.feedback_id,
        });
      } catch (e) {
        logger.error('Failed to evaluate alert rule', {
          ruleId: rule.id,
          error: (e as Error).message,
        });
      }
    }
  } catch (error: any) {
    // Gracefully handle if table doesn't exist yet
    if (error?.code === 'ER_NO_SUCH_TABLE') {
      return;
    }
    logger.error('Failed to evaluate feedback alerts', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ─── Error / Issue Alert Evaluation ───

interface ErrorEventData {
  event_id: string;
  project_id: string;
  internal_project_id: number;
  issue_id: number;
  level: string;
  environment?: string;
  platform?: string;
  release?: string;
  title?: string;
  culprit?: string;
  tags?: Record<string, string>;
}

/**
 * Evaluate error-related alert rules after an event is processed.
 * Called by error-worker after issue grouping.
 * Handles: new_issue, regression, event_frequency, user_count conditions.
 */
export async function evaluateErrorAlerts(
  event: ErrorEventData,
  groupResult: IssueGroupResult
): Promise<void> {
  try {
    // Fetch enabled rules with error-related conditions from in-memory store
    const rules = alertRuleStore.getRulesWithCondition(
      event.project_id,
      ['new_issue', 'regression', 'event_frequency', 'user_count', 'project_error_rate', 'high_priority_issue', 'property_match']
    ) as AlertRule[];
    if (rules.length === 0) return;

    for (const rule of rules) {
      try {
        // Skip muted rules
        if ((rule as any).muted_until && new Date((rule as any).muted_until) > new Date()) continue;

        // Check throttle (frequency) and environment/tag filters
        if (!shouldFireForError(rule, event)) continue;

        const conditions = parseJSON(rule.conditions) as any[];
        const logic = (rule as any).condition_logic || 'any';
        let matchCount = 0;
        let triggerReasons: string[] = [];

        for (const cond of conditions) {
          let condMatched = false;
          let condReason = '';

          if (cond.type === 'new_issue' && groupResult.is_new) {
            condMatched = true;
            condReason = `New issue created: ${event.title || 'Unknown'}`;
          } else if (cond.type === 'regression' && groupResult.is_regression) {
            condMatched = true;
            condReason = `Issue regression: ${event.title || 'Unknown'}`;
          } else if (cond.type === 'event_frequency') {
            const threshold = cond.value || 10;
            const interval = cond.interval || 3600;
            const count = await redisEventCount(event.project_id, event.issue_id, interval);
            if (count >= threshold) {
              condMatched = true;
              condReason = `Event frequency threshold: ${count} events in ${formatInterval(interval)}`;
            }
          } else if (cond.type === 'user_count') {
            const threshold = cond.value || 10;
            const interval = cond.interval || 3600;
            const count = await redisUserCount(event.project_id, event.issue_id);
            if (count >= threshold) {
              condMatched = true;
              condReason = `User count threshold: ${count} users in ${formatInterval(interval)}`;
            }
          } else if (cond.type === 'high_priority_issue' && groupResult.is_new) {
            if (event.level === 'fatal' || event.level === 'error') {
              condMatched = true;
              condReason = `High priority issue: ${event.title || 'Unknown'} (${event.level})`;
            }
          } else if (cond.type === 'property_match') {
            const val = (event as any)[cond.property] || event.tags?.[cond.property];
            const op = cond.operator || 'equals';
            const target = cond.value || '';
            let isMatch = false;
            if (val !== undefined && val !== null) {
              const strVal = String(val).toLowerCase();
              const strTarget = String(target).toLowerCase();
              switch (op) {
                case 'equals': isMatch = strVal === strTarget; break;
                case 'not_equals': isMatch = strVal !== strTarget; break;
                case 'contains': isMatch = strVal.includes(strTarget); break;
                case 'starts_with': isMatch = strVal.startsWith(strTarget); break;
                case 'ends_with': isMatch = strVal.endsWith(strTarget); break;
              }
            }
            if (isMatch) {
              condMatched = true;
              condReason = `Property ${cond.property} ${op} ${target}`;
            }
          } else if (cond.type === 'project_error_rate') {
            const threshold = cond.value || 100;
            const interval = cond.interval || 3600;
            const count = await redisProjectCount(event.project_id);
            if (count >= threshold) {
              condMatched = true;
              condReason = `Project error rate threshold: ${count} events in ${formatInterval(interval)}`;
            }
          }

          if (condMatched) {
            matchCount++;
            triggerReasons.push(condReason);
          }
        }

        const matched = logic === 'all' ? (matchCount === conditions.length && conditions.length > 0) : matchCount > 0;
        if (!matched) continue;
        const triggerReason = triggerReasons.join(' AND ');

        // Fire actions
        const actions = parseJSON(rule.actions);
        const actionResults = await fireActionsForError(actions, rule, event, triggerReason);

        // Buffer alert history record to Redis (BatchFlusher will bulk-insert to MySQL)
        await redis.rpush(
          BUFFERS.ALERT_HISTORY,
          JSON.stringify({
            rule_id: rule.id,
            project_id: rule.project_id,
            issue_id: event.issue_id,
            event_id: event.event_id,
            trigger_reason: truncate(triggerReason, 500),
            notified_channels: JSON.stringify(actionResults.map((r: any) => r.channel || 'unknown')),
          })
        );

        // Update last_triggered_at
        await mysqlPool.query(
          `UPDATE g_argus_alert_rules SET last_triggered_at = UTC_TIMESTAMP() WHERE id = ?`,
          [rule.id]
        );

        logger.info('Error alert fired', {
          ruleId: rule.id,
          ruleName: rule.name,
          issueId: event.issue_id,
          reason: triggerReason,
        });
      } catch (e) {
        logger.error('Failed to evaluate error alert rule', {
          ruleId: rule.id,
          error: (e as Error).message,
        });
      }
    }
  } catch (error: any) {
    if (error?.code === 'ER_NO_SUCH_TABLE') return;
    logger.error('Failed to evaluate error alerts', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}



function shouldFireForError(rule: AlertRule, event: ErrorEventData): boolean {
  // Check environment filter
  if (rule.environment && event.environment && rule.environment !== event.environment) {
    return false;
  }

  // Check level filter
  if (rule.level) {
    const levelPriority: Record<string, number> = { debug: 0, info: 1, warning: 2, error: 3, fatal: 4 };
    const ruleLevel = levelPriority[rule.level] ?? 0;
    const eventLevel = levelPriority[event.level] ?? 0;
    if (eventLevel < ruleLevel) return false;
  }

  // Check tag filters
  if (rule.tags) {
    const ruleTags = parseJSON(rule.tags) as Record<string, string>;
    for (const [key, value] of Object.entries(ruleTags)) {
      if (event.tags?.[key] !== value) return false;
    }
  }

  // Check frequency throttle
  if (rule.last_triggered_at && rule.frequency > 0) {
    const lastTriggered = new Date(rule.last_triggered_at).getTime();
    if (Date.now() - lastTriggered < rule.frequency * 1000) return false;
  }

  return true;
}

// ─── Slack Bot Token helpers ───

let _slackBotTokenCache: { token: string | null; fetchedAt: number } = { token: null, fetchedAt: 0 };
const SLACK_TOKEN_CACHE_TTL = 60_000; // 1 min

async function getSlackBotToken(): Promise<string | null> {
  if (_slackBotTokenCache.token && Date.now() - _slackBotTokenCache.fetchedAt < SLACK_TOKEN_CACHE_TTL) {
    return _slackBotTokenCache.token;
  }
  try {
    const [rows] = await mysqlPool.execute(
      `SELECT credentials FROM g_argus_global_integrations WHERE provider = 'slack' AND is_active = 1 LIMIT 1`
    );
    const row = (rows as any[])[0];
    if (!row) { _slackBotTokenCache = { token: null, fetchedAt: Date.now() }; return null; }
    const creds = typeof row.credentials === 'string' ? JSON.parse(row.credentials) : row.credentials;
    const token = creds?.bot_token || null;
    _slackBotTokenCache = { token, fetchedAt: Date.now() };
    return token;
  } catch (e) {
    logger.warn('Failed to fetch Slack bot token', { error: (e as Error).message });
    return null;
  }
}

async function sendSlackMessage(
  botToken: string, channel: string, payload: { text: string; blocks?: any[] }
): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${botToken}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({ channel, ...payload }),
  });
  return response.json() as Promise<{ ok: boolean; error?: string }>;
}

async function handleSlackAction(
  action: any, payload: { text: string; blocks?: any[] }
): Promise<{ status: string; response_body: string }> {
  const botToken = await getSlackBotToken();
  if (!botToken) {
    return { status: 'failed', response_body: 'Slack App not configured. Add Bot Token in Settings > Integrations.' };
  }
  const channel = action.channel?.replace(/^#/, '') || '';
  if (!channel) {
    return { status: 'failed', response_body: 'Slack channel not specified' };
  }
  try {
    const result = await sendSlackMessage(botToken, channel, payload);
    if (result.ok) {
      return { status: 'success', response_body: `Delivered to Slack #${channel}` };
    } else {
      logger.warn('Slack API error', { channel, error: result.error });
      return { status: 'failed', response_body: `Slack API error: ${result.error}` };
    }
  } catch (e) {
    const errorMsg = (e as Error).message;
    logger.warn('Slack delivery failed', { channel, error: errorMsg });
    return { status: 'failed', response_body: `Error: ${errorMsg}` };
  }
}

async function fireActionsForError(
  actions: any[], rule: AlertRule, event: ErrorEventData, reason: string
): Promise<Array<{ status: string; response_body: string }>> {
  if (!Array.isArray(actions)) return [];

  const results: Array<{ status: string; response_body: string }> = [];

  for (const action of actions) {
    if (action.type === 'slack' && action.channel) {
      // Slack App — real chat.postMessage
      const payload = buildErrorWebhookPayload(rule, event, reason);
      results.push(await handleSlackAction(action, { text: payload.text, blocks: payload.blocks }));
    } else if ((action.type === 'webhook' || action.type === 'email') && action.target_url) {
      try {
        const response = await fetchWithRetry(action.target_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildErrorWebhookPayload(rule, event, reason)),
        });
        const responseText = await response.text();
        results.push({ status: response.ok ? 'success' : 'failed', response_body: truncate(`[${response.status}] ${responseText}`, 500) });
      } catch (e) {
        const errorMsg = (e as Error).message;
        logger.warn('Webhook/Email delivery failed', {
          url: action.target_url,
          error: errorMsg,
        });
        results.push({ status: 'failed', response_body: `Error: ${errorMsg}` });
      }
    }
  }
  return results;
}

function buildErrorWebhookPayload(
  rule: AlertRule, event: ErrorEventData, reason: string
): Record<string, any> {
  const emoji = event.level === 'fatal' ? '🔴' : event.level === 'error' ? '🟠' : '🟡';
  return {
    // Slack-compatible format
    text: `${emoji} Alert — *${rule.name}*`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${emoji} *${rule.name}*\n*Reason:* ${reason}\n*Issue:* ${event.title || 'Unknown'}\n*Level:* ${event.level}\n*Culprit:* ${event.culprit || 'N/A'}`,
        },
      },
      ...(event.environment ? [{
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `🏷️ Environment: ${event.environment}` }],
      }] : []),
      ...(event.release ? [{
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `📦 Release: ${event.release}` }],
      }] : []),
    ],
    // Generic fields
    rule_name: rule.name,
    rule_id: rule.id,
    project_id: event.project_id,
    event_id: event.event_id,
    issue_id: event.issue_id,
    level: event.level,
    title: event.title,
    culprit: event.culprit,
    environment: event.environment,
    release: event.release,
    trigger_reason: reason,
  };
}

function formatInterval(seconds: number): string {
  if (seconds >= 86400) return `${Math.round(seconds / 86400)}d`;
  if (seconds >= 3600) return `${Math.round(seconds / 3600)}h`;
  if (seconds >= 60) return `${Math.round(seconds / 60)}m`;
  return `${seconds}s`;
}

function shouldFire(rule: AlertRule, feedback: FeedbackData): boolean {
  // Check environment filter
  if (rule.environment && feedback.environment && rule.environment !== feedback.environment) {
    return false;
  }

  // Check tag filters
  if (rule.tags) {
    const ruleTags = parseJSON(rule.tags) as Record<string, string>;
    for (const [key, value] of Object.entries(ruleTags)) {
      if (feedback.tags?.[key] !== value) {
        return false;
      }
    }
  }

  // Check frequency throttle
  if (rule.last_triggered_at && rule.frequency > 0) {
    const lastTriggered = new Date(rule.last_triggered_at).getTime();
    const now = Date.now();
    if (now - lastTriggered < rule.frequency * 1000) {
      return false;
    }
  }

  return true;
}

async function fireActions(
  actions: any[],
  rule: AlertRule,
  feedback: FeedbackData
): Promise<Array<{ status: string; response_body: string }>> {
  if (!Array.isArray(actions)) return [];

  const results: Array<{ status: string; response_body: string }> = [];

  for (const action of actions) {
    if ((action.type === 'webhook' || action.type === 'email' || action.type === 'slack' || action.type === 'jira' || action.type === 'linear' || action.type === 'pagerduty') && (action.target_url || action.type === 'slack' || action.type === 'jira' || action.type === 'linear')) {
      try {
        if (action.type === 'slack' && action.channel) {
          // Slack App — real chat.postMessage
          const payload = buildWebhookPayload(rule, feedback);
          results.push(await handleSlackAction(action, { text: payload.text, blocks: payload.blocks }));
        } else if (action.type === 'jira' && action.channel) {
          // Mock Jira
          logger.info(`Mock creating Jira issue in project ${action.channel}`);
          results.push({ status: 'success', response_body: `[Mock] Created Jira issue ${action.channel}-1001` });
        } else if (action.type === 'linear' && action.channel) {
          // Mock Linear
          logger.info(`Mock creating Linear issue in team ${action.channel}`);
          results.push({ status: 'success', response_body: `[Mock] Created Linear issue ${action.channel}-1001` });
        } else if (action.type === 'pagerduty' && action.target_url) {
          // Mock PagerDuty Incident
          logger.info(`Mock creating PagerDuty incident using key ${action.target_url}`);
          results.push({ status: 'success', response_body: `[Mock] Triggered PagerDuty incident for key ${action.target_url.substring(0, 4)}...` });
        } else if (action.target_url) {
          const response = await fetchWithRetry(action.target_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildWebhookPayload(rule, feedback)),
          });
          const responseText = await response.text();
          results.push({ status: response.ok ? 'success' : 'failed', response_body: truncate(`[${response.status}] ${responseText}`, 500) });
        }
      } catch (e) {
        const errorMsg = (e as Error).message;
        logger.warn('Action delivery failed', {
          type: action.type,
          url: action.target_url,
          error: errorMsg,
        });
        results.push({ status: 'failed', response_body: `Error: ${errorMsg}` });
      }
    }
  }
  return results;
}

function buildWebhookPayload(rule: AlertRule, feedback: FeedbackData): Record<string, any> {
  const displayName = feedback.name || feedback.email || 'Anonymous';
  const messagePreview = truncate(feedback.message, 300);

  return {
    // Slack-compatible format
    text: `📬 New User Feedback — *${rule.name}*`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `📬 *New User Feedback*\n*Rule:* ${rule.name}\n*From:* ${displayName}${feedback.email ? ` (${feedback.email})` : ''}\n*Message:* ${messagePreview}`,
        },
      },
      ...(feedback.url ? [{
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `🔗 URL: ${feedback.url}` }],
      }] : []),
      ...(feedback.environment ? [{
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `🏷️ Environment: ${feedback.environment}` }],
      }] : []),
    ],
    // Generic fields for other webhook consumers
    rule_name: rule.name,
    rule_id: rule.id,
    project_id: feedback.project_id,
    feedback_id: feedback.feedback_id,
    user_name: feedback.name,
    user_email: feedback.email,
    message: feedback.message,
    url: feedback.url,
    environment: feedback.environment,
    source: feedback.source,
  };
}

function parseJSON(value: any): any {
  if (!value) return [];
  if (typeof value === 'string') {
    try { return JSON.parse(value); }
    catch { return []; }
  }
  return value;
}

function truncate(str: string, maxLen: number): string {
  if (!str) return '';
  return str.length <= maxLen ? str : str.slice(0, maxLen) + '…';
}

/**
 * Fetch with exponential backoff retry.
 * Max 2 retries with 1s, 2s delays.
 */
async function fetchWithRetry(
  url: string, options: RequestInit, maxRetries = 2
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok || attempt === maxRetries) return response;
      // Server error — retry
      lastError = new Error(`HTTP ${response.status}`);
    } catch (e) {
      lastError = e as Error;
      if (attempt === maxRetries) throw lastError;
    }
    // Exponential backoff: 1s, 2s
    await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
  }
  throw lastError;
}
