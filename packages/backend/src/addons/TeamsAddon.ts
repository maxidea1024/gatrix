/**
 * Microsoft Teams Addon
 *
 * Sends event notifications to Microsoft Teams via Incoming Webhooks.
 */

import Addon from './Addon';
import { teamsDefinition } from './definitions';
import { IntegrationSystemEvent } from '../types/integrationEvents';
import { formatTeamsMessage } from './EventFormatter';

export class TeamsAddon extends Addon {
  constructor() {
    super(teamsDefinition);
  }

  async handleEvent(
    event: IntegrationSystemEvent,
    parameters: Record<string, any>,
    integrationId: string
  ): Promise<void> {
    const { url, customHeaders } = parameters;

    if (!url) {
      this.logger.warn(`Missing Teams webhook URL for integration ${integrationId}`);
      await this.registerEvent(integrationId, event, 'failed', 'Missing webhook URL');
      return;
    }

    try {
      const payload = formatTeamsMessage(event);

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
        `Teams notification sent for event ${event.type} (integration: ${integrationId})`
      );

      await this.registerEvent(integrationId, event, 'success', '', {
        url: this.maskUrl(url),
        statusCode: response.status,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to send Teams notification for integration ${integrationId}:`,
        error
      );

      await this.registerEvent(integrationId, event, 'failed', errorMessage, {
        url: this.maskUrl(url),
      });
    }
  }

  /**
   * Mask sensitive parts of URL for logging
   */
  private maskUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return `${parsed.origin}/***`;
    } catch {
      return '***';
    }
  }
}

export default TeamsAddon;
