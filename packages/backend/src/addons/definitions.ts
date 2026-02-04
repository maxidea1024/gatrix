/**
 * Addon Definitions
 *
 * Configuration schemas for each integration provider.
 * Note: displayName and description use localization keys (integrations.providers.*)
 * These should be translated on the frontend using i18n.
 */

import { IntegrationEventType, ALL_INTEGRATION_EVENTS } from '../types/integrationEvents';

/**
 * Parameter type for addon configuration
 */
export type AddonParameterType = 'text' | 'textfield' | 'url' | 'list' | 'number' | 'boolean';

/**
 * Parameter definition for addon configuration
 */
export interface AddonParameter {
  name: string;
  displayName: string; // Localization key: integrations.providers.{provider}.params.{name}.displayName
  type: AddonParameterType;
  description?: string; // Localization key: integrations.providers.{provider}.params.{name}.description
  placeholder?: string;
  required: boolean;
  sensitive: boolean;
  default?: string | number | boolean;
}

/**
 * Addon definition
 */
export interface AddonDefinition {
  name: string;
  displayName: string; // Localization key: integrations.providers.{name}.displayName
  description: string; // Localization key: integrations.providers.{name}.description
  documentationUrl?: string;
  parameters: AddonParameter[];
  events: IntegrationEventType[];
  deprecated?: string;
}

// ============================================================================
// Provider Definitions
// ============================================================================

/**
 * Slack Addon Definition
 */
export const slackDefinition: AddonDefinition = {
  name: 'slack',
  displayName: 'integrations.providers.slack.displayName',
  description: 'integrations.providers.slack.description',
  documentationUrl: 'https://api.slack.com/messaging/webhooks',
  parameters: [
    {
      name: 'url',
      displayName: 'integrations.providers.slack.params.url.displayName',
      type: 'url',
      description: 'integrations.providers.slack.params.url.description',
      placeholder: 'https://hooks.slack.com/services/xxx/xxx/xxx',
      required: true,
      sensitive: true,
    },
    {
      name: 'username',
      displayName: 'integrations.providers.slack.params.username.displayName',
      type: 'text',
      description: 'integrations.providers.slack.params.username.description',
      placeholder: 'Gatrix',
      required: false,
      sensitive: false,
      default: 'Gatrix',
    },
    {
      name: 'emojiIcon',
      displayName: 'integrations.providers.slack.params.emojiIcon.displayName',
      type: 'text',
      description: 'integrations.providers.slack.params.emojiIcon.description',
      placeholder: ':gatrix:',
      required: false,
      sensitive: false,
      default: ':rocket:',
    },
    {
      name: 'defaultChannel',
      displayName: 'integrations.providers.slack.params.defaultChannel.displayName',
      type: 'text',
      description: 'integrations.providers.slack.params.defaultChannel.description',
      placeholder: '#general',
      required: false,
      sensitive: false,
    },
    {
      name: 'customHeaders',
      displayName: 'integrations.providers.common.customHeaders.displayName',
      type: 'textfield',
      description: 'integrations.providers.common.customHeaders.description',
      placeholder: '{"X-Custom-Header": "value"}',
      required: false,
      sensitive: false,
    },
  ],
  events: ALL_INTEGRATION_EVENTS,
};

/**
 * Webhook Addon Definition
 */
