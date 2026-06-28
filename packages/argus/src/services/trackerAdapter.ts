import { createLogger } from '../utils/logger';

const logger = createLogger('tracker-adapter');

export interface TrackerConfig {
  provider:
    | 'jira'
    | 'github'
    | 'linear'
    | 'clickup'
    | 'asana'
    | 'notion'
    | 'shortcut'
    | 'azure_devops'
    | 'redmine'
    | 'youtrack'
    | 'trello';
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

async function jiraCreateIssue(
  config: TrackerConfig,
  issue: IssuePayload
): Promise<ExternalIssueResult> {
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
            content: [
              { type: 'text', text: issue.description || 'Created from Argus' },
            ],
          },
        ],
      },
      issuetype: { name: config.config.issue_type || 'Bug' },
      ...(issue.labels && issue.labels.length > 0
        ? { labels: issue.labels }
        : {}),
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
      Authorization: authHeader,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Jira API error', {
      status: response.status,
      body: errorText,
    });
    throw new Error(
      `Jira API error: ${response.status} ${errorText.substring(0, 200)}`
    );
  }

  const data = (await response.json()) as { key: string; self: string };
  const issueUrl = `${config.apiUrl.replace(/\/$/, '')}/browse/${data.key}`;

  return { url: issueUrl, key: data.key };
}

async function jiraTestConnection(
  config: TrackerConfig
): Promise<ConnectionTestResult> {
  try {
    const url = `${config.apiUrl.replace(/\/$/, '')}/rest/api/3/myself`;
    const authHeader = config.config.email
      ? `Basic ${Buffer.from(`${config.config.email}:${config.apiToken}`).toString('base64')}`
      : `Bearer ${config.apiToken}`;

    const response = await fetch(url, {
      headers: { Authorization: authHeader },
    });

    if (response.ok) {
      const user = (await response.json()) as {
        displayName?: string;
        emailAddress?: string;
      };
      return {
        ok: true,
        message: `Connected as ${user.displayName || user.emailAddress || 'unknown'}`,
      };
    }
    return {
      ok: false,
      message: `HTTP ${response.status}: ${await response.text()}`,
    };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}

// ─── GitHub ───

async function githubCreateIssue(
  config: TrackerConfig,
  issue: IssuePayload
): Promise<ExternalIssueResult> {
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
      Authorization: `Bearer ${config.apiToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('GitHub API error', {
      status: response.status,
      body: errorText,
    });
    throw new Error(
      `GitHub API error: ${response.status} ${errorText.substring(0, 200)}`
    );
  }

  const data = (await response.json()) as { html_url: string; number: number };
  return { url: data.html_url, key: `#${data.number}` };
}

async function githubTestConnection(
  config: TrackerConfig
): Promise<ConnectionTestResult> {
  try {
    const repo = config.config.repo;
    if (!repo) {
      return { ok: false, message: 'repo is not configured' };
    }

    const apiBase =
      config.apiUrl.replace(/\/$/, '') || 'https://api.github.com';
    const response = await fetch(`${apiBase}/repos/${repo}`, {
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        Accept: 'application/vnd.github+json',
      },
    });

    if (response.ok) {
      const data = (await response.json()) as {
        full_name: string;
        private: boolean;
      };
      return {
        ok: true,
        message: `Connected to ${data.full_name} (${data.private ? 'private' : 'public'})`,
      };
    }
    return {
      ok: false,
      message: `HTTP ${response.status}: ${await response.text()}`,
    };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}

// ─── Linear ───

async function linearCreateIssue(
  config: TrackerConfig,
  issue: IssuePayload
): Promise<ExternalIssueResult> {
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
      ...(issue.labels && issue.labels.length > 0
        ? { labelIds: issue.labels }
        : {}),
      ...(config.config.priority
        ? { priority: Number(config.config.priority) }
        : {}),
    },
  };

  const response = await fetch(`${apiUrl}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: config.apiToken,
    },
    body: JSON.stringify({ query: mutation, variables }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Linear API error', {
      status: response.status,
      body: errorText,
    });
    throw new Error(
      `Linear API error: ${response.status} ${errorText.substring(0, 200)}`
    );
  }

  const result = (await response.json()) as any;
  if (!result.data?.issueCreate?.success) {
    throw new Error(
      `Linear issue creation failed: ${JSON.stringify(result.errors || 'unknown')}`
    );
  }

  const created = result.data.issueCreate.issue;
  return { url: created.url, key: created.identifier };
}

async function linearTestConnection(
  config: TrackerConfig
): Promise<ConnectionTestResult> {
  try {
    const apiUrl = config.apiUrl.replace(/\/$/, '') || 'https://api.linear.app';
    const query = `query { viewer { id name email } }`;

    const response = await fetch(`${apiUrl}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: config.apiToken,
      },
      body: JSON.stringify({ query }),
    });

    if (response.ok) {
      const data = (await response.json()) as any;
      const viewer = data.data?.viewer;
      if (viewer) {
        return {
          ok: true,
          message: `Connected as ${viewer.name || viewer.email}`,
        };
      }
      return { ok: false, message: 'Failed to get viewer info' };
    }
    return { ok: false, message: `HTTP ${response.status}` };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}

