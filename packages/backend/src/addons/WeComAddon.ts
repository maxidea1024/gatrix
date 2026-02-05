/**
 * WeChat Work (WeCom) Addon
 *
 * Sends event notifications to WeChat Work groups via Bot Webhooks.
 */

import Addon from './Addon';
import { wecomDefinition } from './definitions';
import { IntegrationSystemEvent } from '../types/integrationEvents';
import { formatWeComMessage } from './EventFormatter';

export class WeComAddon extends Addon {
    constructor() {
        super(wecomDefinition);
    }

    async handleEvent(
        event: IntegrationSystemEvent,
        parameters: Record<string, any>,
        integrationId: string
    ): Promise<void> {
        const { key } = parameters;

        if (!key) {
            this.logger.warn(`Missing WeCom webhook key for integration ${integrationId}`);
            await this.registerEvent(integrationId, event, 'failed', 'Missing webhook key');
            return;
        }

        const url = `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${key}`;

        try {
            const payload = formatWeComMessage(event);

            const response = await this.fetchRetry(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            this.logger.info(
                `WeCom notification sent for event ${event.type} (integration: ${integrationId})`
            );

            await this.registerEvent(integrationId, event, 'success', '', {
                statusCode: response.status,
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(
                `Failed to send WeCom notification for integration ${integrationId}:`,
                error
            );

            await this.registerEvent(integrationId, event, 'failed', errorMessage);
        }
    }
}

export default WeComAddon;
