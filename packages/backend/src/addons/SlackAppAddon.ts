/**
 * Slack App Addon
 *
 * Sends event notifications to Slack via Web API (using access token).
 * Unlike the Webhook-based Slack addon, this uses the official Slack Web API
 * and requires an app with proper OAuth scopes.
 */

import Addon from './Addon';
import { slackAppDefinition } from './definitions';
import { IntegrationSystemEvent } from '../types/integrationEvents';
import { formatSlackMessage } from './EventFormatter';

interface SlackApiResponse {
    ok: boolean;
    error?: string;
    channel?: string;
    ts?: string;
}

export class SlackAppAddon extends Addon {
    constructor() {
        super(slackAppDefinition);
    }

    async handleEvent(
        event: IntegrationSystemEvent,
        parameters: Record<string, any>,
        integrationId: string
    ): Promise<void> {
        const { accessToken, defaultChannels } = parameters;

        if (!accessToken) {
            this.logger.warn(`Missing Slack access token for integration ${integrationId}`);
            await this.registerEvent(integrationId, event, 'failed', 'Missing access token');
            return;
        }

        const channels = this.parseChannels(defaultChannels);
        if (channels.length === 0) {
            this.logger.warn(`No Slack channels configured for integration ${integrationId}`);
            await this.registerEvent(integrationId, event, 'failed', 'No channels configured');
            return;
        }

        const message = formatSlackMessage(event, {});
        const { text, blocks } = this.formatForWebApi(message);

        const results: { channel: string; success: boolean; error?: string }[] = [];

        for (const channel of channels) {
            try {
                const response = await this.postMessage(accessToken, channel, text, blocks);

                if (response.ok) {
                    results.push({ channel, success: true });
                    this.logger.info(
                        `Slack App notification sent to ${channel} for event ${event.type} (integration: ${integrationId})`
                    );
                } else {
                    results.push({ channel, success: false, error: response.error });
                    this.logger.warn(
                        `Failed to send Slack App notification to ${channel}: ${response.error}`
                    );
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                results.push({ channel, success: false, error: errorMessage });
                this.logger.error(
                    `Failed to send Slack App notification to ${channel}:`,
                    error
                );
            }
        }

        const successCount = results.filter((r) => r.success).length;
        const failCount = results.length - successCount;

        if (failCount === 0) {
            await this.registerEvent(integrationId, event, 'success', '', {
                channels: results.map((r) => r.channel),
            });
        } else if (successCount === 0) {
            const errors = results.map((r) => `${r.channel}: ${r.error}`).join(', ');
            await this.registerEvent(integrationId, event, 'failed', errors, {
                channels: results.map((r) => r.channel),
            });
        } else {
            const errors = results
                .filter((r) => !r.success)
                .map((r) => `${r.channel}: ${r.error}`)
                .join(', ');
            await this.registerEvent(integrationId, event, 'successWithErrors', errors, {
                channels: results.map((r) => r.channel),
                successCount,
                failCount,
            });
        }
    }

    /**
     * Parse comma-separated channel list
     */
    private parseChannels(channelStr?: string): string[] {
        if (!channelStr) return [];
        return channelStr
            .split(',')
            .map((c) => c.trim())
            .filter((c) => c.length > 0);
    }

    /**
     * Format message for Slack Web API
     */
    private formatForWebApi(
        slackMessage: Record<string, any>
    ): { text: string; blocks: any[] } {
        const text = slackMessage.text || '';
        const blocks = [
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: text.substring(0, 3000), // Slack limit
                },
            },
        ];

        return { text, blocks };
    }

    /**
     * Post message using Slack Web API
     */
    private async postMessage(
        accessToken: string,
        channel: string,
        text: string,
        blocks: any[]
    ): Promise<SlackApiResponse> {
        const response = await this.fetchRetry('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                channel,
                text,
                blocks,
                unfurl_links: false,
            }),
        });

        return response.json() as Promise<SlackApiResponse>;
    }
}

export default SlackAppAddon;
