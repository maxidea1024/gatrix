/**
 * Google Chat Addon
 *
 * Sends event notifications to Google Chat via Incoming Webhooks.
 */

import Addon from './Addon';
import { googleChatDefinition } from './definitions';
import { IntegrationSystemEvent } from '../types/integrationEvents';
import { formatGoogleChatMessage } from './EventFormatter';

export class GoogleChatAddon extends Addon {
  constructor() {
    super(googleChatDefinition);
  }

  async handleEvent(
    event: IntegrationSystemEvent,
    parameters: Record<string, any>,
    integrationId: string
  ): Promise<void> {
    const { url } = parameters;

    if (!url) {
      this.logger.warn(`Missing Google Chat webhook URL for integration ${integrationId}`);
      await this.registerEvent(integrationId, event, 'failed', 'Missing webhook URL');
      return;
    }

    try {
      const payload = formatGoogleChatMessage(event);

      const response = await this.fetchRetry(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      this.logger.info(
        `Google Chat notification sent for event ${event.type} (integration: ${integrationId})`
      );

      await this.registerEvent(integrationId, event, 'success', '', {
        url: '***',
        statusCode: response.status,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send Google Chat notification for integration ${integrationId}:`,
        error
      );

      await this.registerFailure(integrationId, event, error, {
        url: '***',
      });
    }
  }
}

export default GoogleChatAddon;
