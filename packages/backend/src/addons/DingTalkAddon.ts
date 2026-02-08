/**
 * DingTalk Addon
 *
 * Sends event notifications to DingTalk groups via Bot Webhooks.
 */

import crypto from 'crypto';
import Addon from './Addon';
import { dingtalkDefinition } from './definitions';
import { IntegrationSystemEvent } from '../types/integrationEvents';
import { formatDingTalkMessage } from './EventFormatter';

export class DingTalkAddon extends Addon {
  constructor() {
    super(dingtalkDefinition);
  }

  async handleEvent(
    event: IntegrationSystemEvent,
    parameters: Record<string, any>,
    integrationId: string
  ): Promise<void> {
    const { accessToken, secret } = parameters;

    if (!accessToken) {
      this.logger.warn(`Missing DingTalk access token for integration ${integrationId}`);
      await this.registerEvent(integrationId, event, 'failed', 'Missing access token');
      return;
    }

    let url = `https://oapi.dingtalk.com/robot/send?access_token=${accessToken}`;

    if (secret) {
      const timestamp = Date.now();
      const stringToSign = `${timestamp}\n${secret}`;
      const sign = crypto.createHmac('sha256', secret).update(stringToSign).digest('base64');

      url += `&timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`;
    }

    try {
      const payload = formatDingTalkMessage(event);

      const response = await this.fetchRetry(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      this.logger.info(
        `DingTalk notification sent for event ${event.type} (integration: ${integrationId})`
      );

      await this.registerEvent(integrationId, event, 'success', '', {
        statusCode: response.status,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send DingTalk notification for integration ${integrationId}:`,
        error
      );

      await this.registerFailure(integrationId, event, error);
    }
  }
}

export default DingTalkAddon;
