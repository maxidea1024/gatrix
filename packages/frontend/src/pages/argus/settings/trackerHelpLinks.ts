/**
 * trackerHelpLinks.ts
 *
 * Provider별 API 설정 도움말 i18n 키 및 외부 문서 URL을 중앙 관리합니다.
 * ProviderWizardModal의 각 필드 helpTextKey / helpUrl 에 주입됩니다.
 *
 * 실제 번역 텍스트는 locales/{ko,en,zh}.ini의 argus.settings.trackerHelp.* 키를 따릅니다.
 */

export interface TrackerFieldHelp {
  /** i18n 키. t(helpTextKey, fallback)으로 사용 */
  helpTextKey?: string;
  /** helpText와 함께 표시할 외부 문서 링크 (선택사항) */
  helpUrl?: string;
}

export type TrackerHelpMap = Record<string, TrackerFieldHelp>;

/** 각 Provider의 필드 이름(key) → 도움말 매핑 */
export const TRACKER_HELP_LINKS: Record<string, TrackerHelpMap> = {
  jira: {
    api_token: {
      helpTextKey: 'argus.settings.trackerHelp.jiraApiToken',
      helpUrl: 'https://id.atlassian.com/manage-profile/security/api-tokens',
    },
    email: {
      helpTextKey: 'argus.settings.trackerHelp.jiraEmail',
    },
    project_key: {
      helpTextKey: 'argus.settings.trackerHelp.jiraProjectKey',
    },
    issue_type: {
      helpTextKey: 'argus.settings.trackerHelp.jiraIssueType',
    },
  },
  github: {
    api_token: {
      helpTextKey: 'argus.settings.trackerHelp.githubApiToken',
      helpUrl: 'https://github.com/settings/tokens/new',
    },
    repo: {
      helpTextKey: 'argus.settings.trackerHelp.githubRepo',
    },
  },
  linear: {
    api_token: {
      helpTextKey: 'argus.settings.trackerHelp.linearApiToken',
      helpUrl: 'https://linear.app/settings/api',
    },
    team_id: {
      helpTextKey: 'argus.settings.trackerHelp.linearTeamId',
    },
  },
  clickup: {
    api_token: {
      helpTextKey: 'argus.settings.trackerHelp.clickupApiToken',
      helpUrl: 'https://app.clickup.com/settings/apps',
    },
    list_id: {
      helpTextKey: 'argus.settings.trackerHelp.clickupListId',
    },
  },
  asana: {
    api_token: {
      helpTextKey: 'argus.settings.trackerHelp.asanaApiToken',
      helpUrl: 'https://app.asana.com/0/developer-console',
    },
    project_gid: {
      helpTextKey: 'argus.settings.trackerHelp.asanaProjectGid',
    },
  },
  notion: {
    api_token: {
      helpTextKey: 'argus.settings.trackerHelp.notionApiToken',
      helpUrl: 'https://www.notion.so/my-integrations',
    },
    database_id: {
      helpTextKey: 'argus.settings.trackerHelp.notionDbId',
    },
    title_property: {
      helpTextKey: 'argus.settings.trackerHelp.notionTitleProp',
    },
  },
  shortcut: {
    api_token: {
      helpTextKey: 'argus.settings.trackerHelp.shortcutApiToken',
      helpUrl: 'https://app.shortcut.com/settings/api-tokens',
    },
    project_id: {
      helpTextKey: 'argus.settings.trackerHelp.shortcutProjectId',
    },
  },
  azure_devops: {
    api_token: {
      helpTextKey: 'argus.settings.trackerHelp.azureApiToken',
      helpUrl: 'https://dev.azure.com/_usersSettings/tokens',
    },
    organization: {
      helpTextKey: 'argus.settings.trackerHelp.azureOrg',
    },
    project: {
      helpTextKey: 'argus.settings.trackerHelp.azureProject',
    },
  },
  redmine: {
    api_token: {
      helpTextKey: 'argus.settings.trackerHelp.redmineApiToken',
    },
    project_id: {
      helpTextKey: 'argus.settings.trackerHelp.redmineProjectId',
    },
    tracker_id: {
      helpTextKey: 'argus.settings.trackerHelp.redmineTrackerId',
    },
  },
  youtrack: {
    api_token: {
      helpTextKey: 'argus.settings.trackerHelp.youtrackApiToken',
    },
    project_id: {
      helpTextKey: 'argus.settings.trackerHelp.youtrackProjectId',
    },
  },
  trello: {
    api_token: {
      helpTextKey: 'argus.settings.trackerHelp.trelloApiToken',
      helpUrl:
        'https://trello.com/1/authorize?scope=read,write&expiration=never&name=Argus&response_type=token',
    },
    api_key: {
      helpTextKey: 'argus.settings.trackerHelp.trelloApiKey',
      helpUrl: 'https://trello.com/power-ups/admin',
    },
    list_id: {
      helpTextKey: 'argus.settings.trackerHelp.trelloListId',
    },
  },
};
