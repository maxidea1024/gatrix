/**
 * Discord Addon
 *
 * Sends event notifications to Discord via Incoming Webhooks.
 */

import Addon from './Addon';
import { discordDefinition } from './definitions';
import { IntegrationSystemEvent } from '../types/integrationEvents';
import { formatDiscordMessage } from './EventFormatter';

export class DiscordAddon extends Addon {
    constructor() {
        super(discordDefinition);
    }

    async handleEvent(
        event: IntegrationSystemEvent,
        parameters: Record<string, any>,
        integrationId: string
    ): Promise<void> {
        const { url, username, avatar_url, customHeaders } = parameters;

        if (!url) {
            this.logger.warn(`Missing Discord webhook URL for integration ${integrationId}`);
            await this.registerEvent(integrationId, event, 'failed', 'Missing webhook URL');
            return;
        }

        try {
            const payload = formatDiscordMessage(event);
            if (username) payload.username = username;
            if (avatar_url) payload.avatar_url = avatar_url;

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
                `Discord notification sent for event ${event.type} (integration: ${integrationId})`
            );

            await this.registerEvent(integrationId, event, 'success', '', {
                url: this.maskUrl(url),
                username,
                statusCode: response.status,
            });
        } catch (error) {
            this.logger.error(
                `Failed to send Discord notification for integration ${integrationId}:`,
                error
            );

            await this.registerFailure(integrationId, event, error, {
                url: this.maskUrl(url),
                username,
            });
        }
    }

    /**
     * Mask sensitive parts of URL for logging
     */
    private maskUrl(url: string): string {
        try {
            const parsed = new URL(url);
            const pathParts = parsed.pathname.split('/');
            if (pathParts.length > 2) {
                return `${parsed.origin}/${pathParts[1]}/${pathParts[2]}/***`;
            }
            return `${parsed.origin}/***`;
        } catch {
            return '***';
        }
    }
}

export default DiscordAddon;
