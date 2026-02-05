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
  deprecated: 'integrations.providers.slack.deprecated',
};

/**
 * Slack App Addon Definition
 * Uses Slack Web API with access token instead of webhook
 */
export const slackAppDefinition: AddonDefinition = {
  name: 'slack-app',
  displayName: 'integrations.providers.slackApp.displayName',
  description: 'integrations.providers.slackApp.description',
  documentationUrl: 'https://api.slack.com/messaging/sending',
  parameters: [
    {
      name: 'accessToken',
      displayName: 'integrations.providers.slackApp.params.accessToken.displayName',
      type: 'text',
      description: 'integrations.providers.slackApp.params.accessToken.description',
      placeholder: 'xoxb-xxx-xxx-xxx',
      required: true,
      sensitive: true,
    },
    {
      name: 'defaultChannels',
      displayName: 'integrations.providers.slackApp.params.defaultChannels.displayName',
      type: 'text',
      description: 'integrations.providers.slackApp.params.defaultChannels.description',
      placeholder: '#general, #alerts',
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
      sensitive: false,
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
 * New Relic Addon Definition
 */
export const newRelicDefinition: AddonDefinition = {
  name: 'new-relic',
  displayName: 'integrations.providers.newRelic.displayName',
  description: 'integrations.providers.newRelic.description',
  documentationUrl: 'https://docs.newrelic.com/docs/apis/intro-apis/new-relic-api-keys/',
  parameters: [
    {
      name: 'url',
      displayName: 'integrations.providers.newRelic.params.url.displayName',
      type: 'url',
      description: 'integrations.providers.newRelic.params.url.description',
      placeholder: 'https://insights-collector.newrelic.com/v1/accounts/YOUR_ACCOUNT_ID/events',
      required: true,
      sensitive: false,
    },
    {
      name: 'licenseKey',
      displayName: 'integrations.providers.newRelic.params.licenseKey.displayName',
      type: 'text',
      description: 'integrations.providers.newRelic.params.licenseKey.description',
      placeholder: 'eu01xx0f12a6b3434a8d710110bd862',
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
    {
      name: 'bodyTemplate',
      displayName: 'integrations.providers.newRelic.params.bodyTemplate.displayName',
      type: 'textfield',
      description: 'integrations.providers.newRelic.params.bodyTemplate.description',
      placeholder: `{
  "event": "{{event.type}}",
  "eventType": "gatrix",
  "featureToggle": "{{event.data.name}}"
}`,
      required: false,
      sensitive: false,
    },
  ],
  events: ALL_INTEGRATION_EVENTS,
};

/**
 * Discord Addon Definition
 */
export const discordDefinition: AddonDefinition = {
  name: 'discord',
  displayName: 'integrations.providers.discord.displayName',
  description: 'integrations.providers.discord.description',
  documentationUrl: 'https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks',
  parameters: [
    {
      name: 'url',
      displayName: 'integrations.providers.discord.params.url.displayName',
      type: 'url',
      description: 'integrations.providers.discord.params.url.description',
      placeholder: 'https://discord.com/api/webhooks/xxx/xxx',
      required: true,
      sensitive: true,
    },
    {
      name: 'username',
      displayName: 'integrations.providers.discord.params.username.displayName',
      type: 'text',
      description: 'integrations.providers.discord.params.username.description',
      placeholder: 'Gatrix Bot',
      required: false,
      sensitive: false,
      default: 'Gatrix',
    },
    {
      name: 'avatar_url',
      displayName: 'integrations.providers.discord.params.avatar_url.displayName',
      type: 'url',
      description: 'integrations.providers.discord.params.avatar_url.description',
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
 * PagerDuty Addon Definition
 */
export const pagerDutyDefinition: AddonDefinition = {
  name: 'pagerduty',
  displayName: 'integrations.providers.pagerduty.displayName',
  description: 'integrations.providers.pagerduty.description',
  documentationUrl: 'https://developer.pagerduty.com/docs/apis/events-api-v2/',
  parameters: [
    {
      name: 'routingKey',
      displayName: 'integrations.providers.pagerduty.params.routingKey.displayName',
      type: 'text',
      description: 'integrations.providers.pagerduty.params.routingKey.description',
      placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
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
 * Line Addon Definition
 */
export const lineDefinition: AddonDefinition = {
  name: 'line',
  displayName: 'integrations.providers.line.displayName',
  description: 'integrations.providers.line.description',
  documentationUrl: 'https://developers.line.biz/en/docs/messaging-api/overview/',
  parameters: [
    {
      name: 'accessToken',
      displayName: 'integrations.providers.line.params.accessToken.displayName',
      type: 'text',
      description: 'integrations.providers.line.params.accessToken.description',
      required: true,
      sensitive: true,
    },
    {
      name: 'to',
      displayName: 'integrations.providers.line.params.to.displayName',
      type: 'text',
      description: 'integrations.providers.line.params.to.description',
      placeholder: 'User ID or Group ID',
      required: true,
      sensitive: false,
    },
  ],
  events: ALL_INTEGRATION_EVENTS,
};

/**
 * KakaoTalk Addon Definition
 */
export const kakaoDefinition: AddonDefinition = {
  name: 'kakao',
  displayName: 'integrations.providers.kakao.displayName',
  description: 'integrations.providers.kakao.description',
  parameters: [
    {
      name: 'apiUrl',
      displayName: 'integrations.providers.kakao.params.apiUrl.displayName',
      type: 'url',
      description: 'integrations.providers.kakao.params.apiUrl.description',
      placeholder: 'https://api.kakaoagent.com/v1/send',
      required: true,
      sensitive: false,
    },
    {
      name: 'apiKey',
      displayName: 'integrations.providers.kakao.params.apiKey.displayName',
      type: 'text',
      required: true,
      sensitive: true,
    },
    {
      name: 'senderKey',
      displayName: 'integrations.providers.kakao.params.senderKey.displayName',
      type: 'text',
      required: true,
      sensitive: false,
    },
  ],
  events: ALL_INTEGRATION_EVENTS,
};

/**
 * Google Chat Addon Definition
 */
export const googleChatDefinition: AddonDefinition = {
  name: 'google-chat',
  displayName: 'integrations.providers.googleChat.displayName',
  description: 'integrations.providers.googleChat.description',
  documentationUrl: 'https://developers.google.com/chat/how-tos/webhooks',
  parameters: [
    {
      name: 'url',
      displayName: 'integrations.providers.googleChat.params.url.displayName',
      type: 'url',
      description: 'integrations.providers.googleChat.params.url.description',
      placeholder: 'https://chat.googleapis.com/v1/spaces/xxx/messages?key=xxx&token=xxx',
      required: true,
      sensitive: true,
    },
  ],
  events: ALL_INTEGRATION_EVENTS,
};

/**
 * Telegram Addon Definition
 */
export const telegramDefinition: AddonDefinition = {
  name: 'telegram',
  displayName: 'integrations.providers.telegram.displayName',
  description: 'integrations.providers.telegram.description',
  documentationUrl: 'https://core.telegram.org/bots/api#sendmessage',
  parameters: [
    {
      name: 'botToken',
      displayName: 'integrations.providers.telegram.params.botToken.displayName',
      type: 'text',
      description: 'integrations.providers.telegram.params.botToken.description',
      placeholder: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
      required: true,
      sensitive: true,
    },
    {
      name: 'chatId',
      displayName: 'integrations.providers.telegram.params.chatId.displayName',
      type: 'text',
      description: 'integrations.providers.telegram.params.chatId.description',
      placeholder: '@channelname or 123456789',
      required: true,
      sensitive: false,
    },
    {
      name: 'parse_mode',
      displayName: 'integrations.providers.telegram.params.parse_mode.displayName',
      type: 'text',
      description: 'integrations.providers.telegram.params.parse_mode.description',
      required: false,
      sensitive: false,
      default: 'Markdown',
    },
  ],
  events: ALL_INTEGRATION_EVENTS,
};

/**
 * WhatsApp (Meta API) Addon Definition
 */
export const whatsappDefinition: AddonDefinition = {
  name: 'whatsapp',
  displayName: 'integrations.providers.whatsapp.displayName',
  description: 'integrations.providers.whatsapp.description',
  documentationUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages',
  parameters: [
    {
      name: 'accessToken',
      displayName: 'integrations.providers.whatsapp.params.accessToken.displayName',
      type: 'text',
      description: 'integrations.providers.whatsapp.params.accessToken.description',
      required: true,
      sensitive: true,
    },
    {
      name: 'phoneNumberId',
      displayName: 'integrations.providers.whatsapp.params.phoneNumberId.displayName',
      type: 'text',
      description: 'integrations.providers.whatsapp.params.phoneNumberId.description',
      required: true,
      sensitive: false,
    },
    {
      name: 'recipientPhoneNumber',
      displayName: 'integrations.providers.whatsapp.params.recipientPhoneNumber.displayName',
      type: 'text',
      description: 'integrations.providers.whatsapp.params.recipientPhoneNumber.description',
      placeholder: '15551234567',
      required: true,
      sensitive: false,
    },
  ],
  events: ALL_INTEGRATION_EVENTS,
};

/**
 * WeChat Work (WeCom) Addon Definition
 */
export const wecomDefinition: AddonDefinition = {
  name: 'wecom',
  displayName: 'integrations.providers.wecom.displayName',
  description: 'integrations.providers.wecom.description',
  documentationUrl: 'https://developer.work.weixin.qq.com/document/path/91770',
  parameters: [
    {
      name: 'key',
      displayName: 'integrations.providers.wecom.params.key.displayName',
      type: 'text',
      description: 'integrations.providers.wecom.params.key.description',
      placeholder: '693a91f6-7xxx-4xxx-8xxx-xxxxxxxxxxxx',
      required: true,
      sensitive: true,
    },
  ],
  events: ALL_INTEGRATION_EVENTS,
};

/**
 * DingTalk Addon Definition
 */
export const dingtalkDefinition: AddonDefinition = {
  name: 'dingtalk',
  displayName: 'integrations.providers.dingtalk.displayName',
  description: 'integrations.providers.dingtalk.description',
  documentationUrl: 'https://open.dingtalk.com/document/group/custom-robot-access',
  parameters: [
    {
      name: 'accessToken',
      displayName: 'integrations.providers.dingtalk.params.accessToken.displayName',
      type: 'text',
      description: 'integrations.providers.dingtalk.params.accessToken.description',
      required: true,
      sensitive: true,
    },
    {
      name: 'secret',
      displayName: 'integrations.providers.dingtalk.params.secret.displayName',
      type: 'text',
      description: 'integrations.providers.dingtalk.params.secret.description',
      required: false,
      sensitive: true,
    },
  ],
  events: ALL_INTEGRATION_EVENTS,
};

/**
 * Debug Addon Definition
 */
export const debugDefinition: AddonDefinition = {
  name: 'debug',
  displayName: 'integrations.providers.debug.displayName',
  description: 'integrations.providers.debug.description',
  parameters: [
    {
      name: 'logLevel',
      displayName: 'integrations.providers.debug.params.logLevel.displayName',
      type: 'list',
      description: 'integrations.providers.debug.params.logLevel.description',
      placeholder: 'info',
      required: false,
      sensitive: false,
      default: 'info',
    },
    {
      name: 'simulateAttribute',
      displayName: 'integrations.providers.debug.params.simulateAttribute.displayName',
      type: 'text',
      description: 'integrations.providers.debug.params.simulateAttribute.description',
      placeholder: 'key=value',
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
  debug: debugDefinition,
  'slack-app': slackAppDefinition,
  'new-relic': newRelicDefinition,
  webhook: webhookDefinition,
  teams: teamsDefinition,
  lark: larkDefinition,
  slack: slackDefinition,
  discord: discordDefinition,
  pagerduty: pagerDutyDefinition,
  telegram: telegramDefinition,
  whatsapp: whatsappDefinition,
  line: lineDefinition,
  kakao: kakaoDefinition,
  'google-chat': googleChatDefinition,
  wecom: wecomDefinition,
  dingtalk: dingtalkDefinition,
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
