/**
 * KakaoTalk Addon
 *
 * Sends event notifications to KakaoTalk via a generic API relay.
 */

import Addon from './Addon';
import { kakaoDefinition } from './definitions';
import { IntegrationSystemEvent } from '../types/integrationEvents';
import { formatKakaoMessage } from './EventFormatter';

export class KakaoAddon extends Addon {
    constructor() {
        super(kakaoDefinition);
    }

    async handleEvent(
        event: IntegrationSystemEvent,
        parameters: Record<string, any>,
        integrationId: string
    ): Promise<void> {
        const { apiUrl, apiKey, senderKey } = parameters;

        if (!apiUrl || !apiKey || !senderKey) {
            this.logger.warn(`Missing Kakao configuration for integration ${integrationId}`);
            await this.registerEvent(integrationId, event, 'failed', 'Missing required parameters');
            return;
        }

        try {
            const payload = formatKakaoMessage(event);

            const body = {
                ...payload,
                apiKey,
                senderKey,
            };

            const response = await this.fetchRetry(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            this.logger.info(
                `KakaoTalk notification sent for event ${event.type} (integration: ${integrationId})`
            );

            await this.registerEvent(integrationId, event, 'success', '', {
                apiUrl,
                statusCode: response.status,
            });
        } catch (error) {
            this.logger.error(
                `Failed to send KakaoTalk notification for integration ${integrationId}:`,
                error
            );

            await this.registerFailure(integrationId, event, error, {
                apiUrl,
            });
        }
    }
}

export default KakaoAddon;
