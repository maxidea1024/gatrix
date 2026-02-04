/**
 * Lark (Feishu) Addon
 *
 * Sends event notifications to Lark via Custom Bot Webhooks.
 */

import Addon from './Addon';
import { larkDefinition } from './definitions';
import { IntegrationSystemEvent } from '../types/integrationEvents';
import { formatLarkMessage } from './EventFormatter';
import crypto from 'crypto';

export class LarkAddon extends Addon {
  constructor() {
    super(larkDefinition);
  }

  async handleEvent(
    event: IntegrationSystemEvent,
    parameters: Record<string, any>,
    integrationId: string
  ): Promise<void> {
    const { url, secret, customHeaders } = parameters;

    if (!url) {
      this.logger.warn(`Missing Lark webhook URL for integration ${integrationId}`);
      await this.registerEvent(integrationId, event, 'failed', 'Missing webhook URL');
      return;
    }

    try {
      let payload = formatLarkMessage(event);

      // Add signature if secret is provided
      if (secret) {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const sign = this.generateSign(timestamp, secret);
        payload = {
          ...payload,
          timestamp,
          sign,
        };
      }

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
        `Lark notification sent for event ${event.type} (integration: ${integrationId})`
      );

      await this.registerEvent(integrationId, event, 'success', '', {
        url: this.maskUrl(url),
        statusCode: response.status,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to send Lark notification for integration ${integrationId}:`,
        error
      );

      await this.registerEvent(integrationId, event, 'failed', errorMessage, {
        url: this.maskUrl(url),
      });
    }
  }

  /**
   * Generate signature for Lark webhook
   */
  private generateSign(timestamp: string, secret: string): string {
    const stringToSign = `${timestamp}\n${secret}`;
    const hmac = crypto.createHmac('sha256', stringToSign);
    return hmac.update('').digest('base64');
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

export default LarkAddon;
