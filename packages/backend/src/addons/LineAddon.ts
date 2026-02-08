/**
 * Line Addon
 *
 * Sends event notifications to Line via Messaging API.
 */

import Addon from './Addon';
import { lineDefinition } from './definitions';
import { IntegrationSystemEvent } from '../types/integrationEvents';
import { formatLineMessage } from './EventFormatter';

export class LineAddon extends Addon {
  private readonly apiUrl = 'https://api.line.me/v2/bot/message/push';

  constructor() {
    super(lineDefinition);
  }

  async handleEvent(
    event: IntegrationSystemEvent,
    parameters: Record<string, any>,
    integrationId: string
  ): Promise<void> {
    const { accessToken, to } = parameters;

    if (!accessToken || !to) {
      this.logger.warn(`Missing Line configuration for integration ${integrationId}`);
      await this.registerEvent(
        integrationId,
        event,
        'failed',
        'Missing access token or recipient (to)'
      );
      return;
    }

    try {
      const payload = formatLineMessage(event, to);

      const response = await this.fetchRetry(this.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      this.logger.info(
        `Line notification sent for event ${event.type} (integration: ${integrationId})`
      );

      await this.registerEvent(integrationId, event, 'success', '', {
        to,
        statusCode: response.status,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send Line notification for integration ${integrationId}:`,
        error
      );

      await this.registerFailure(integrationId, event, error, {
        to,
      });
    }
  }
}

export default LineAddon;
