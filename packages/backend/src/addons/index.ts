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
    webhook: new WebhookAddon(),
    teams: new TeamsAddon(),
    lark: new LarkAddon(),
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
  AddonDefinition,
  getAddonDefinition,
  ADDON_DEFINITIONS,
};
