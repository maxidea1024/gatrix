/**
 * WhatsApp Addon
 *
 * Sends event notifications to WhatsApp via Meta Cloud API.
 */

import Addon from './Addon';
import { whatsappDefinition } from './definitions';
import { IntegrationSystemEvent } from '../types/integrationEvents';
import { formatWhatsAppMessage } from './EventFormatter';

export class WhatsAppAddon extends Addon {
    constructor() {
        super(whatsappDefinition);
    }

    async handleEvent(
        event: IntegrationSystemEvent,
        parameters: Record<string, any>,
        integrationId: string
    ): Promise<void> {
        const { accessToken, phoneNumberId, recipientPhoneNumber } = parameters;

        if (!accessToken || !phoneNumberId || !recipientPhoneNumber) {
            this.logger.warn(`Missing WhatsApp configuration for integration ${integrationId}`);
            await this.registerEvent(integrationId, event, 'failed', 'Missing required parameters');
            return;
        }

        const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

        try {
            const payload = formatWhatsAppMessage(event, recipientPhoneNumber);

            const response = await this.fetchRetry(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            this.logger.info(
                `WhatsApp notification sent for event ${event.type} (integration: ${integrationId})`
            );

            await this.registerEvent(integrationId, event, 'success', '', {
                recipient: recipientPhoneNumber,
                statusCode: response.status,
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(
                `Failed to send WhatsApp notification for integration ${integrationId}:`,
                error
            );

            await this.registerEvent(integrationId, event, 'failed', errorMessage, {
                recipient: recipientPhoneNumber,
            });
        }
    }
}

export default WhatsAppAddon;
