/**
 * Addon Index
 *
 * Registry for all available addon providers.
 */

import { Addon } from './Addon';
import { SlackAddon } from './SlackAddon';
import { SlackAppAddon } from './SlackAppAddon';
import { WebhookAddon } from './WebhookAddon';
import { TeamsAddon } from './TeamsAddon';
import { LarkAddon } from './LarkAddon';
import { NewRelicAddon } from './NewRelicAddon';
import { DiscordAddon } from './DiscordAddon';
import { PagerDutyAddon } from './PagerDutyAddon';
import { TelegramAddon } from './TelegramAddon';
import { WhatsAppAddon } from './WhatsAppAddon';
import { LineAddon } from './LineAddon';
import { KakaoAddon } from './KakaoAddon';
import { GoogleChatAddon } from './GoogleChatAddon';
import { WeComAddon } from './WeComAddon';
import { DingTalkAddon } from './DingTalkAddon';
import { getAllAddonDefinitions, getAddonDefinition, ADDON_DEFINITIONS } from './definitions';
import type { AddonDefinition } from './definitions';

export type AddonProviders = Record<string, Addon>;

/**
 * Get all addon instances
 */
export function getAddons(): AddonProviders {
  return {
    slack: new SlackAddon(),
    'slack-app': new SlackAppAddon(),
    'new-relic': new NewRelicAddon(),
    webhook: new WebhookAddon(),
    teams: new TeamsAddon(),
    lark: new LarkAddon(),
    discord: new DiscordAddon(),
    pagerduty: new PagerDutyAddon(),
    telegram: new TelegramAddon(),
    whatsapp: new WhatsAppAddon(),
    line: new LineAddon(),
    kakao: new KakaoAddon(),
    'google-chat': new GoogleChatAddon(),
    wecom: new WeComAddon(),
    dingtalk: new DingTalkAddon(),
  };
}

/**
 * Get a specific addon by provider name
 */
export function getAddon(provider: string): Addon | undefined {
  const addons = getAddons();
  return addons[provider];
}

/**
 * Get all provider definitions
 */
export function getProviderDefinitions(): AddonDefinition[] {
  return getAllAddonDefinitions();
}

// Re-export for convenience
export {
  Addon,
  SlackAddon,
  SlackAppAddon,
  WebhookAddon,
  TeamsAddon,
  LarkAddon,
  NewRelicAddon,
  DiscordAddon,
  PagerDutyAddon,
  TelegramAddon,
  WhatsAppAddon,
  LineAddon,
  KakaoAddon,
  GoogleChatAddon,
  WeComAddon,
  DingTalkAddon,
  AddonDefinition,
  getAddonDefinition,
  ADDON_DEFINITIONS,
};
