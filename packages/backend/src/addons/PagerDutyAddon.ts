/**
 * PagerDuty Addon
 *
 * Sends event notifications to PagerDuty via Events API v2.
 */

import Addon from './Addon';
import { pagerDutyDefinition } from './definitions';
import { IntegrationSystemEvent } from '../types/integrationEvents';
import { formatPagerDutyMessage } from './EventFormatter';

export class PagerDutyAddon extends Addon {
    private readonly apiUrl = 'https://events.pagerduty.com/v2/enqueue';

    constructor() {
        super(pagerDutyDefinition);
    }

    async handleEvent(
        event: IntegrationSystemEvent,
        parameters: Record<string, any>,
        integrationId: string
    ): Promise<void> {
        const { routingKey, customHeaders } = parameters;

        if (!routingKey) {
            this.logger.warn(`Missing PagerDuty routing key for integration ${integrationId}`);
            await this.registerEvent(integrationId, event, 'failed', 'Missing routing key');
            return;
        }

        try {
            const payload = formatPagerDutyMessage(event, routingKey);

            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                ...this.parseCustomHeaders(customHeaders),
            };

            const response = await this.fetchRetry(this.apiUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
            });

            this.logger.info(
                `PagerDuty notification sent for event ${event.type} (integration: ${integrationId})`
            );

            await this.registerEvent(integrationId, event, 'success', '', {
                routingKey: '***',
                statusCode: response.status,
            });
        } catch (error) {
            this.logger.error(
                `Failed to send PagerDuty notification for integration ${integrationId}:`,
                error
            );

            await this.registerFailure(integrationId, event, error, {
                routingKey: '***',
            });
        }
    }
}

export default PagerDutyAddon;
