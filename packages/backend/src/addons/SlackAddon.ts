/**
 * Slack Addon
 *
 * Sends event notifications to Slack via Incoming Webhooks.
 */

import Addon from './Addon';
import { slackDefinition } from './definitions';
import { IntegrationSystemEvent } from '../types/integrationEvents';
import { formatSlackMessage } from './EventFormatter';

export class SlackAddon extends Addon {
  constructor() {
    super(slackDefinition);
  }

  async handleEvent(
    event: IntegrationSystemEvent,
    parameters: Record<string, any>,
    integrationId: string
  ): Promise<void> {
    const { url, username, emojiIcon, defaultChannel, customHeaders } = parameters;

    if (!url) {
      this.logger.warn(`Missing Slack webhook URL for integration ${integrationId}`);
      await this.registerEvent(integrationId, event, 'failed', 'Missing webhook URL');
      return;
    }

    try {
      const payload = formatSlackMessage(event, {
        username,
        channel: defaultChannel,
        emojiIcon,
      });

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...this.parseCustomHeaders(customHeaders),
      };

      const response = await this.fetchRetry(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      this.logger.info(
        `Slack notification sent for event ${event.type} (integration: ${integrationId})`
      );

      await this.registerEvent(integrationId, event, 'success', '', {
        url: this.maskUrl(url),
        channel: defaultChannel,
        statusCode: response.status,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send Slack notification for integration ${integrationId}:`,
        error
      );

      await this.registerFailure(integrationId, event, error, {
        url: this.maskUrl(url),
        channel: defaultChannel,
      });
    }
  }

  /**
   * Mask sensitive parts of URL for logging
   */
  private maskUrl(url: string): string {
    try {
      const parsed = new URL(url);
      const pathParts = parsed.pathname.split('/');
      if (pathParts.length > 2) {
        return `${parsed.origin}/${pathParts[1]}/***`;
      }
      return `${parsed.origin}/***`;
    } catch {
      return '***';
    }
  }
}

export default SlackAddon;
