/**
 * Addon Index
 *
 * Registry for all available addon providers.
 */

import { Addon } from './addon';
import { SlackAddon } from './slack-addon';
import { SlackAppAddon } from './slack-app-addon';
import { WebhookAddon } from './webhook-addon';
import { TeamsAddon } from './teams-addon';
import { LarkAddon } from './lark-addon';
import { NewRelicAddon } from './new-relic-addon';
import { DiscordAddon } from './discord-addon';
import { PagerDutyAddon } from './pager-duty-addon';
import { TelegramAddon } from './telegram-addon';
import { WhatsAppAddon } from './whats-app-addon';
import { LineAddon } from './line-addon';
import { KakaoAddon } from './kakao-addon';
import { GoogleChatAddon } from './google-chat-addon';
import { WeComAddon } from './we-com-addon';
import { DingTalkAddon } from './ding-talk-addon';
import { DebugAddon } from './debug-addon';
import { getAllAddonDefinitions, getAddonDefinition, ADDON_DEFINITIONS } from './definitions';
import type { AddonDefinition } from './definitions';

export type AddonProviders = Record<string, Addon>;

/**
 * Get all addon instances
 */
export function getAddons(): AddonProviders {
  return {
    debug: new DebugAddon(),
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
  DebugAddon,
  AddonDefinition,
  getAddonDefinition,
  ADDON_DEFINITIONS,
};
