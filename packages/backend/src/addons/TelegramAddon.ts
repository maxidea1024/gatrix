/**
 * Telegram Addon
 *
 * Sends event notifications to Telegram via Bot API.
 */

import Addon from './Addon';
import { telegramDefinition } from './definitions';
import { IntegrationSystemEvent } from '../types/integrationEvents';
import { formatTelegramMessage } from './EventFormatter';

export class TelegramAddon extends Addon {
    constructor() {
        super(telegramDefinition);
    }

    async handleEvent(
        event: IntegrationSystemEvent,
        parameters: Record<string, any>,
        integrationId: string
    ): Promise<void> {
        const { botToken, chatId, parse_mode } = parameters;

        if (!botToken || !chatId) {
            this.logger.warn(`Missing Telegram configuration for integration ${integrationId}`);
            await this.registerEvent(integrationId, event, 'failed', 'Missing bot token or chat ID');
            return;
        }

        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

        try {
            const text = formatTelegramMessage(event);

            const payload = {
                chat_id: chatId,
                text,
                parse_mode: parse_mode || 'Markdown',
            };

            const response = await this.fetchRetry(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            this.logger.info(
                `Telegram notification sent for event ${event.type} (integration: ${integrationId})`
            );

            await this.registerEvent(integrationId, event, 'success', '', {
                chatId,
                statusCode: response.status,
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(
                `Failed to send Telegram notification for integration ${integrationId}:`,
                error
            );

            await this.registerEvent(integrationId, event, 'failed', errorMessage, {
                chatId,
            });
        }
    }
}

export default TelegramAddon;