export const webhookDefinition: AddonDefinition = {
  name: 'webhook',
  displayName: 'integrations.providers.webhook.displayName',
  description: 'integrations.providers.webhook.description',
  parameters: [
    {
      name: 'url',
      displayName: 'integrations.providers.webhook.params.url.displayName',
      type: 'url',
      description: 'integrations.providers.webhook.params.url.description',
      placeholder: 'https://example.com/webhook',
      required: true,
      sensitive: true,
    },
    {
      name: 'contentType',
      displayName: 'integrations.providers.webhook.params.contentType.displayName',
      type: 'text',
      description: 'integrations.providers.webhook.params.contentType.description',
      placeholder: 'application/json',
      required: false,
      sensitive: false,
      default: 'application/json',
    },
    {
      name: 'authorization',
      displayName: 'integrations.providers.webhook.params.authorization.displayName',
      type: 'text',
      description: 'integrations.providers.webhook.params.authorization.description',
      placeholder: 'Bearer token or Basic auth',
      required: false,
      sensitive: true,
    },
    {
      name: 'customHeaders',
      displayName: 'integrations.providers.common.customHeaders.displayName',
      type: 'textfield',
      description: 'integrations.providers.common.customHeaders.description',
      placeholder: '{"X-Custom-Header": "value"}',
      required: false,
      sensitive: false,
    },
    {
      name: 'bodyTemplate',
      displayName: 'integrations.providers.webhook.params.bodyTemplate.displayName',
      type: 'textfield',
      description: 'integrations.providers.webhook.params.bodyTemplate.description',
      placeholder: '{"text": "{{event.type}} by {{createdBy}}"}',
      required: false,
      sensitive: false,
    },
  ],
  events: ALL_INTEGRATION_EVENTS,
};

/**
 * Microsoft Teams Addon Definition
 */
export const teamsDefinition: AddonDefinition = {
  name: 'teams',
  displayName: 'integrations.providers.teams.displayName',
  description: 'integrations.providers.teams.description',
  documentationUrl:
    'https://docs.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook',
  parameters: [
    {
      name: 'url',
      displayName: 'integrations.providers.teams.params.url.displayName',
      type: 'url',
      description: 'integrations.providers.teams.params.url.description',
      placeholder: 'https://xxx.webhook.office.com/webhookb2/xxx',
      required: true,
      sensitive: true,
    },
    {
      name: 'customHeaders',
      displayName: 'integrations.providers.common.customHeaders.displayName',
      type: 'textfield',
      description: 'integrations.providers.common.customHeaders.description',
      placeholder: '{"X-Custom-Header": "value"}',
      required: false,
      sensitive: false,
    },
  ],
  events: ALL_INTEGRATION_EVENTS,
};

/**
 * Lark (Feishu) Addon Definition
 */
export const larkDefinition: AddonDefinition = {
  name: 'lark',
  displayName: 'integrations.providers.lark.displayName',
  description: 'integrations.providers.lark.description',
  documentationUrl: 'https://open.larksuite.com/document/client-docs/bot-v3/add-custom-bot',
  parameters: [
    {
      name: 'url',
      displayName: 'integrations.providers.lark.params.url.displayName',
      type: 'url',
      description: 'integrations.providers.lark.params.url.description',
      placeholder: 'https://open.larksuite.com/open-apis/bot/v2/hook/xxx',
      required: true,
      sensitive: true,
    },
    {
      name: 'secret',
      displayName: 'integrations.providers.lark.params.secret.displayName',
      type: 'text',
      description: 'integrations.providers.lark.params.secret.description',
      placeholder: 'xxxxxxxx',
      required: false,
      sensitive: true,
    },
    {
      name: 'customHeaders',
      displayName: 'integrations.providers.common.customHeaders.displayName',
      type: 'textfield',
      description: 'integrations.providers.common.customHeaders.description',
      placeholder: '{"X-Custom-Header": "value"}',
      required: false,
      sensitive: false,
    },
  ],
  events: ALL_INTEGRATION_EVENTS,
};

/**
 * All addon definitions
 */
export const ADDON_DEFINITIONS: Record<string, AddonDefinition> = {
  slack: slackDefinition,
  webhook: webhookDefinition,
  teams: teamsDefinition,
  lark: larkDefinition,
};

/**
 * Get addon definition by provider name
 */
export function getAddonDefinition(provider: string): AddonDefinition | undefined {
  return ADDON_DEFINITIONS[provider];
}

/**
 * Get all available addon definitions
 */
export function getAllAddonDefinitions(): AddonDefinition[] {
  return Object.values(ADDON_DEFINITIONS);
}
