import { createLogger } from '../utils/logger';

const logger = createLogger('tracker-adapter');

export interface TrackerConfig {
  provider: 'jira' | 'github' | 'linear';
  apiUrl: string;
  apiToken: string;
  config: Record<string, any>;
}

export interface IssuePayload {
  title: string;
  description?: string;
  level?: string;
  labels?: string[];
}

export interface ExternalIssueResult {
  url: string;
  key: string;
}

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
}

// ─── Jira ───

async function jiraCreateIssue(config: TrackerConfig, issue: IssuePayload): Promise<ExternalIssueResult> {
  const projectKey = config.config.project_key;
  if (!projectKey) {
    throw new Error('Jira project_key is not configured');
  }

  // Jira Cloud REST API v3
  const url = `${config.apiUrl.replace(/\/$/, '')}/rest/api/3/issue`;
  const body = {
    fields: {
      project: { key: projectKey },
      summary: issue.title,
      description: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: issue.description || 'Created from Argus' }],
          },
        ],
      },
      issuetype: { name: config.config.issue_type || 'Bug' },
      ...(issue.labels && issue.labels.length > 0 ? { labels: issue.labels } : {}),
    },
  };

  // Jira uses Basic auth: email:api_token encoded in base64
  const authHeader = config.config.email
    ? `Basic ${Buffer.from(`${config.config.email}:${config.apiToken}`).toString('base64')}`
    : `Bearer ${config.apiToken}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Jira API error', { status: response.status, body: errorText });
    throw new Error(`Jira API error: ${response.status} ${errorText.substring(0, 200)}`);
  }

  const data = await response.json() as { key: string; self: string };
  const issueUrl = `${config.apiUrl.replace(/\/$/, '')}/browse/${data.key}`;

  return { url: issueUrl, key: data.key };
}

async function jiraTestConnection(config: TrackerConfig): Promise<ConnectionTestResult> {
  try {
    const url = `${config.apiUrl.replace(/\/$/, '')}/rest/api/3/myself`;
    const authHeader = config.config.email
      ? `Basic ${Buffer.from(`${config.config.email}:${config.apiToken}`).toString('base64')}`
      : `Bearer ${config.apiToken}`;

    const response = await fetch(url, {
      headers: { 'Authorization': authHeader },
    });

    if (response.ok) {
      const user = await response.json() as { displayName?: string; emailAddress?: string };
      return { ok: true, message: `Connected as ${user.displayName || user.emailAddress || 'unknown'}` };
    }
    return { ok: false, message: `HTTP ${response.status}: ${await response.text()}` };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}

// ─── GitHub ───

async function githubCreateIssue(config: TrackerConfig, issue: IssuePayload): Promise<ExternalIssueResult> {
  const repo = config.config.repo; // format: "owner/repo"
  if (!repo) {
    throw new Error('GitHub repo is not configured (format: owner/repo)');
  }

  const apiBase = config.apiUrl.replace(/\/$/, '') || 'https://api.github.com';
  const url = `${apiBase}/repos/${repo}/issues`;

  const body: Record<string, any> = {
    title: issue.title,
    body: issue.description || 'Created from Argus',
  };
  if (issue.labels && issue.labels.length > 0) {
    body.labels = issue.labels;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiToken}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('GitHub API error', { status: response.status, body: errorText });
    throw new Error(`GitHub API error: ${response.status} ${errorText.substring(0, 200)}`);
  }

  const data = await response.json() as { html_url: string; number: number };
  return { url: data.html_url, key: `#${data.number}` };
}

async function githubTestConnection(config: TrackerConfig): Promise<ConnectionTestResult> {
  try {
    const repo = config.config.repo;
    if (!repo) {
      return { ok: false, message: 'repo is not configured' };
    }

    const apiBase = config.apiUrl.replace(/\/$/, '') || 'https://api.github.com';
    const response = await fetch(`${apiBase}/repos/${repo}`, {
      headers: {
        'Authorization': `Bearer ${config.apiToken}`,
        'Accept': 'application/vnd.github+json',
      },
    });

    if (response.ok) {
      const data = await response.json() as { full_name: string; private: boolean };
      return { ok: true, message: `Connected to ${data.full_name} (${data.private ? 'private' : 'public'})` };
    }
    return { ok: false, message: `HTTP ${response.status}: ${await response.text()}` };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}

// ─── Linear ───

async function linearCreateIssue(config: TrackerConfig, issue: IssuePayload): Promise<ExternalIssueResult> {
  const teamId = config.config.team_id;
  if (!teamId) {
    throw new Error('Linear team_id is not configured');
  }

  const apiUrl = config.apiUrl.replace(/\/$/, '') || 'https://api.linear.app';
  const mutation = `
    mutation IssueCreate($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue {
          id
          identifier
          url
        }
      }
    }
  `;

  const variables = {
    input: {
      teamId,
      title: issue.title,
      description: issue.description || 'Created from Argus',
      ...(issue.labels && issue.labels.length > 0 ? { labelIds: issue.labels } : {}),
      ...(config.config.priority ? { priority: Number(config.config.priority) } : {}),
    },
  };

  const response = await fetch(`${apiUrl}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': config.apiToken,
    },
    body: JSON.stringify({ query: mutation, variables }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Linear API error', { status: response.status, body: errorText });
    throw new Error(`Linear API error: ${response.status} ${errorText.substring(0, 200)}`);
  }

  const result = await response.json() as any;
  if (!result.data?.issueCreate?.success) {
    throw new Error(`Linear issue creation failed: ${JSON.stringify(result.errors || 'unknown')}`);
  }

  const created = result.data.issueCreate.issue;
  return { url: created.url, key: created.identifier };
}

async function linearTestConnection(config: TrackerConfig): Promise<ConnectionTestResult> {
  try {
    const apiUrl = config.apiUrl.replace(/\/$/, '') || 'https://api.linear.app';
    const query = `query { viewer { id name email } }`;

    const response = await fetch(`${apiUrl}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': config.apiToken,
      },
      body: JSON.stringify({ query }),
    });

    if (response.ok) {
      const data = await response.json() as any;
      const viewer = data.data?.viewer;
      if (viewer) {
        return { ok: true, message: `Connected as ${viewer.name || viewer.email}` };
      }
      return { ok: false, message: 'Failed to get viewer info' };
    }
    return { ok: false, message: `HTTP ${response.status}` };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}

// ─── Dispatcher ───

const adapters: Record<string, {
  createIssue: (config: TrackerConfig, issue: IssuePayload) => Promise<ExternalIssueResult>;
  testConnection: (config: TrackerConfig) => Promise<ConnectionTestResult>;
}> = {
  jira: { createIssue: jiraCreateIssue, testConnection: jiraTestConnection },
  github: { createIssue: githubCreateIssue, testConnection: githubTestConnection },
  linear: { createIssue: linearCreateIssue, testConnection: linearTestConnection },
};

export async function createExternalIssue(config: TrackerConfig, issue: IssuePayload): Promise<ExternalIssueResult> {
  const adapter = adapters[config.provider];
  if (!adapter) {
    throw new Error(`Unsupported tracker provider: ${config.provider}`);
  }
  return adapter.createIssue(config, issue);
}

export async function testTrackerConnection(config: TrackerConfig): Promise<ConnectionTestResult> {
  const adapter = adapters[config.provider];
  if (!adapter) {
    return { ok: false, message: `Unsupported provider: ${config.provider}` };
  }
  return adapter.testConnection(config);
}