// ─── ClickUp ───

async function clickupCreateIssue(
  config: TrackerConfig,
  issue: IssuePayload
): Promise<ExternalIssueResult> {
  const listId = config.config.list_id;
  if (!listId) throw new Error('ClickUp list_id is not configured');

  const url = `https://api.clickup.com/api/v2/list/${listId}/task`;
  const body: Record<string, any> = {
    name: issue.title,
    description: issue.description || 'Created from Argus',
  };
  if (issue.labels?.length) body.tags = issue.labels;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: config.apiToken,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(
      `ClickUp API error: ${response.status} ${err.substring(0, 200)}`
    );
  }
  const data = (await response.json()) as { id: string; url: string };
  return { url: data.url, key: `#${data.id}` };
}

async function clickupTestConnection(
  config: TrackerConfig
): Promise<ConnectionTestResult> {
  try {
    const response = await fetch('https://api.clickup.com/api/v2/user', {
      headers: { Authorization: config.apiToken },
    });
    if (response.ok) {
      const data = (await response.json()) as { user: { username: string } };
      return { ok: true, message: `Connected as ${data.user.username}` };
    }
    return { ok: false, message: `HTTP ${response.status}` };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}

// ─── Asana ───

async function asanaCreateIssue(
  config: TrackerConfig,
  issue: IssuePayload
): Promise<ExternalIssueResult> {
  const projectGid = config.config.project_gid;
  if (!projectGid) throw new Error('Asana project_gid is not configured');

  const url = 'https://app.asana.com/api/1.0/tasks';
  const body = {
    data: {
      name: issue.title,
      notes: issue.description || 'Created from Argus',
      projects: [projectGid],
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiToken}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(
      `Asana API error: ${response.status} ${err.substring(0, 200)}`
    );
  }
  const data = (await response.json()) as {
    data: { gid: string; permalink_url: string };
  };
  return { url: data.data.permalink_url, key: data.data.gid };
}

async function asanaTestConnection(
  config: TrackerConfig
): Promise<ConnectionTestResult> {
  try {
    const response = await fetch('https://app.asana.com/api/1.0/users/me', {
      headers: { Authorization: `Bearer ${config.apiToken}` },
    });
    if (response.ok) {
      const data = (await response.json()) as {
        data: { name: string; email: string };
      };
      return {
        ok: true,
        message: `Connected as ${data.data.name} (${data.data.email})`,
      };
    }
    return { ok: false, message: `HTTP ${response.status}` };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}

// ─── Notion ───

async function notionCreateIssue(
  config: TrackerConfig,
  issue: IssuePayload
): Promise<ExternalIssueResult> {
  const databaseId = config.config.database_id;
  if (!databaseId) throw new Error('Notion database_id is not configured');

  const url = 'https://api.notion.com/v1/pages';
  const body = {
    parent: { database_id: databaseId },
    properties: {
      [config.config.title_property || 'Name']: {
        title: [{ text: { content: issue.title } }],
      },
    },
    children: issue.description
      ? [
          {
            object: 'block' as const,
            type: 'paragraph' as const,
            paragraph: {
              rich_text: [
                { type: 'text' as const, text: { content: issue.description } },
              ],
            },
          },
        ]
      : [],
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiToken}`,
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(
      `Notion API error: ${response.status} ${err.substring(0, 200)}`
    );
  }
  const data = (await response.json()) as { id: string; url: string };
  return { url: data.url, key: data.id.replace(/-/g, '').substring(0, 8) };
}

async function notionTestConnection(
  config: TrackerConfig
): Promise<ConnectionTestResult> {
  try {
    const response = await fetch('https://api.notion.com/v1/users/me', {
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        'Notion-Version': '2022-06-28',
      },
    });
    if (response.ok) {
      const data = (await response.json()) as { name?: string; type?: string };
      return {
        ok: true,
        message: `Connected as ${data.name || data.type || 'bot'}`,
      };
    }
    return { ok: false, message: `HTTP ${response.status}` };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}

// ─── Shortcut (formerly Clubhouse) ───

async function shortcutCreateIssue(
  config: TrackerConfig,
  issue: IssuePayload
): Promise<ExternalIssueResult> {
  const projectId = config.config.project_id;

  const url = 'https://api.app.shortcut.com/api/v3/stories';
  const body: Record<string, any> = {
    name: issue.title,
    description: issue.description || 'Created from Argus',
    story_type: 'bug',
  };
  if (projectId) body.project_id = Number(projectId);
  if (issue.labels?.length)
    body.labels = issue.labels.map((l) => ({ name: l }));

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Shortcut-Token': config.apiToken,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(
      `Shortcut API error: ${response.status} ${err.substring(0, 200)}`
    );
  }
  const data = (await response.json()) as { id: number; app_url: string };
  return { url: data.app_url, key: `sc-${data.id}` };
}

async function shortcutTestConnection(
  config: TrackerConfig
): Promise<ConnectionTestResult> {
  try {
    const response = await fetch('https://api.app.shortcut.com/api/v3/member', {
      headers: { 'Shortcut-Token': config.apiToken },
    });
    if (response.ok) {
      const data = (await response.json()) as { mention_name: string };
      return { ok: true, message: `Connected as @${data.mention_name}` };
    }
    return { ok: false, message: `HTTP ${response.status}` };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}

// ─── Azure DevOps ───

async function azureDevOpsCreateIssue(
  config: TrackerConfig,
  issue: IssuePayload
): Promise<ExternalIssueResult> {
  const organization = config.config.organization;
  const project = config.config.project;
  if (!organization || !project)
    throw new Error('Azure DevOps organization and project are required');

  const apiBase = config.apiUrl?.replace(/\/$/, '') || 'https://dev.azure.com';
  const url = `${apiBase}/${organization}/${project}/_apis/wit/workitems/$Bug?api-version=7.0`;
  const body = [
    { op: 'add', path: '/fields/System.Title', value: issue.title },
    {
      op: 'add',
      path: '/fields/System.Description',
      value: issue.description || 'Created from Argus',
    },
  ];

  const authHeader = `Basic ${Buffer.from(`:${config.apiToken}`).toString('base64')}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json-patch+json',
      Authorization: authHeader,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(
      `Azure DevOps API error: ${response.status} ${err.substring(0, 200)}`
    );
  }
  const data = (await response.json()) as {
    id: number;
    _links: { html: { href: string } };
  };
  return { url: data._links.html.href, key: `#${data.id}` };
}

async function azureDevOpsTestConnection(
  config: TrackerConfig
): Promise<ConnectionTestResult> {
  try {
    const organization = config.config.organization;
    if (!organization)
      return { ok: false, message: 'organization is not configured' };
    const apiBase =
      config.apiUrl?.replace(/\/$/, '') || 'https://dev.azure.com';
    const authHeader = `Basic ${Buffer.from(`:${config.apiToken}`).toString('base64')}`;
    const response = await fetch(
      `${apiBase}/${organization}/_apis/projects?api-version=7.0`,
      {
        headers: { Authorization: authHeader },
      }
    );
    if (response.ok) {
      const data = (await response.json()) as { count: number };
      return { ok: true, message: `Connected — ${data.count} projects found` };
    }
    return { ok: false, message: `HTTP ${response.status}` };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}

// ─── Redmine ───

async function redmineCreateIssue(
  config: TrackerConfig,
  issue: IssuePayload
): Promise<ExternalIssueResult> {
  const projectId = config.config.project_id;
  if (!projectId) throw new Error('Redmine project_id is not configured');

  const apiBase = config.apiUrl.replace(/\/$/, '');
  const url = `${apiBase}/issues.json`;
  const body = {
    issue: {
      project_id: projectId,
      subject: issue.title,
      description: issue.description || 'Created from Argus',
      tracker_id: config.config.tracker_id
        ? Number(config.config.tracker_id)
        : 1, // 1 = Bug
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Redmine-API-Key': config.apiToken,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(
      `Redmine API error: ${response.status} ${err.substring(0, 200)}`
    );
  }
  const data = (await response.json()) as { issue: { id: number } };
  return {
    url: `${apiBase}/issues/${data.issue.id}`,
    key: `#${data.issue.id}`,
  };
}

async function redmineTestConnection(
  config: TrackerConfig
): Promise<ConnectionTestResult> {
  try {
    const apiBase = config.apiUrl.replace(/\/$/, '');
    const response = await fetch(`${apiBase}/users/current.json`, {
      headers: { 'X-Redmine-API-Key': config.apiToken },
    });
    if (response.ok) {
      const data = (await response.json()) as {
        user: { login: string; firstname: string };
      };
      return {
        ok: true,
        message: `Connected as ${data.user.firstname} (${data.user.login})`,
      };
    }
    return { ok: false, message: `HTTP ${response.status}` };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}

// ─── YouTrack ───

async function youtrackCreateIssue(
  config: TrackerConfig,
  issue: IssuePayload
): Promise<ExternalIssueResult> {
  const projectShortName = config.config.project_id;
  if (!projectShortName)
    throw new Error('YouTrack project_id (short name) is not configured');

  const apiBase = config.apiUrl.replace(/\/$/, '');
  const url = `${apiBase}/api/issues`;
  const body = {
    project: { id: projectShortName },
    summary: issue.title,
    description: issue.description || 'Created from Argus',
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiToken}`,
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(
      `YouTrack API error: ${response.status} ${err.substring(0, 200)}`
    );
  }
  const data = (await response.json()) as { id: string; idReadable: string };
  return { url: `${apiBase}/issue/${data.idReadable}`, key: data.idReadable };
}

async function youtrackTestConnection(
  config: TrackerConfig
): Promise<ConnectionTestResult> {
  try {
    const apiBase = config.apiUrl.replace(/\/$/, '');
    const response = await fetch(`${apiBase}/api/users/me?fields=login,name`, {
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        Accept: 'application/json',
      },
    });
    if (response.ok) {
      const data = (await response.json()) as { login: string; name: string };
      return { ok: true, message: `Connected as ${data.name} (${data.login})` };
    }
    return { ok: false, message: `HTTP ${response.status}` };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}

// ─── Trello ───

async function trelloCreateIssue(
  config: TrackerConfig,
  issue: IssuePayload
): Promise<ExternalIssueResult> {
  const listId = config.config.list_id;
  if (!listId) throw new Error('Trello list_id is not configured');

  const apiKey = config.config.api_key || '';
  const url = `https://api.trello.com/1/cards?key=${apiKey}&token=${config.apiToken}`;
  const body = {
    idList: listId,
    name: issue.title,
    desc: issue.description || 'Created from Argus',
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(
      `Trello API error: ${response.status} ${err.substring(0, 200)}`
    );
  }
  const data = (await response.json()) as {
    id: string;
    shortUrl: string;
    idShort: number;
  };
  return { url: data.shortUrl, key: `#${data.idShort}` };
}

async function trelloTestConnection(
  config: TrackerConfig
): Promise<ConnectionTestResult> {
  try {
    const apiKey = config.config.api_key || '';
    const response = await fetch(
      `https://api.trello.com/1/members/me?key=${apiKey}&token=${config.apiToken}`
    );
    if (response.ok) {
      const data = (await response.json()) as {
        username: string;
        fullName: string;
      };
      return {
        ok: true,
        message: `Connected as ${data.fullName} (@${data.username})`,
      };
    }
    return { ok: false, message: `HTTP ${response.status}` };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}

// ─── Dispatcher ───

const adapters: Record<
  string,
  {
    createIssue: (
      config: TrackerConfig,
      issue: IssuePayload
    ) => Promise<ExternalIssueResult>;
    testConnection: (config: TrackerConfig) => Promise<ConnectionTestResult>;
  }
> = {
  jira: { createIssue: jiraCreateIssue, testConnection: jiraTestConnection },
  github: {
    createIssue: githubCreateIssue,
    testConnection: githubTestConnection,
  },
  linear: {
    createIssue: linearCreateIssue,
    testConnection: linearTestConnection,
  },
  clickup: {
    createIssue: clickupCreateIssue,
    testConnection: clickupTestConnection,
  },
  asana: { createIssue: asanaCreateIssue, testConnection: asanaTestConnection },
  notion: {
    createIssue: notionCreateIssue,
    testConnection: notionTestConnection,
  },
  shortcut: {
    createIssue: shortcutCreateIssue,
    testConnection: shortcutTestConnection,
  },
  azure_devops: {
    createIssue: azureDevOpsCreateIssue,
    testConnection: azureDevOpsTestConnection,
  },
  redmine: {
    createIssue: redmineCreateIssue,
    testConnection: redmineTestConnection,
  },
  youtrack: {
    createIssue: youtrackCreateIssue,
    testConnection: youtrackTestConnection,
  },
  trello: {
    createIssue: trelloCreateIssue,
    testConnection: trelloTestConnection,
  },
};

export async function createExternalIssue(
  config: TrackerConfig,
  issue: IssuePayload
): Promise<ExternalIssueResult> {
  const adapter = adapters[config.provider];
  if (!adapter) {
    throw new Error(`Unsupported tracker provider: ${config.provider}`);
  }
  return adapter.createIssue(config, issue);
}

export async function testTrackerConnection(
  config: TrackerConfig
): Promise<ConnectionTestResult> {
  const adapter = adapters[config.provider];
  if (!adapter) {
    return { ok: false, message: `Unsupported provider: ${config.provider}` };
  }
  return adapter.testConnection(config);
}

// ─── External Issue Status Check ───

export interface ExternalIssueStatus {
  state: 'open' | 'closed' | 'unknown';
  title?: string;
  updatedAt?: string;
  closedAt?: string;
  url: string;
}

/**
 * Parse external_url to extract provider-specific info.
 * GitHub: https://github.com/owner/repo/issues/123
 * Linear: https://linear.app/team/issue/TEAM-123
 */
function parseGitHubUrl(url: string): { owner: string; repo: string; number: number } | null {
  const m = url.match(/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
  if (!m) return null;
  return { owner: m[1], repo: m[2], number: parseInt(m[3], 10) };
}

export async function fetchExternalIssueStatus(
  externalUrl: string,
  trackerConfig?: TrackerConfig
): Promise<ExternalIssueStatus> {
  // GitHub
  const gh = parseGitHubUrl(externalUrl);
  if (gh && trackerConfig?.provider === 'github') {
    try {
      const apiBase = trackerConfig.apiUrl?.replace(/\/$/, '') || 'https://api.github.com';
      const response = await fetch(
        `${apiBase}/repos/${gh.owner}/${gh.repo}/issues/${gh.number}`,
        {
          headers: {
            Authorization: `Bearer ${trackerConfig.apiToken}`,
            Accept: 'application/vnd.github+json',
          },
        }
      );
      if (response.ok) {
        const data = (await response.json()) as {
          state: string;
          title: string;
          updated_at: string;
          closed_at: string | null;
        };
        return {
          state: data.state === 'closed' ? 'closed' : 'open',
          title: data.title,
          updatedAt: data.updated_at,
          closedAt: data.closed_at || undefined,
          url: externalUrl,
        };
      }
      logger.warn('GitHub status check failed', { status: response.status });
    } catch (error) {
      logger.warn('GitHub status check error', { error: (error as Error).message });
    }
  }

  return { state: 'unknown', url: externalUrl };
}
